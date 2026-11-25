import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { EarningTotals, MyDashboard, TripOffer } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Card, ErrorText, Loading, StatusChip } from '../components/ui';
import { Reveal } from '../components/motion';
import { fmtKigali, fmtRwf } from '../components/time';
import { ServiceIcon, serviceLabel } from './BookingsPage';

function Stat({ label, value, hint, testId, index = 0 }: { label: string; value: ReactNode; hint?: string; testId?: string; index?: number }) {
  return (
    <Reveal index={index} className="card stat">
      <p className="eyebrow" style={{ marginBottom: '0.3rem' }}>
        {label}
      </p>
      <div className="big-amount" data-testid={testId}>
        {value}
      </div>
      {hint && <p className="hint">{hint}</p>}
    </Reveal>
  );
}

function Offers({ offers, to }: { offers: TripOffer[]; to: (id: string) => string }) {
  const { t } = useTranslation();
  if (!offers.length) return null;
  return (
    <div className="notice warn" data-testid="dash-offers">
      <strong>{t('dash.offers', { count: offers.length })}</strong>
      <ul className="plain-list">
        {offers.map((o) => (
          <li key={o.id}>
            <Link to={to(o.id)}>{o.ref}</Link> · {fmtKigali(o.startAt)}
            {o.deadline && <span className="muted"> · {t('dash.answerBy', { time: fmtKigali(o.deadline) })}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Money({ e }: { e: EarningTotals }) {
  const { t } = useTranslation();
  return (
    <p className="muted small" style={{ margin: 0 }}>
      {t('earnings.held')}: <strong style={{ color: 'var(--text)' }}>{fmtRwf(e.held + e.pending)} RWF</strong> · {t('earnings.payable')}:{' '}
      <strong style={{ color: 'var(--text)' }}>{fmtRwf(e.payable)} RWF</strong> · {t('earnings.paid')}: {fmtRwf(e.paid)} RWF
    </p>
  );
}

/** The signed-in home: what to do next, what is coming up, and (for partners) the work and the money. */
export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [d, setD] = useState<MyDashboard | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    api<MyDashboard>('/me/dashboard').then(setD).catch(setError);
  }, []);
  if (!user) return null;

  return (
    <div className="page container" style={{ maxWidth: 980 }}>
      <Reveal className="page-head">
        <div>
          <p className="eyebrow">{t('dash.eyebrow')}</p>
          <h1>{user.firstName ? t('dash.hello', { name: user.firstName }) : t('dash.helloNoName')}</h1>
        </div>
        <Link to="/book" className="btn">
          {t('nav.book')}
        </Link>
      </Reveal>
      <ErrorText error={error} />
      {!d ? (
        <Loading />
      ) : (
        <div className="grid">
          {/* ---- next steps ---- */}
          {d.customer.actions.length > 0 && (
            <Reveal>
              <Card title={t('dash.todo')}>
                <ul className="plain-list" data-testid="dash-actions">
                  {d.customer.actions.map((a) => (
                    <li key={`${a.kind}-${a.bookingId}`} className="row between">
                      <span>
                        {a.kind === 'pay_quote' ? t('dash.payQuote', { ref: a.ref }) : t('dash.rateDriver', { ref: a.ref })}
                        {a.until && <span className="muted small"> · {t('dash.until', { time: fmtKigali(a.until) })}</span>}
                      </span>
                      <Link className="btn small" to={`/bookings/${a.bookingId}`}>
                        {a.kind === 'pay_quote' ? t('dash.payNow') : t('dash.rateNow')}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </Reveal>
          )}

          {/* ---- driver ---- */}
          {d.driver && (
            <Reveal>
              <Card title={t('dash.driverTitle')} actions={<StatusChip status={d.driver.profileStatus} />}>
                {d.driver.onSafetyHold && <p className="notice bad">{t('dash.safetyHold')}</p>}
                {d.driver.profileStatus === 'approved' && !d.driver.acceptingTrips && <p className="notice">{t('dash.notAccepting')}</p>}
                {d.driver.expiringDocuments > 0 && (
                  <p className="notice warn">
                    {t('dash.expiring', { count: d.driver.expiringDocuments })} <Link to="/partner/driver">{t('dash.update')}</Link>
                  </p>
                )}
                <Offers offers={d.driver.offers} to={(id) => `/driver/trips/${id}`} />
                {d.driver.next && (
                  <p data-testid="dash-next-trip">
                    {t('dash.nextTrip')}: <Link to={`/driver/trips/${d.driver.next.id}`}>{d.driver.next.ref}</Link> · {fmtKigali(d.driver.next.startAt)} <StatusChip status={d.driver.next.status} />
                  </p>
                )}
                <div className="grid-4">
                  <Stat index={0} label={t('dash.upcoming')} value={d.driver.upcomingCount} />
                  <Stat index={1} label={t('dash.thisMonth')} value={d.driver.completedThisMonth} hint={t('dash.allTime', { count: d.driver.completedAllTime })} />
                  <Stat
                    index={2}
                    label={t('dash.rating')}
                    testId="dash-rating"
                    value={d.driver.rating.average === null ? '—' : `${d.driver.rating.average.toFixed(1)} ★`}
                    hint={t('dash.ratings', { count: d.driver.rating.count })}
                  />
                  <Stat index={3} label={t('earnings.payable')} value={<>{fmtRwf(d.driver.earnings.payable)} <span className="muted small">RWF</span></>} />
                </div>
                <Money e={d.driver.earnings} />
                <p className="row" style={{ gap: '1rem', marginBottom: 0 }}>
                  <Link to="/driver/trips">{t('nav.trips')} →</Link>
                  <Link to="/earnings">{t('nav.earnings')} →</Link>
                </p>
              </Card>
            </Reveal>
          )}

          {/* ---- vehicle owner ---- */}
          {d.owner && (
            <Reveal>
              <Card title={t('dash.ownerTitle')} actions={<StatusChip status={d.owner.profileStatus} />}>
                {d.owner.expiringDocuments > 0 && (
                  <p className="notice warn">
                    {t('dash.expiring', { count: d.owner.expiringDocuments })} <Link to="/partner/owner">{t('dash.update')}</Link>
                  </p>
                )}
                <Offers offers={d.owner.offers} to={() => '/owner/trips'} />
                <div className="grid-4">
                  <Stat index={0} label={t('dash.vehicles')} value={d.owner.vehicles.filter((v) => v.status === 'approved').length} hint={t('dash.vehiclesHint', { count: d.owner.vehicles.length })} />
                  <Stat index={1} label={t('dash.inProgress')} value={d.owner.inProgress} />
                  <Stat index={2} label={t('dash.upcoming')} value={d.owner.upcomingCount} hint={t('dash.allTime', { count: d.owner.completedAllTime })} />
                  <Stat index={3} label={t('earnings.payable')} value={<>{fmtRwf(d.owner.earnings.payable)} <span className="muted small">RWF</span></>} />
                </div>
                {d.owner.vehicles.length > 0 && (
                  <ul className="plain-list">
                    {d.owner.vehicles.map((v) => (
                      <li key={v.id} className="row between">
                        <Link to={`/partner/vehicles/${v.id}`}>{v.label}</Link> <StatusChip status={v.status} />
                      </li>
                    ))}
                  </ul>
                )}
                <Money e={d.owner.earnings} />
                <p className="row" style={{ gap: '1rem', marginBottom: 0 }}>
                  <Link to="/owner/trips">{t('nav.trips')} →</Link>
                  <Link to="/earnings">{t('nav.earnings')} →</Link>
                </p>
              </Card>
            </Reveal>
          )}

          {/* ---- customer bookings ---- */}
          <Reveal>
            <Card title={t('dash.yourBookings')} actions={<Link to="/bookings">{t('dash.all', { count: d.customer.totals.bookings })} →</Link>}>
              {d.customer.upcoming.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>
                  {t('dash.noUpcoming')} <Link to="/book">{t('dash.bookFirst')}</Link>
                </p>
              ) : (
                <ul className="plain-list" data-testid="dash-upcoming">
                  {d.customer.upcoming.map((b) => (
                    <li key={b.id} className="row between">
                      <Link to={`/bookings/${b.id}`} className="row" style={{ gap: '0.5rem' }}>
                        <ServiceIcon b={b} /> {serviceLabel(t, b)} · {fmtKigali(b.startAt)}
                      </Link>
                      <StatusChip status={b.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </Reveal>

          <Reveal className="row" style={{ gap: '1rem' }}>
            <Link to="/support" className="btn ghost">
              {t('support.nav')}
              {d.customer.openSupport > 0 && ` · ${t('support.openCount', { count: d.customer.openSupport })}`}
            </Link>
            <Link to="/notifications" className="btn ghost">
              {t('inbox.title')}
            </Link>
          </Reveal>
        </div>
      )}
    </div>
  );
}
