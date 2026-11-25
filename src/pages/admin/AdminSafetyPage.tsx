import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { Card, ErrorText, Loading, TextArea } from '../../components/ui';
import { SlidingTabs } from '../../components/motion';
import { fmtKigali } from '../../components/time';

interface Report {
  id: string;
  bookingId: string;
  bookingRef: string;
  reporterRole: string;
  message: string;
  status: 'open' | 'resolved';
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

function ReportCard({ r, onDone }: { r: Report; onDone: () => void }) {
  const { t } = useTranslation();
  const [resolution, setResolution] = useState('');
  const [release, setRelease] = useState(false);
  const [error, setError] = useState<unknown>(null);
  return (
    <Card>
      <div className="row between">
        <strong>
          <Link to={`/admin/bookings/${r.bookingId}`}>{r.bookingRef}</Link> · {t('ops.reporter')}: {r.reporterRole}
        </strong>
        <span className="muted small">{fmtKigali(r.createdAt)}</span>
      </div>
      <p style={{ whiteSpace: 'pre-wrap' }}>{r.message}</p>
      {r.status === 'resolved' ? (
        <p className="notice good">{r.resolution}</p>
      ) : (
        <>
          <TextArea label={t('ops.resolution')} value={resolution} onChange={(e) => setResolution(e.target.value)} />
          {r.reporterRole === 'customer' && (
            <label className="row" style={{ marginBottom: '1rem', flexWrap: 'nowrap' }}>
              <input type="checkbox" checked={release} onChange={(e) => setRelease(e.target.checked)} /> {t('ops.release')}
            </label>
          )}
          <ErrorText error={error} />
          <button
            type="button"
            disabled={resolution.trim().length < 1}
            onClick={async () => {
              try {
                await api(`/admin/safety-reports/${r.id}/resolve`, { method: 'POST', body: { resolution: resolution.trim(), releaseDriver: release } });
                onDone();
              } catch (err) {
                setError(err);
              }
            }}
          >
            {t('ops.resolveReport')}
          </button>
        </>
      )}
    </Card>
  );
}

export function AdminSafetyPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'open' | 'resolved'>('open');
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(() => {
    api<{ reports: Report[] }>(`/admin/safety-reports?status=${status}`).then((r) => setReports(r.reports)).catch(setError);
  }, [status]);
  useEffect(load, [load]);
  return (
    <section className="grid">
      <h1 className="h2" style={{ margin: 0 }}>
        {t('ops.safetyTitle')}
      </h1>
      <SlidingTabs<'open' | 'resolved'>
        label={t('ops.safetyTitle')}
        value={status}
        onChange={setStatus}
        tabs={[
          { value: 'open', label: t('ops.safetyOpen') },
          { value: 'resolved', label: t('ops.safetyResolved') },
        ]}
      />
      <ErrorText error={error} />
      {!reports ? <Loading /> : reports.length === 0 ? <p className="card muted">{t('ops.safetyNone')}</p> : reports.map((r) => <ReportCard key={r.id} r={r} onDone={load} />)}
    </section>
  );
}
