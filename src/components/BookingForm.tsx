import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Field, SelectField, TextArea } from './ui';
import { SlidingTabs } from './motion';
import { PlaceField, type PlaceCoords } from './maps/PlaceField';
import { KIGALI_AIRPORT } from './maps/useMapsConfig';

export type Kind = 'driver' | 'chauffeur' | 'airport';

export interface BookingDraft {
  kind: Kind;
  direction: 'to_airport' | 'from_airport';
  flightNumber: string;
  pickup: string;
  pickupCoords?: PlaceCoords | null;
  dropoff: string;
  dropoffCoords?: PlaceCoords | null;
  when: string; // datetime-local value
  durationHours: string;
  passengers: string;
  carMake: string;
  carModel: string;
  carPlate: string;
  transmission: '' | 'automatic' | 'manual';
  notes: string;
}

const DRAFT_KEY = 'rw_booking_draft';

export function emptyDraft(kind: Kind = 'driver'): BookingDraft {
  // Default pickup: tomorrow at 09:00 local time.
  const d = new Date(Date.now() + 24 * 3_600_000);
  d.setHours(9, 0, 0, 0);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  return { kind, direction: 'to_airport', flightNumber: '', pickup: '', dropoff: '', when: local, durationHours: kind === 'driver' ? '4' : '2', passengers: '1', carMake: '', carModel: '', carPlate: '', transmission: '', notes: '' };
}

export const saveDraft = (d: BookingDraft) => sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
export const loadDraft = (): BookingDraft | null => {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? { ...emptyDraft(), ...(JSON.parse(raw) as BookingDraft) } : null;
  } catch {
    return null;
  }
};
export const clearDraft = () => sessionStorage.removeItem(DRAFT_KEY);

const coordsOf = (c: { lat: number; lng: number } | null | undefined) => (c ? { lat: c.lat, lng: c.lng } : {});

/** Turn the form into the API request body. The API validates everything again. */
export function draftToBody(d: BookingDraft, airportName: string) {
  const airport = d.kind === 'airport';
  const pickup = airport && d.direction === 'from_airport' ? airportName : d.pickup.trim();
  const dropoff = airport && d.direction === 'to_airport' ? airportName : d.dropoff.trim();
  return {
    service: d.kind === 'driver' ? 'driver_on_demand' : 'chauffeur',
    ...(airport ? { airport: { direction: d.direction, flightNumber: d.flightNumber.trim() || null } } : {}),
    pickup: { address: pickup, ...coordsOf(airport && d.direction === 'from_airport' ? KIGALI_AIRPORT : d.pickupCoords) },
    dropoff: dropoff ? { address: dropoff, ...coordsOf(airport && d.direction === 'to_airport' ? KIGALI_AIRPORT : d.dropoffCoords) } : null,
    startAt: new Date(d.when).toISOString(),
    durationHours: Number(d.durationHours),
    passengers: Number(d.passengers),
    notes: d.notes.trim() || null,
    ...(d.kind === 'driver'
      ? { customerVehicle: { make: d.carMake.trim(), model: d.carModel.trim(), plate: d.carPlate.trim(), transmission: d.transmission || null } }
      : {}),
  };
}

export function draftComplete(d: BookingDraft): boolean {
  const airport = d.kind === 'airport';
  const needPickup = !(airport && d.direction === 'from_airport');
  const needDropoff = d.kind === 'chauffeur' ? false : airport && d.direction === 'from_airport';
  return Boolean(
    d.when &&
      Number(d.durationHours) >= 1 &&
      Number(d.passengers) >= 1 &&
      (!needPickup || d.pickup.trim().length >= 3) &&
      (!needDropoff || d.dropoff.trim().length >= 3) &&
      (d.kind !== 'driver' || (d.carMake.trim() && d.carModel.trim() && d.carPlate.trim().length >= 4)),
  );
}

/**
 * The booking form: service tabs, then only the fields that service needs.
 * `compact` is the home-page version (no notes, fewer hints).
 */
export function BookingForm({
  value,
  onChange,
  onSubmit,
  submitLabel,
  busy,
  compact,
  footer,
}: {
  value: BookingDraft;
  onChange: (d: BookingDraft) => void;
  onSubmit: (d: BookingDraft) => void;
  submitLabel: string;
  busy?: boolean;
  compact?: boolean;
  footer?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const set = (k: keyof BookingDraft) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value });
  const airport = value.kind === 'airport';
  const [minWhen, setMinWhen] = useState('');
  useEffect(() => {
    const d = new Date(Date.now() + 60 * 60_000);
    setMinWhen(new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16));
  }, []);

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit(value);
      }}
      noValidate
    >
      <div style={{ marginBottom: '1.25rem' }}>
        <SlidingTabs<Kind>
          label={t('booking.service')}
          value={value.kind}
          onChange={(kind) => onChange({ ...value, kind, durationHours: kind === 'driver' ? value.durationHours || '4' : value.durationHours || '2' })}
          tabs={[
            { value: 'driver', label: t('home.tabDriver') },
            { value: 'chauffeur', label: t('home.tabChauffeur') },
            { value: 'airport', label: t('home.tabAirport') },
          ]}
        />
      </div>
      <div className="form-grid page-enter" key={value.kind}>
        {airport && (
          <>
            <SelectField label={t('booking.airportDirection')} value={value.direction} onChange={set('direction')}>
              <option value="to_airport">{t('booking.toAirport')}</option>
              <option value="from_airport">{t('booking.fromAirport')}</option>
            </SelectField>
            <Field label={t('booking.flight')} value={value.flightNumber} onChange={set('flightNumber')} placeholder="WB 302" />
          </>
        )}
        {!(airport && value.direction === 'from_airport') ? (
          <PlaceField
            className="span-2"
            label={t('booking.pickup')}
            hint={compact ? undefined : t('booking.pickupHint')}
            address={value.pickup}
            coords={value.pickupCoords ?? null}
            onChange={(pickup, pickupCoords) => onChange({ ...value, pickup, pickupCoords })}
          />
        ) : (
          <Field className="span-2" label={t('booking.pickup')} value={t('booking.airportName')} readOnly />
        )}
        {!(airport && value.direction === 'to_airport') ? (
          <PlaceField
            className="span-2"
            label={airport ? t('booking.dropoff') : t('booking.dropoffOptional')}
            address={value.dropoff}
            coords={value.dropoffCoords ?? null}
            allowCurrentLocation={false}
            onChange={(dropoff, dropoffCoords) => onChange({ ...value, dropoff, dropoffCoords })}
          />
        ) : (
          <Field className="span-2" label={t('booking.dropoff')} value={t('booking.airportName')} readOnly />
        )}
        <Field label={t('booking.date')} type="datetime-local" min={minWhen} value={value.when} onChange={set('when')} />
        <Field label={t('booking.duration')} type="number" min={1} max={336} inputMode="numeric" value={value.durationHours} onChange={set('durationHours')} />
        <Field label={t('booking.passengers')} type="number" min={1} max={60} inputMode="numeric" value={value.passengers} onChange={set('passengers')} />
        {value.kind === 'driver' && (
          <>
            <h3 className="span-2" style={{ margin: '0.25rem 0 0.75rem' }}>
              {t('booking.yourCar')}
            </h3>
            <Field label={t('booking.carMake')} value={value.carMake} onChange={set('carMake')} placeholder="Toyota" />
            <Field label={t('booking.carModel')} value={value.carModel} onChange={set('carModel')} placeholder="RAV4" />
            <Field label={t('booking.carPlate')} value={value.carPlate} onChange={set('carPlate')} placeholder="RAB 123 C" style={{ textTransform: 'uppercase' }} />
            <SelectField label={t('booking.transmission')} value={value.transmission} onChange={set('transmission')}>
              <option value="">—</option>
              <option value="automatic">{t('booking.automatic')}</option>
              <option value="manual">{t('booking.manual')}</option>
            </SelectField>
          </>
        )}
        {!compact && <TextArea className="span-2" label={t('booking.notes')} maxLength={1000} value={value.notes} onChange={set('notes')} />}
      </div>
      {footer}
      <button type="submit" disabled={busy || !draftComplete(value)} style={{ width: '100%' }}>
        {submitLabel}
      </button>
    </form>
  );
}
