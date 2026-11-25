import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import type { DriverTrip, OwnerTrip } from '../../api/types';
import { Card, ErrorText, Field, Loading, StatusChip } from '../../components/ui';
import { Reveal } from '../../components/motion';
import { fmtKigali, relative } from '../../components/time';
import { ServiceIcon, serviceLabel } from '../BookingsPage';
import { ShareLocation } from '../../components/tracking/ShareLocation';
import { TrackingCard } from '../../components/tracking/TrackingCard';

/** Live countdown text for an acceptance deadline. */
function Countdown({ until }: { until: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const iv = window.setInterval(() => tick((n) => n + 1), 15_000);
    return () => window.clearInterval(iv);
  }, []);
  return <span className="countdown">{relative(until)}</span>;
}

function TripRow({ trip, to }: { trip: DriverTrip | OwnerTrip; to?: string }) {
  const { t } = useTranslation();
  const inner = (
    <>
      <div className="row" style={{ gap: '1rem', flexWrap: 'nowrap', minWidth: 0 }}>
        <div className="icon-tile" style={{ margin: 0, flex: '0 0 auto' }}>
          <ServiceIcon b={trip} />
        </div>
        <div style={{ minWidth: 0 }}>
          <strong>
            {serviceLabel(t, trip)} · {fmtKigali(trip.startAt)}
          </strong>
          <div className="muted small">
            {trip.ref}
            {'pickup' in trip ? ` · ${trip.pickup.address}` : trip.vehicle ? ` · ${trip.vehicle.make} ${trip.vehicle.model} ${trip.vehicle.plate}` : ''}
          </div>
          {trip.offer?.deadline && (
            <div className="small">
              {t('trips.acceptBy', { time: fmtKigali(trip.offer.deadline, { hour: '2-digit', minute: '2-digit' }) })} · <Countdown until={trip.offer.deadline} />
            </div>
          )}
        </div>
      </div>
      <StatusChip status={trip.status} />
    </>
  );
  return to ? (
    <Link to={to} className="card lift list-row" data-testid={`trip-${trip.ref}`}>
      {inner}
    </Link>
  ) : (
    <div className="card list-row" data-testid={`trip-${trip.ref}`}>
      {inner}
    </div>
  );
}

export function DriverTripsPage() {
  const { t } = useTranslation();
  const [trips, setTrips] = useState<DriverTrip[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    const load = () => api<{ trips: DriverTrip[] }>('/driver/trips').then((r) => setTrips(r.trips)).catch(setError);
    load();
    const iv = window.setInterval(load, 20_000);
    return () => window.clearInterval(iv);
  }, []);
  const offers = trips?.filter((x) => x.offer) ?? [];
  const upcoming = trips?.filter((x) => !x.offer && ['paid', 'assigned', 'in_progress'].includes(x.status)) ?? [];
  const recent = trips?.filter((x) => x.status === 'completed') ?? [];
  return (
    <div className="page container" style={{ maxWidth: 860 }}>
      <Reveal className="page-head">
        <div>
          <p className="eyebrow">{t('trips.eyebrow')}</p>
          <h1>{t('trips.title')}</h1>
        </div>
      </Reveal>
      <ErrorText error={error} />
      {!trips ? (
        <Loading />
      ) : trips.length === 0 ? (
        <p className="card muted">{t('trips.none')}</p>
      ) : (
        <div className="grid">
          {[
            [t('trips.offers'), offers],
            [t('trips.upcoming'), upcoming],
            [t('trips.recent'), recent],
          ].map(([title, list]) =>
            (list as DriverTrip[]).length ? (
              <section key={title as string}>
                <h2 className="h2" style={{ fontSize: '1.2rem' }}>
                  {title as string}
                </h2>
                <div className="grid">
                  {(list as DriverTrip[]).map((trip) => (
                    <TripRow key={trip.id} trip={trip} to={`/driver/trips/${trip.id}`} />
                  ))}
                </div>
              </section>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

export function DriverTripPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [trip, setTrip] = useState<DriverTrip | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('');
  const [declined, setDeclined] = useState(false);

  const load = useCallback(() => {
    api<DriverTrip>(`/driver/trips/${id}`).then(setTrip).catch(setError);
  }, [id]);
  useEffect(load, [load]);

  const act = async (fn: () => Promise<DriverTrip | void>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (res) setTrip(res);
      else load();
    } catch (err) {
      setError(err);
      load();
    } finally {
      setBusy(false);
    }
  };

  if (declined)
    return (
      <div className="page container">
        <p className="notice">{t('trips.decline')} ✓</p>
        <Link to="/driver/trips">← {t('trips.title')}</Link>
      </div>
    );
  if (!trip) return <div className="page container">{error ? <ErrorText error={error} /> : <Loading />}</div>;

  return (
    <div className="page container" style={{ maxWidth: 760 }}>
      <Reveal className="page-head">
        <div>
          <p className="eyebrow">
            <Link to="/driver/trips">← {t('trips.title')}</Link>
          </p>
          <h1 style={{ marginBottom: '0.2rem' }}>{serviceLabel(t, trip)}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {trip.ref} · {fmtKigali(trip.startAt)} → {fmtKigali(trip.endAt, { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <StatusChip status={trip.status} />
      </Reveal>
      <ErrorText error={error} />

      <div className="grid">
        {trip.offer && (
          <Card>
            <p style={{ marginTop: 0 }}>
              {t('trips.acceptBy', { time: fmtKigali(trip.offer.deadline) })} · {trip.offer.deadline && <Countdown until={trip.offer.deadline} />}
            </p>
            <div className="row">
              <button type="button" className="ok" disabled={busy} onClick={() => void act(() => api<DriverTrip>(`/driver/trips/${trip.id}/accept`, { method: 'POST' }))}>
                {t('trips.accept')}
              </button>
              <input aria-label={t('trips.declineReason')} placeholder={t('trips.declineReason')} value={reason} onChange={(e) => setReason(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
              <button
                type="button"
                className="danger"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await api(`/driver/trips/${trip.id}/decline`, { method: 'POST', body: { reason: reason || null } });
                    setDeclined(true);
                  })
                }
              >
                {t('trips.decline')}
              </button>
            </div>
          </Card>
        )}
        {trip.waitingForVehicleOwner && <p className="notice">{t('trips.waitingOwner')}</p>}

        <Card>
          <dl className="facts">
            <dt>{t('trips.customer')}</dt>
            <dd>
              {trip.customer.firstName}
              {trip.customer.phone && (
                <>
                  {' · '}
                  <a href={`tel:${trip.customer.phone}`} data-testid="customer-phone">
                    {trip.customer.phone}
                  </a>
                </>
              )}
            </dd>
            <dt>{t('booking.from')}</dt>
            <dd>{trip.pickup.address}</dd>
            {trip.dropoff && (
              <>
                <dt>{t('booking.to')}</dt>
                <dd>{trip.dropoff.address}</dd>
              </>
            )}
            {trip.airport?.flightNumber && (
              <>
                <dt>{t('trips.flight')}</dt>
                <dd>{trip.airport.flightNumber}</dd>
              </>
            )}
            <dt>{t('booking.passengers')}</dt>
            <dd>{trip.passengers}</dd>
            {trip.customerVehicle?.make && (
              <>
                <dt>{t('trips.theirCar')}</dt>
                <dd>
                  {trip.customerVehicle.make} {trip.customerVehicle.model} · {trip.customerVehicle.plate}
                  {trip.customerVehicle.transmission ? ` · ${trip.customerVehicle.transmission}` : ''}
                </dd>
              </>
            )}
            {trip.vehicle && (
              <>
                <dt>{t('booking.vehicle')}</dt>
                <dd>
                  {trip.vehicle.colour} {trip.vehicle.make} {trip.vehicle.model} · {trip.vehicle.plate}
                </dd>
              </>
            )}
            {trip.notes && (
              <>
                <dt>{t('trips.notes')}</dt>
                <dd>{trip.notes}</dd>
              </>
            )}
          </dl>
          {trip.navigation && (
            <div className="row" style={{ marginTop: '1rem' }}>
              <a className="btn ghost" href={trip.navigation.pickup} target="_blank" rel="noopener noreferrer">
                {t('trips.navigatePickup')} ↗
              </a>
              {trip.navigation.dropoff && (
                <a className="btn ghost" href={trip.navigation.dropoff} target="_blank" rel="noopener noreferrer">
                  {t('trips.navigateDropoff')} ↗
                </a>
              )}
            </div>
          )}
        </Card>

        {(trip.status === 'assigned' || trip.status === 'in_progress') && trip.isMine && <ShareLocation bookingId={trip.id} />}

        {trip.status === 'assigned' && (
          <Card>
            {trip.pinLocked ? (
              <p className="notice bad">{t('trips.pinLocked')}</p>
            ) : (
              <div className="row" style={{ alignItems: 'flex-end' }}>
                <Field
                  label={t('trips.pinLabel')}
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  style={{ letterSpacing: '0.4em', fontSize: '1.3rem', maxWidth: 180 }}
                />
                <button
                  type="button"
                  style={{ marginBottom: '1.1rem' }}
                  disabled={busy || pin.length !== 4}
                  onClick={() => void act(() => api<DriverTrip>(`/driver/trips/${trip.id}/start`, { method: 'POST', body: { pin } }))}
                >
                  {t('trips.start')}
                </button>
              </div>
            )}
          </Card>
        )}
        {trip.status === 'in_progress' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => window.confirm(t('trips.completeConfirm')) && void act(() => api<DriverTrip>(`/driver/trips/${trip.id}/complete`, { method: 'POST' }))}
          >
            {t('trips.complete')}
          </button>
        )}
      </div>
    </div>
  );
}

export function OwnerTripsPage() {
  const { t } = useTranslation();
  const [trips, setTrips] = useState<OwnerTrip[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    api<{ trips: OwnerTrip[] }>('/owner/trips').then((r) => setTrips(r.trips)).catch(setError);
  }, []);
  useEffect(load, [load]);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
      load();
    }
  };
  return (
    <div className="page container" style={{ maxWidth: 860 }}>
      <Reveal className="page-head">
        <div>
          <p className="eyebrow">{t('trips.ownerEyebrow')}</p>
          <h1>{t('trips.ownerTitle')}</h1>
        </div>
      </Reveal>
      <ErrorText error={error} />
      {!trips ? (
        <Loading />
      ) : trips.length === 0 ? (
        <p className="card muted">{t('trips.none')}</p>
      ) : (
        <div className="grid">
          {trips.map((trip) => (
            <div key={trip.id}>
              <TripRow trip={trip} />
              {trip.offer && (
                <div className="row" style={{ margin: '0.5rem 0 0 0.5rem' }}>
                  <button type="button" className="ok small" disabled={busy} onClick={() => void act(() => api(`/owner/trips/${trip.id}/accept`, { method: 'POST' }))}>
                    {t('trips.accept')}
                  </button>
                  <button type="button" className="danger small" disabled={busy} onClick={() => void act(() => api(`/owner/trips/${trip.id}/decline`, { method: 'POST', body: {} }))}>
                    {t('trips.decline')}
                  </button>
                </div>
              )}
              {trip.status === 'in_progress' && (
                <div style={{ marginTop: '0.5rem' }}>
                  <TrackingCard bookingId={trip.id} as="owner" />
                </div>
              )}
              {(trip.startedAt || trip.endedAt) && (
                <p className="muted small" style={{ margin: '0.4rem 0 0 0.5rem' }}>
                  {trip.startedAt && `${t('trips.started')}: ${fmtKigali(trip.startedAt)}`} {trip.endedAt && ` · ${t('trips.ended')}: ${fmtKigali(trip.endedAt)}`}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
