import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import type { DeliveryRow } from '../../api/types';
import { ErrorText, Loading, SelectField, StatusChip } from '../../components/ui';
import { fmtKigali } from '../../components/time';

interface Log {
  providers: { sms: string; email: string; isDevelopment: boolean };
  last7Days: Record<DeliveryRow['status'], number>;
  notifications: DeliveryRow[];
  nextBefore: string | null;
}

/** SMS and email delivery log. Message text is shown as stored: secrets such as trip PINs are masked. */
export function AdminNotificationsPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState('');
  const [log, setLog] = useState<Log | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const load = useCallback(() => {
    api<Log>(`/admin/notifications${status ? `?status=${status}` : ''}`).then(setLog).catch(setError);
  }, [status]);
  useEffect(load, [load]);

  const resend = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await api(`/admin/notifications/${id}/resend`, { method: 'POST' });
      load();
    } catch (err) {
      setError(err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="grid">
      <h1 className="h2" style={{ margin: 0 }}>
        {t('deliveries.title')}
      </h1>
      {log && (
        <>
          <p className={`notice ${log.providers.isDevelopment ? 'warn' : ''}`} data-testid="providers">
            {t('deliveries.providers', { sms: log.providers.sms, email: log.providers.email })}
            {log.providers.isDevelopment && ` ${t('deliveries.devHint')}`}
          </p>
          <p className="muted small" style={{ margin: 0 }}>
            {t('deliveries.week', { sent: log.last7Days.sent, failed: log.last7Days.failed, pending: log.last7Days.pending, skipped: log.last7Days.skipped })}
          </p>
        </>
      )}
      <div style={{ maxWidth: 260 }}>
        <SelectField label={t('deliveries.filter')} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('deliveries.all')}</option>
          {['failed', 'pending', 'sent', 'skipped'].map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`, { defaultValue: s })}
            </option>
          ))}
        </SelectField>
      </div>
      <ErrorText error={error} />
      {!log ? (
        <Loading />
      ) : log.notifications.length === 0 ? (
        <p className="muted">{t('deliveries.none')}</p>
      ) : (
        <div className="table-wrap">
          <table data-testid="deliveries">
            <thead>
              <tr>
                <th scope="col">{t('deliveries.when')}</th>
                <th scope="col">{t('deliveries.message')}</th>
                <th scope="col">{t('deliveries.to')}</th>
                <th scope="col">{t('deliveries.status')}</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {log.notifications.map((n) => (
                <tr key={n.id}>
                  <td className="small">{fmtKigali(n.createdAt)}</td>
                  <td>
                    <strong className="small">{n.title}</strong>
                    <div className="muted small">{n.body}</div>
                  </td>
                  <td className="small">
                    {n.channel === 'none' ? '—' : `${n.channel.toUpperCase()} ${n.to ?? ''}`}
                    {n.provider && <div className="muted">{n.provider}</div>}
                  </td>
                  <td>
                    <StatusChip status={n.status} />
                    {n.attempts > 1 && <div className="muted small">{t('deliveries.attempts', { count: n.attempts })}</div>}
                    {n.lastError && <div className="small" style={{ color: 'var(--danger)' }}>{n.lastError}</div>}
                  </td>
                  <td>
                    {n.status === 'failed' && n.resendable && (
                      <button type="button" className="ghost small" disabled={busyId === n.id} onClick={() => void resend(n.id)}>
                        {t('deliveries.resend')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
