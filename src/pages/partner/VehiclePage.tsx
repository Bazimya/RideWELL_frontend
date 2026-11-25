import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import type { DocView, VehicleDetail, VehicleView } from '../../api/types';
import { Card, ErrorText, Field, Loading, SelectField, StatusChip, toDateInput } from '../../components/ui';
import { Checklist, StatusTimeline, UploadTile } from '../../components/partner';
import { Reveal } from '../../components/motion';
import { AvailabilityEditor, StatusNotice } from './shared';

export interface VehicleFormState {
  make: string;
  model: string;
  year: string;
  plate: string;
  colour: string;
  category: string;
  seats: string;
  insurer: string;
  insurancePolicyNumber: string;
  insuranceExpiry: string;
  hourlyRwf: string;
  dailyRwf: string;
  airportTransferRwf: string;
}

export const emptyVehicle: VehicleFormState = {
  make: '',
  model: '',
  year: '',
  plate: '',
  colour: '',
  category: 'sedan',
  seats: '4',
  insurer: '',
  insurancePolicyNumber: '',
  insuranceExpiry: '',
  hourlyRwf: '',
  dailyRwf: '',
  airportTransferRwf: '',
};

export function fromVehicle(v: VehicleDetail): VehicleFormState {
  return {
    make: v.make,
    model: v.model,
    year: String(v.year),
    plate: v.plate,
    colour: v.colour,
    category: v.category,
    seats: String(v.seats),
    insurer: v.insurer ?? '',
    insurancePolicyNumber: v.insurancePolicyNumber ?? '',
    insuranceExpiry: toDateInput(v.insuranceExpiry),
    hourlyRwf: v.proposedRates.hourlyRwf?.toString() ?? '',
    dailyRwf: v.proposedRates.dailyRwf?.toString() ?? '',
    airportTransferRwf: v.proposedRates.airportTransferRwf?.toString() ?? '',
  };
}

const int = (s: string) => (s.trim() === '' ? null : Math.round(Number(s.replace(/[^\d]/g, ''))));

export function vehicleBody(f: VehicleFormState) {
  return {
    make: f.make.trim(),
    model: f.model.trim(),
    year: Number(f.year),
    plate: f.plate,
    colour: f.colour.trim(),
    category: f.category,
    seats: Number(f.seats),
    insurer: f.insurer.trim() || null,
    insurancePolicyNumber: f.insurancePolicyNumber.trim() || null,
    insuranceExpiry: f.insuranceExpiry ? new Date(f.insuranceExpiry).toISOString() : null,
    proposedRates: { hourlyRwf: int(f.hourlyRwf), dailyRwf: int(f.dailyRwf), airportTransferRwf: int(f.airportTransferRwf) },
  };
}

export function VehicleForm({ value, onChange }: { value: VehicleFormState; onChange: (v: VehicleFormState) => void }) {
  const { t } = useTranslation();
  const set = (k: keyof VehicleFormState) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value });
  return (
    <>
      <div className="form-grid">
        <Field label={t('partner.make')} value={value.make} onChange={set('make')} />
        <Field label={t('partner.model')} value={value.model} onChange={set('model')} />
        <Field label={t('partner.year')} type="number" inputMode="numeric" value={value.year} onChange={set('year')} />
        <Field label={t('partner.plate')} value={value.plate} onChange={set('plate')} placeholder="RAB 123 C" style={{ textTransform: 'uppercase' }} />
        <Field label={t('partner.colour')} value={value.colour} onChange={set('colour')} />
        <SelectField label={t('partner.category')} value={value.category} onChange={set('category')}>
          {['sedan', 'suv', 'executive', 'van', 'minibus'].map((c) => (
            <option key={c} value={c}>
              {t(`partner.categories.${c}`)}
            </option>
          ))}
        </SelectField>
        <Field label={t('partner.seats')} type="number" min={1} max={60} value={value.seats} onChange={set('seats')} />
        <Field label={t('partner.insurer')} value={value.insurer} onChange={set('insurer')} />
        <Field label={t('partner.policyNumber')} value={value.insurancePolicyNumber} onChange={set('insurancePolicyNumber')} />
        <Field label={t('partner.insuranceExpiry')} type="date" value={value.insuranceExpiry} onChange={set('insuranceExpiry')} />
      </div>
      <h3>{t('partner.rates')}</h3>
      <p className="hint" style={{ marginBottom: '0.75rem' }}>
        {t('partner.ratesHint')}
      </p>
      <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        <Field label={t('partner.hourly')} inputMode="numeric" value={value.hourlyRwf} onChange={set('hourlyRwf')} />
        <Field label={t('partner.daily')} inputMode="numeric" value={value.dailyRwf} onChange={set('dailyRwf')} />
        <Field label={t('partner.airport')} inputMode="numeric" value={value.airportTransferRwf} onChange={set('airportTransferRwf')} />
      </div>
    </>
  );
}

const DOC_KINDS: Array<{ kind: string; imagesOnly?: boolean }> = [
  { kind: 'registration_certificate' },
  { kind: 'ownership_proof' },
  { kind: 'insurance' },
  { kind: 'vehicle_photo', imagesOnly: true },
];

export function VehiclePage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [view, setView] = useState<VehicleView | null>(null);
  const [form, setForm] = useState<VehicleFormState>(emptyVehicle);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const apply = useCallback((v: VehicleView) => {
    setView(v);
    setForm(fromVehicle(v.vehicle));
  }, []);
  useEffect(() => {
    api<VehicleView>(`/partners/vehicles/${id}`).then(apply).catch(setError);
  }, [id, apply]);

  if (!view) return <div className="page container">{error ? <ErrorText error={error} /> : <Loading />}</div>;
  const v = view.vehicle;
  const editable = v.status === 'draft' || v.status === 'rejected';

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      apply(await api<VehicleView>(`/partners/vehicles/${id}`, { method: 'PUT', body: vehicleBody(form) }));
      setSaved(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      apply(await api<VehicleView>(`/partners/vehicles/${id}/submit`, { method: 'POST' }));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (d: DocView) => {
    await api(`/partners/documents/${d.id}`, { method: 'DELETE' }).catch(setError);
    apply(await api<VehicleView>(`/partners/vehicles/${id}`));
  };

  return (
    <div className="page container">
      <Reveal className="page-head">
        <div>
          <p className="eyebrow">
            <Link to="/partner/owner">← {t('partner.backToOwner')}</Link>
          </p>
          <h1>
            {v.make} {v.model}
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            {v.plate} · {v.year} · {v.colour}
          </p>
        </div>
        <StatusChip status={v.status} />
      </Reveal>
      <Reveal index={1}>
        <StatusTimeline status={v.status} />
        <StatusNotice status={v.status} reason={v.decisionReason} />
      </Reveal>

      <div className="split">
        <div className="grid">
          <Reveal index={2}>
            <Card title={t('partner.details')}>
              <form onSubmit={save} noValidate>
                <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0 }}>
                  <VehicleForm value={form} onChange={setForm} />
                  {editable && (
                    <div className="row">
                      <button type="submit" className="ghost" disabled={busy}>
                        {t('partner.saveDetails')}
                      </button>
                      {saved && (
                        <span className="success" role="status">
                          {t('account.saved')}
                        </span>
                      )}
                    </div>
                  )}
                </fieldset>
              </form>
            </Card>
          </Reveal>
          <Reveal index={3}>
            <Card title={t('partner.documents')}>
              <p className="hint" style={{ marginBottom: '1rem' }}>
                {t('partner.documentsHint')}
              </p>
              <div className="uploads">
                {DOC_KINDS.map(({ kind, imagesOnly }) => (
                  <UploadTile<VehicleView>
                    key={kind}
                    kind={kind}
                    docs={view.documents}
                    endpoint={`/partners/vehicles/${id}/documents`}
                    imagesOnly={imagesOnly}
                    disabled={v.status === 'suspended'}
                    onUploaded={apply}
                    onRemove={editable ? remove : undefined}
                  />
                ))}
              </div>
            </Card>
          </Reveal>
          {v.status === 'approved' && (
            <Reveal index={4}>
              <AvailabilityEditor<VehicleView> value={v.availability} endpoint={`/partners/vehicles/${id}/availability`} onSaved={apply} />
            </Reveal>
          )}
        </div>
        <Reveal index={2} style={{ position: 'sticky', top: 90 }}>
          <Card>
            <Checklist items={view.submissionRequirements} title={t('partner.checklist')} />
            {editable && (
              <>
                <hr className="divider" />
                <ErrorText error={error} />
                <button type="button" style={{ width: '100%' }} disabled={!view.submissionRequirements.every((r) => r.done) || busy} onClick={() => void submit()}>
                  {t('partner.submitVehicle')}
                </button>
              </>
            )}
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
