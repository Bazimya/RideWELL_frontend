import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import type { StaffDashboard } from '../../api/types';
import { Card, ErrorText, Loading, StatusChip } from '../../components/ui';
import { Reveal } from '../../components/motion';
import { fmtKigali, fmtRwf, relative } from '../../components/time';
import { serviceLabel } from '../BookingsPage';

function Tile({ label, value, to, tone, index, testId }: { label: string; value: ReactNode; to?: string; tone?: 'warn' | 'bad'; index: number; testId?: string }) {
  const body = (
    <>
      <p className="eyebrow" style={{ marginBottom: '0.3rem' }}>
        {label}
      </p>
      <div className="big-amount" data-testid={testId}>
        {value}
      </div>
    </>
  );
  return (
    <Reveal index={index % 4} className={`card stat tile ${tone ? `tone-${tone}` : ''}`}>
      {to ? (
        <Link to={to} className="tile-link">
          {body}
        </Link>
      ) : (
        body
      )}
    </Reveal>
  );
}

/** What needs doing now. Each block appears only for the permissions this account holds. */
export function AdminOverviewPage() {
  const { t } = useTranslation();
  const [d, setD] = useState<StaffDashboard | null>(null);
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(() => {
    api<StaffDashboard>('/admin/dashboard').then(setD).catch(setError);
  }, []);
  useEffect(() => {
    load();
    const iv = window.setInterval(load, 60_000);
    return () => window.clearInterval(iv);
  }, [load]);
  if (!d) return error ? <ErrorText error={error} /> : <Loading />;
  const n = (v: number, tone: 'warn' | 'bad' = 'warn') => (v > 0 ? tone : undefined);
  let i = 0;

  return (
    <section className="grid" data-testid="admin-overview">
      <div className="row between">
        <h1 className="h2" style={{ margin: 0 }}>
          {t('overview.title')}
        </h1>
        <span className="muted small">{t('overview.updated', { time: fmtKigali(d.generatedAt, { hour: '2-digit', minute: '2-digit' }) })}</span>
      </div>

      {d.notifications?.providers.isDevelopment && <p className="notice warn">{t('overview.devProviders', { sms: d.notifications.providers.sms, email: d.notifications.providers.email })}</p>}
      {d.finance && d.finance.developmentPayments > 0 && <p className="notice warn">{t('overview.devPayments', { count: d.finance.developmentPayments })}</p>}

      {d.bookings && (
        <div className="grid-4">
          <Tile index={i++} label={t('overview.awaitingQuote')} value={d.bookings.awaitingQuote} to="/admin/bookings" tone={n(d.bookings.awaitingQuote)} testId="tile-awaiting-quote" />
          <Tile index={i++} label={t('overview.awaitingPayment')} value={d.bookings.awaitingPayment} to="/admin/bookings" />
          <Tile index={i++} label={t('overview.awaitingAcceptance')} value={d.bookings.awaitingAcceptance} to="/admin/bookings" />
          <Tile index={i++} label={t('overview.needsReassignment')} value={d.bookings.needsReassignment} to="/admin/bookings" tone={n(d.bookings.needsReassignment, 'bad')} />
          <Tile index={i++} label={t('overview.inProgress')} value={d.bookings.inProgress} to="/admin/bookings" />
          <Tile index={i++} label={t('overview.openAlerts')} value={d.bookings.openAlerts} to="/admin/bookings" tone={n(d.bookings.openAlerts)} />
          {d.safety && <Tile index={i++} label={t('overview.safety')} value={d.safety.openReports} to="/admin/safety" tone={n(d.safety.openReports, 'bad')} />}
          {d.support && <Tile index={i++} label={t('overview.support')} value={d.support.open} to="/admin/support" tone={n(d.support.open)} testId="tile-support" />}
        </div>
      )}
      {!d.bookings && (d.safety || d.support) && (
        <div className="grid-4">
          {d.safety && <Tile index={i++} label={t('overview.safety')} value={d.safety.openReports} to="/admin/safety" tone={n(d.safety.openReports, 'bad')} />}
          {d.support && <Tile index={i++} label={t('overview.support')} value={d.support.open} to="/admin/support" tone={n(d.support.open)} />}
        </div>
      )}

      {d.partners && (
        <div className="grid-4">
          <Tile index={i++} label={t('overview.driverApps')} value={d.partners.applications.drivers} to="/admin/applications" tone={n(d.partners.applications.drivers)} />
          <Tile index={i++} label={t('overview.ownerApps')} value={d.partners.applications.owners + d.partners.applications.vehicles} to="/admin/applications" tone={n(d.partners.applications.owners + d.partners.applications.vehicles)} />
          <Tile index={i++} label={t('overview.docsToReview')} value={d.partners.documentsToReview} to="/admin/applications" />
          <Tile index={i++} label={t('overview.docsExpiring')} value={d.partners.documentsExpiring30Days} tone={n(d.partners.documentsExpiring30Days)} />
        </div>
      )}

      {(d.finance || d.notifications) && (
        <div className="grid-4">
          {d.finance && (
            <>
              <Tile index={i++} label={t('overview.refunds')} value={d.finance.refundsAwaitingApproval} to="/admin/finance" tone={n(d.finance.refundsAwaitingApproval)} />
              <Tile index={i++} label={t('overview.payable')} value={<>{fmtRwf(d.finance.payableRwf)} <span className="muted small">RWF</span></>} to="/admin/finance" />
            </>
          )}
          {d.notifications && (
            <>
              <Tile index={i++} label={t('overview.failedMessages')} value={d.notifications.failedLast7Days} to="/admin/notifications" tone={n(d.notifications.failedLast7Days, 'bad')} />
              <Tile index={i++} label={t('overview.pendingMessages')} value={d.notifications.pending} to="/admin/notifications" />
            </>
          )}
        </div>
      )}

      {d.bookings && (
        <div className="grid-2">
          <Card title={t('overview.today', { count: d.bookings.today.length })}>
            {d.bookings.today.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                {t('overview.noTrips')}
              </p>
            ) : (
              <ul className="plain-list">
                {d.bookings.today.map((b) => (
                  <li key={b.id} className="row between">
                    <Link to={`/admin/bookings/${b.id}`}>
                      {fmtKigali(b.startAt, { hour: '2-digit', minute: '2-digit' })} · {b.ref} · {serviceLabel(t, b)}
                    </Link>
                    <StatusChip status={b.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={t('ops.alerts')}>
            {d.bookings.recentAlerts.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                {t('ops.noAlerts')}
              </p>
            ) : (
              <ul className="plain-list">
                {d.bookings.recentAlerts.map((a) => (
                  <li key={a.id}>
                    <span className={`chip ${a.severity === 'high' ? 's-disputed' : ''}`}>{t(`overview.alert_${a.type}`, { defaultValue: a.type.replace(/_/g, ' ') })}</span>{' '}
                    {a.bookingId ? <Link to={`/admin/bookings/${a.bookingId}`}>{a.message}</Link> : a.message}
                    <span className="muted small"> · {relative(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
      {Object.keys(d).length === 1 && <p className="muted">{t('admin.noAccess')}</p>}
    </section>
  );
}
