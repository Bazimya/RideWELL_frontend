import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import type { Availability, PartnerStatus } from '../../api/types';
import { Card, ErrorText, Field } from '../../components/ui';

/** The banner under the timeline: what the current status means for the partner. */
export function StatusNotice({ status, reason, approvedText }: { status: PartnerStatus; reason: string | null; approvedText?: string }) {
  const { t } = useTranslation();
  if (status === 'rejected')
    return (
      <div className="notice bad" role="status">
        <strong>{t('partner.rejectedTitle')}</strong>
        {reason && <p style={{ margin: '0.3rem 0 0' }}>{reason}</p>}
      </div>
    );
  if (status === 'applied' || status === 'under_review')
    return (
      <div className="notice warn" role="status">
        {t('partner.locked')}
      </div>
    );
  if (status === 'approved')
    return (
      <div className="notice good" role="status">
        <strong>{t('partner.approvedTitle')}</strong>
        {approvedText && <p style={{ margin: '0.3rem 0 0' }}>{approvedText}</p>}
      </div>
    );
  if (status === 'suspended')
    return (
      <div className="notice bad" role="status">
        <strong>{t('partner.suspendedTitle')}</strong> {t('partner.suspendedText')}
      </div>
    );
  return null;
}

const local = (iso: string) => iso.slice(0, 16);

export function AvailabilityEditor<T>({ value, endpoint, onSaved }: { value: Availability; endpoint: string; onSaved: (v: T) => void }) {
  const { t } = useTranslation();
  const [accepting, setAccepting] = useState(value.acceptingTrips);
  const [periods, setPeriods] = useState(value.unavailable.map((p) => ({ from: local(p.from), to: local(p.to), note: p.note ?? '' })));
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setError(null);
    setSaved(false);
    try {
      onSaved(
        await api<T>(endpoint, {
          method: 'PUT',
          body: {
            acceptingTrips: accepting,
            unavailable: periods.filter((p) => p.from && p.to).map((p) => ({ from: new Date(p.from).toISOString(), to: new Date(p.to).toISOString(), note: p.note || null })),
          },
        }),
      );
      setSaved(true);
    } catch (err) {
      setError(err);
    }
  };

  return (
    <Card title={t('partner.availability')}>
      <label className="row" style={{ marginBottom: '1.25rem', cursor: 'pointer' }}>
        <input type="checkbox" checked={accepting} onChange={(e) => setAccepting(e.target.checked)} />
        <strong>{t('partner.accepting')}</strong>
      </label>
      <h3>{t('partner.unavailable')}</h3>
      {periods.map((p, i) => (
        <div key={i} className="form-grid">
          <Field label={t('partner.from')} type="datetime-local" value={p.from} onChange={(e) => setPeriods(periods.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)))} />
          <Field label={t('partner.to')} type="datetime-local" value={p.to} onChange={(e) => setPeriods(periods.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))} />
        </div>
      ))}
      <button type="button" className="link" onClick={() => setPeriods([...periods, { from: '', to: '', note: '' }])}>
        + {t('partner.addPeriod')}
      </button>
      <ErrorText error={error} />
      <div className="row" style={{ marginTop: '1rem' }}>
        <button type="button" onClick={() => void save()}>
          {t('partner.saveAvailability')}
        </button>
        {saved && (
          <span className="success" role="status">
            {t('account.saved')}
          </span>
        )}
      </div>
    </Card>
  );
}
