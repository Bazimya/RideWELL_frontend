import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api, authorizedBlobUrl } from '../../api/client';
import type { FinanceReport, MoneyTotals, OperationsReport } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { Card, ErrorText, Field, Loading } from '../../components/ui';
import { SlidingTabs } from '../../components/motion';
import { fmtRwf } from '../../components/time';
import { BarChart } from '../../components/charts/BarChart';

const KIGALI = 2 * 3_600_000;
const kigaliDate = (d: Date) => new Date(d.getTime() + KIGALI).toISOString().slice(0, 10);
const daysAgo = (n: number) => kigaliDate(new Date(Date.now() - n * 86_400_000));
const short = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const rwf = (n: number) => `${fmtRwf(n)} RWF`;

function Kv({ rows }: { rows: Array<[string, string | number]> }) {
  return (
    <dl className="facts">
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}>
          <dt>{k}</dt>
          <dd className="num" style={{ textAlign: 'left' }}>
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Operations({ r }: { r: OperationsReport }) {
  const { t } = useTranslation();
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
  const mins = (m: number | null) => (m === null ? '—' : m < 120 ? `${m} min` : `${Math.round(m / 6) / 10} h`);
  return (
    <div className="grid" data-testid="report-operations">
      <div className="grid-4">
        <div className="card stat">
          <p className="eyebrow">{t('reports.requests')}</p>
          <div className="big-amount" data-testid="report-requests">{r.requests.total}</div>
        </div>
        <div className="card stat">
          <p className="eyebrow">{t('reports.completedTrips')}</p>
          <div className="big-amount" data-testid="report-completed">{r.trips.completed}</div>
          <p className="hint">{t('reports.hours', { hours: r.trips.hours })}</p>
        </div>
        <div className="card stat">
          <p className="eyebrow">{t('reports.conversion')}</p>
          <div className="big-amount">{pct(r.funnel.paid, r.funnel.requested)}</div>
          <p className="hint">{t('reports.conversionHint')}</p>
        </div>
        <div className="card stat">
          <p className="eyebrow">{t('reports.rating')}</p>
          <div className="big-amount">{r.ratings.average === null ? '—' : `${r.ratings.average.toFixed(1)} ★`}</div>
          <p className="hint">{t('reports.ratingsHint', { count: r.ratings.count, low: r.ratings.low })}</p>
        </div>
      </div>
      <div className="grid-2">
        <Card>
          <BarChart title={t('reports.requestsPerDay')} tableLabel={t('reports.asTable')} data={r.series.map((s) => ({ label: short(s.date), value: s.requests }))} testId="chart-requests" />
        </Card>
        <Card>
          <BarChart title={t('reports.completedPerDay')} tableLabel={t('reports.asTable')} data={r.series.map((s) => ({ label: short(s.date), value: s.completed }))} />
        </Card>
      </div>
      <div className="grid-2">
        <Card title={t('reports.funnel')}>
          <Kv
            rows={[
              [t('status.requested'), r.funnel.requested],
              [t('status.quoted'), `${r.funnel.quoted} (${pct(r.funnel.quoted, r.funnel.requested)})`],
              [t('status.paid'), `${r.funnel.paid} (${pct(r.funnel.paid, r.funnel.requested)})`],
              [t('status.assigned'), r.funnel.assigned],
              [t('status.completed'), r.funnel.completed],
              [t('status.cancelled'), r.funnel.cancelled],
              [t('status.expired'), r.funnel.expired],
            ]}
          />
          <p className="hint">{t('reports.funnelHint')}</p>
        </Card>
        <Card title={t('reports.speed')}>
          <Kv
            rows={[
              [t('reports.toQuote'), mins(r.medianMinutes.requestToQuote)],
              [t('reports.toAssigned'), mins(r.medianMinutes.paymentToAssigned)],
              [t('reports.webPhone'), `${r.requests.byChannel.web ?? 0} / ${r.requests.byChannel.phone ?? 0}`],
              [t('booking.driverOnDemandShort'), r.requests.byService.driver_on_demand ?? 0],
              [t('booking.chauffeurShort'), r.requests.byService.chauffeur ?? 0],
              [t('reports.safetyReports'), r.safetyReports],
              ...Object.entries(r.alerts).map(([k, v]) => [t(`overview.alert_${k}`, { defaultValue: k.replace(/_/g, ' ') }), v] as [string, number]),
              ...Object.entries(r.cancellationsBy).map(([k, v]) => [t('reports.cancelledBy', { who: k }), v] as [string, number]),
            ]}
          />
        </Card>
      </div>
      <Card title={t('reports.drivers')}>
        {r.drivers.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {t('reports.noDrivers')}
          </p>
        ) : (
          <div className="table-wrap">
            <table data-testid="report-drivers">
              <thead>
                <tr>
                  <th scope="col">{t('ops.driver')}</th>
                  <th scope="col" className="num">{t('reports.completedTrips')}</th>
                  <th scope="col" className="num">{t('reports.hoursCol')}</th>
                  <th scope="col" className="num">{t('reports.declines')}</th>
                  <th scope="col" className="num">{t('reports.rating')}</th>
                </tr>
              </thead>
              <tbody>
                {r.drivers.map((d) => (
                  <tr key={d.id}>
                    <td>{d.name}</td>
                    <td className="num">{d.completed}</td>
                    <td className="num">{d.hours}</td>
                    <td className="num">{d.declines}</td>
                    <td className="num">{d.averageRating === null ? '—' : `${d.averageRating.toFixed(1)} (${d.ratings})`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function MoneyRows({ m }: { m: MoneyTotals }) {
  const { t } = useTranslation();
  return (
    <Kv
      rows={[
        [t('reports.payments'), rwf(m.customerPaymentsRwf)],
        [t('reports.refunds'), rwf(m.refundsRwf)],
        [t('reports.fees'), rwf(m.providerFeesRwf)],
        [t('reports.commission'), rwf(m.platformCommissionRwf)],
        [t('reports.platformAdjustments'), rwf(m.platformAdjustmentsRwf)],
        [t('reports.platformNet'), rwf(m.platformNetRwf)],
        [t('reports.driverEarnings'), rwf(m.driverEarningsRwf)],
        [t('reports.ownerEarnings'), rwf(m.vehicleOwnerEarningsRwf)],
        [t('reports.partnerAdjustments'), rwf(m.partnerAdjustmentsRwf)],
        [t('reports.payouts'), rwf(m.payoutsRwf)],
      ]}
    />
  );
}

function Finance({ r }: { r: FinanceReport }) {
  const { t } = useTranslation();
  const hasDev = r.development.customerPaymentsRwf !== 0 || r.developmentBookings > 0;
  return (
    <div className="grid" data-testid="report-finance">
      {hasDev && <p className="notice warn">{t('reports.devNote', { count: r.developmentBookings })}</p>}
      <div className="grid-4">
        <div className="card stat">
          <p className="eyebrow">{t('reports.payments')}</p>
          <div className="big-amount" data-testid="report-real-payments">{fmtRwf(r.real.customerPaymentsRwf)} <span className="muted small">RWF</span></div>
          <p className="hint">{t('reports.realOnly')}</p>
        </div>
        <div className="card stat">
          <p className="eyebrow">{t('reports.platformNet')}</p>
          <div className="big-amount">{fmtRwf(r.real.platformNetRwf)} <span className="muted small">RWF</span></div>
        </div>
        <div className="card stat">
          <p className="eyebrow">{t('reports.refunds')}</p>
          <div className="big-amount">{fmtRwf(r.real.refundsRwf)} <span className="muted small">RWF</span></div>
        </div>
        <div className="card stat">
          <p className="eyebrow">{t('reports.owedNow')}</p>
          <div className="big-amount">{fmtRwf(r.owedToPartnersNow.payable)} <span className="muted small">RWF</span></div>
          <p className="hint">{t('reports.owedHint', { held: fmtRwf(r.owedToPartnersNow.held + r.owedToPartnersNow.pending), disputed: fmtRwf(r.owedToPartnersNow.disputed) })}</p>
        </div>
      </div>
      <Card>
        <BarChart title={t('reports.paymentsPerDay')} tableLabel={t('reports.asTable')} format={(n) => `${fmtRwf(n)} RWF`} data={r.series.map((s) => ({ label: short(s.date), value: s.paymentsRwf }))} />
      </Card>
      <div className="grid-2">
        <Card title={t('reports.realMoney')}>
          <MoneyRows m={r.real} />
        </Card>
        {hasDev && (
          <Card title={t('reports.devMoney')}>
            <div data-testid="report-dev-money">
              <MoneyRows m={r.development} />
            </div>
          </Card>
        )}
        {Object.entries(r.byService).map(([svc, m]) => (
          <Card key={svc} title={svc === 'chauffeur' ? t('booking.chauffeurShort') : svc === 'driver_on_demand' ? t('booking.driverOnDemandShort') : svc}>
            <MoneyRows m={m} />
          </Card>
        ))}
      </div>
      <p className="muted small">
        {t('reports.entries', { count: r.entries })} <Link to="/admin/finance">{t('reports.openLedger')}</Link>
      </p>
    </div>
  );
}

/** Operational and financial reports over a Kigali date range, computed live from the records. */
export function AdminReportsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const tabs = [can('bookings.view') && { value: 'operations' as const, label: t('reports.operations') }, can('finance.view') && { value: 'finance' as const, label: t('reports.finance') }].filter(Boolean) as Array<{ value: 'operations' | 'finance'; label: string }>;
  const [tab, setTab] = useState<'operations' | 'finance'>(tabs[0]?.value ?? 'operations');
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(daysAgo(0));
  const [ops, setOps] = useState<OperationsReport | null>(null);
  const [fin, setFin] = useState<FinanceReport | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    const q = `from=${from}&to=${to}`;
    if (tab === 'operations') api<OperationsReport>(`/admin/reports/operations?${q}`).then(setOps).catch(setError);
    else api<FinanceReport>(`/admin/reports/finance?${q}`).then(setFin).catch(setError);
  }, [tab, from, to]);
  useEffect(load, [load]);

  const exportCsv = async () => {
    setBusy(true);
    try {
      const url = await authorizedBlobUrl(`/admin/reports/finance?from=${from}&to=${to}&format=csv`);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ridewell-ledger-${from}-to-${to}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (!tabs.length) return <p className="muted">{t('admin.noAccess')}</p>;
  return (
    <section className="grid">
      <h1 className="h2" style={{ margin: 0 }}>
        {t('reports.title')}
      </h1>
      <div className="filters row" style={{ gap: '1rem', alignItems: 'flex-end' }}>
        {tabs.length > 1 && <SlidingTabs tabs={tabs} value={tab} onChange={setTab} label={t('reports.title')} />}
        <Field label={t('reports.from')} type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        <Field label={t('reports.to')} type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} />
        <div className="row" style={{ gap: '0.5rem', marginBottom: '1rem' }}>
          {[7, 30, 90].map((n) => (
            <button key={n} type="button" className="ghost small" onClick={() => { setFrom(daysAgo(n - 1)); setTo(daysAgo(0)); }}>
              {t('reports.lastDays', { count: n })}
            </button>
          ))}
          {tab === 'finance' && (
            <button type="button" className="small" disabled={busy} onClick={() => void exportCsv()} data-testid="export-csv">
              {t('reports.exportCsv')}
            </button>
          )}
        </div>
      </div>
      <ErrorText error={error} />
      {tab === 'operations' ? ops ? <Operations r={ops} /> : <Loading /> : fin ? <Finance r={fin} /> : <Loading />}
      <p className="muted small">{t('reports.liveNote')}</p>
    </section>
  );
}
