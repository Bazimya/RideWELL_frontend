import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import type { DocView, OwnerView, VehicleView } from '../../api/types';
import { Card, ErrorText, Field, Loading, SelectField, StatusChip } from '../../components/ui';
import { Checklist, StatusTimeline, UploadTile } from '../../components/partner';
import { Reveal } from '../../components/motion';
import { IconArrow, IconCar } from '../../components/icons';
import { StatusNotice } from './shared';
import { VehicleForm, emptyVehicle, vehicleBody, type VehicleFormState } from './VehiclePage';

export function OwnerPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [view, setView] = useState<OwnerView | null>(null);
  const [form, setForm] = useState({ contactPhone: '', type: 'individual' as 'individual' | 'company', companyName: '', rdbNumber: '', tinNumber: '', representativeName: '' });
  const [payout, setPayout] = useState({ method: 'momo' as 'momo' | 'bank', momoPhone: '', momoName: '', bankName: '', accountName: '', accountNumber: '' });
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [vehicle, setVehicle] = useState<VehicleFormState>(emptyVehicle);
  const [vError, setVError] = useState<unknown>(null);

  const apply = useCallback((v: OwnerView) => {
    setView(v);
    const p = v.profile;
    setForm({
      contactPhone: p.contactPhone ?? '',
      type: p.type ?? 'individual',
      companyName: p.companyName ?? '',
      rdbNumber: p.rdbNumber ?? '',
      tinNumber: p.tinNumber ?? '',
      representativeName: p.representativeName ?? '',
    });
    if (p.payout)
      setPayout({
        method: p.payout.method,
        momoPhone: p.payout.momoPhone ?? '',
        momoName: p.payout.momoName ?? '',
        bankName: p.payout.bankName ?? '',
        accountName: p.payout.accountName ?? '',
        accountNumber: p.payout.accountNumber ?? '',
      });
  }, []);

  useEffect(() => {
    api<OwnerView>('/partners/owner').then(apply).catch(setError);
  }, [apply]);

  if (!view) return <div className="page container">{error ? <ErrorText error={error} /> : <Loading />}</div>;
  const p = view.profile;
  const editable = p.status === 'draft' || p.status === 'rejected';
  const company = form.type === 'company';
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  const setP = (k: keyof typeof payout) => (e: { target: { value: string } }) => setPayout({ ...payout, [k]: e.target.value });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const body: Record<string, unknown> = { type: form.type };
      if (form.contactPhone) body.contactPhone = form.contactPhone;
      if (company) Object.assign(body, { companyName: form.companyName || null, rdbNumber: form.rdbNumber || null, tinNumber: form.tinNumber || null, representativeName: form.representativeName || null });
      const hasPayout = payout.method === 'momo' ? payout.momoPhone && payout.momoName : payout.bankName && payout.accountName && payout.accountNumber;
      if (hasPayout)
        body.payout =
          payout.method === 'momo'
            ? { method: 'momo', momoPhone: payout.momoPhone, momoName: payout.momoName }
            : { method: 'bank', bankName: payout.bankName, accountName: payout.accountName, accountNumber: payout.accountNumber };
      apply(await api<OwnerView>('/partners/owner', { method: 'PUT', body }));
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
      apply(await api<OwnerView>('/partners/owner/submit', { method: 'POST' }));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const createVehicle = async (e: FormEvent) => {
    e.preventDefault();
    setVError(null);
    try {
      const res = await api<VehicleView>('/partners/vehicles', { method: 'POST', body: vehicleBody(vehicle) });
      navigate(`/partner/vehicles/${res.vehicle.id}`);
    } catch (err) {
      setVError(err);
    }
  };

  const remove = async (d: DocView) => {
    await api(`/partners/documents/${d.id}`, { method: 'DELETE' }).catch(setError);
    apply(await api<OwnerView>('/partners/owner'));
  };

  return (
    <div className="page container">
      <Reveal className="page-head">
        <div>
          <p className="eyebrow">{t('partner.ownerEyebrow')}</p>
          <h1>{t('partner.ownerTitle')}</h1>
        </div>
        <StatusChip status={p.status} />
      </Reveal>
      <Reveal index={1}>
        <StatusTimeline status={p.status} />
        <StatusNotice status={p.status} reason={p.decisionReason} />
      </Reveal>

      <div className="split">
        <div className="grid">
          <Reveal index={2}>
            <Card title={t('partner.details')}>
              <form onSubmit={save} noValidate>
                <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0 }}>
                  <SelectField label={t('partner.ownerType')} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'individual' | 'company' })}>
                    <option value="individual">{t('partner.individual')}</option>
                    <option value="company">{t('partner.company')}</option>
                  </SelectField>
                  <Field label={t('partner.contactPhone')} type="tel" value={form.contactPhone} onChange={set('contactPhone')} />
                  {company && (
                    <div className="form-grid">
                      <Field className="span-2" label={t('partner.companyName')} value={form.companyName} onChange={set('companyName')} />
                      <Field label={t('partner.rdbNumber')} value={form.rdbNumber} onChange={set('rdbNumber')} />
                      <Field label={t('partner.tinNumber')} value={form.tinNumber} onChange={set('tinNumber')} />
                      <Field className="span-2" label={t('partner.representativeName')} value={form.representativeName} onChange={set('representativeName')} />
                    </div>
                  )}
                  <h3 style={{ marginTop: '0.5rem' }}>{t('partner.payout')}</h3>
                  <SelectField label={t('partner.payout')} value={payout.method} onChange={(e) => setPayout({ ...payout, method: e.target.value as 'momo' | 'bank' })}>
                    <option value="momo">{t('partner.payoutMomo')}</option>
                    <option value="bank">{t('partner.payoutBank')}</option>
                  </SelectField>
                  {payout.method === 'momo' ? (
                    <div className="form-grid">
                      <Field label={t('partner.momoPhone')} type="tel" value={payout.momoPhone} onChange={setP('momoPhone')} />
                      <Field label={t('partner.momoName')} value={payout.momoName} onChange={setP('momoName')} />
                    </div>
                  ) : (
                    <div className="form-grid">
                      <Field label={t('partner.bankName')} value={payout.bankName} onChange={setP('bankName')} />
                      <Field label={t('partner.accountName')} value={payout.accountName} onChange={setP('accountName')} />
                      <Field className="span-2" label={t('partner.accountNumber')} value={payout.accountNumber} onChange={setP('accountNumber')} />
                    </div>
                  )}
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
                {['id_document', ...(company ? ['rdb_certificate', 'authorisation_letter'] : [])].map((kind) => (
                  <UploadTile<OwnerView> key={kind} kind={kind} docs={view.documents} endpoint="/partners/owner/documents" disabled={p.status === 'suspended'} onUploaded={apply} onRemove={editable ? remove : undefined} />
                ))}
              </div>
            </Card>
          </Reveal>

          <Reveal index={4}>
            <Card
              title={t('partner.vehicles')}
              actions={
                !adding &&
                p.status !== 'suspended' &&
                p.status !== 'rejected' && (
                  <button type="button" className="small" onClick={() => setAdding(true)}>
                    + {t('partner.addVehicle')}
                  </button>
                )
              }
            >
              {view.vehicles.length === 0 && !adding && <p className="muted">{t('partner.noVehicles')}</p>}
              <div className="grid">
                {view.vehicles.map((v) => (
                  <Link key={v.id} to={`/partner/vehicles/${v.id}`} className="card flat lift row" style={{ textDecoration: 'none', padding: '1rem 1.25rem' }}>
                    <div className="icon-tile" style={{ margin: 0 }}>
                      <IconCar />
                    </div>
                    <div style={{ flex: 1 }}>
                      <strong>
                        {v.make} {v.model} · {v.year}
                      </strong>
                      <p className="muted small" style={{ margin: 0 }}>
                        {v.plate} · {v.colour}
                      </p>
                    </div>
                    <StatusChip status={v.status} />
                    <IconArrow />
                  </Link>
                ))}
              </div>
              {adding && (
                <form onSubmit={createVehicle} noValidate className="page-enter" style={{ marginTop: '1rem' }}>
                  <h3>{t('partner.newVehicle')}</h3>
                  <VehicleForm value={vehicle} onChange={setVehicle} />
                  <ErrorText error={vError} />
                  <div className="row">
                    <button type="submit">{t('partner.createVehicle')}</button>
                    <button type="button" className="ghost" onClick={() => setAdding(false)}>
                      {t('common.cancel')}
                    </button>
                  </div>
                </form>
              )}
            </Card>
          </Reveal>
        </div>

        <Reveal index={2} style={{ position: 'sticky', top: 90 }}>
          <Card>
            <Checklist items={view.submissionRequirements} title={t('partner.checklist')} />
            {editable && (
              <>
                <hr className="divider" />
                <ErrorText error={error} />
                <button type="button" style={{ width: '100%' }} disabled={!view.submissionRequirements.every((r) => r.done) || busy} onClick={() => void submit()}>
                  {t('partner.submit')}
                </button>
              </>
            )}
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
