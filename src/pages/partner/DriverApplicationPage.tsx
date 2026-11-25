import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import type { DocView, DriverView } from '../../api/types';
import { Card, ErrorText, Field, Loading, StatusChip, TextArea, splitList, toDateInput } from '../../components/ui';
import { Checklist, StatusTimeline, UploadTile } from '../../components/partner';
import { Reveal } from '../../components/motion';
import { AvailabilityEditor, StatusNotice } from './shared';

const DOC_KINDS: Array<{ kind: string; imagesOnly?: boolean }> = [
  { kind: 'id_document' },
  { kind: 'driving_licence' },
  { kind: 'profile_photo', imagesOnly: true },
  { kind: 'good_conduct_certificate' },
];

export function DriverApplicationPage() {
  const { t } = useTranslation();
  const [view, setView] = useState<DriverView | null>(null);
  const [form, setForm] = useState({ contactPhone: '', licenceNumber: '', licenceExpiry: '', licenceCategories: '', experienceYears: '', areas: '', languages: '', bio: '' });
  const [refs, setRefs] = useState<Array<{ name: string; phone: string; relationship: string }>>([]);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const apply = useCallback((v: DriverView) => {
    setView(v);
    const p = v.profile;
    setForm({
      contactPhone: p.contactPhone ?? '',
      licenceNumber: p.licenceNumber ?? '',
      licenceExpiry: toDateInput(p.licenceExpiry),
      licenceCategories: p.licenceCategories.join(', '),
      experienceYears: p.experienceYears?.toString() ?? '',
      areas: p.areas.join(', '),
      languages: p.languages.join(', '),
      bio: p.bio ?? '',
    });
    setRefs(p.references.length ? p.references : [{ name: '', phone: '', relationship: '' }, { name: '', phone: '', relationship: '' }]);
  }, []);

  useEffect(() => {
    api<DriverView>('/partners/driver').then(apply).catch(setError);
  }, [apply]);

  if (!view) return <div className="page container">{error ? <ErrorText error={error} /> : <Loading />}</div>;
  const p = view.profile;
  const editable = p.status === 'draft' || p.status === 'rejected';

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const body: Record<string, unknown> = {
        licenceCategories: splitList(form.licenceCategories),
        areas: splitList(form.areas),
        languages: splitList(form.languages),
        bio: form.bio.trim() || null,
        references: refs.filter((r) => r.name || r.phone || r.relationship),
      };
      if (form.contactPhone) body.contactPhone = form.contactPhone;
      if (form.licenceNumber) body.licenceNumber = form.licenceNumber;
      if (form.licenceExpiry) body.licenceExpiry = new Date(form.licenceExpiry).toISOString();
      if (form.experienceYears) body.experienceYears = Number(form.experienceYears);
      apply(await api<DriverView>('/partners/driver', { method: 'PUT', body }));
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
      apply(await api<DriverView>('/partners/driver/submit', { method: 'POST' }));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (d: DocView) => {
    await api(`/partners/documents/${d.id}`, { method: 'DELETE' }).catch(setError);
    apply(await api<DriverView>('/partners/driver'));
  };
  const allDone = view.submissionRequirements.every((r) => r.done);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="page container">
      <Reveal className="page-head">
        <div>
          <p className="eyebrow">{t('partner.driverEyebrow')}</p>
          <h1>{t('partner.driverTitle')}</h1>
        </div>
        <StatusChip status={p.status} />
      </Reveal>
      <Reveal index={1}>
        <StatusTimeline status={p.status} />
        <StatusNotice status={p.status} reason={p.decisionReason} approvedText={t('partner.approvedDriver')} />
      </Reveal>

      <div className="split">
        <div className="grid">
          <Reveal index={2}>
            <Card title={t('partner.details')}>
              <form onSubmit={save} noValidate>
                <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0 }}>
                  <div className="form-grid">
                    <Field className="span-2" label={t('partner.contactPhone')} type="tel" value={form.contactPhone} onChange={set('contactPhone')} />
                    <Field label={t('partner.licenceNumber')} value={form.licenceNumber} onChange={set('licenceNumber')} />
                    <Field label={t('partner.licenceExpiry')} type="date" value={form.licenceExpiry} onChange={set('licenceExpiry')} />
                    <Field label={t('partner.licenceCategories')} value={form.licenceCategories} onChange={set('licenceCategories')} />
                    <Field label={t('partner.experienceYears')} type="number" min={0} max={60} value={form.experienceYears} onChange={set('experienceYears')} />
                    <Field label={t('partner.areas')} value={form.areas} onChange={set('areas')} />
                    <Field label={t('partner.languages')} value={form.languages} onChange={set('languages')} />
                    <TextArea className="span-2" label={t('partner.bio')} maxLength={600} value={form.bio} onChange={set('bio')} />
                  </div>
                  <h3 style={{ marginTop: '0.5rem' }}>{t('partner.references')}</h3>
                  <p className="hint" style={{ marginBottom: '1rem' }}>
                    {t('partner.referencesHint')}
                  </p>
                  {refs.map((r, i) => (
                    <div key={i} className="form-grid" style={{ gridTemplateColumns: undefined }}>
                      <Field label={`${t('partner.refName')} ${i + 1}`} value={r.name} onChange={(e) => setRefs(refs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                      <Field label={`${t('partner.refPhone')} ${i + 1}`} type="tel" value={r.phone} onChange={(e) => setRefs(refs.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} />
                      <Field
                        className="span-2"
                        label={`${t('partner.refRelationship')} ${i + 1}`}
                        value={r.relationship}
                        onChange={(e) => setRefs(refs.map((x, j) => (j === i ? { ...x, relationship: e.target.value } : x)))}
                      />
                    </div>
                  ))}
                  {refs.length < 3 && editable && (
                    <button type="button" className="link" onClick={() => setRefs([...refs, { name: '', phone: '', relationship: '' }])}>
                      + {t('partner.addReference')}
                    </button>
                  )}
                  {editable && (
                    <div className="row" style={{ marginTop: '1.25rem' }}>
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
                  <UploadTile<DriverView>
                    key={kind}
                    kind={kind}
                    docs={view.documents}
                    endpoint="/partners/driver/documents"
                    imagesOnly={imagesOnly}
                    disabled={p.status === 'suspended'}
                    onUploaded={apply}
                    onRemove={editable ? remove : undefined}
                  />
                ))}
              </div>
            </Card>
          </Reveal>

          {p.status === 'approved' && (
            <Reveal index={4}>
              <AvailabilityEditor<DriverView> value={p.availability} endpoint="/partners/driver/availability" onSaved={apply} />
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
                <button type="button" style={{ width: '100%' }} disabled={!allDone || busy} onClick={() => void submit()}>
                  {t('partner.submit')}
                </button>
              </>
            )}
            {!editable && <ErrorText error={error} />}
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
