import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Card, ErrorText, Field, Loading } from '../../components/ui';
import { SlidingTabs } from '../../components/motion';
import { useStepUpCode } from '../../components/useStepUpCode';
import { fmtKigali, fmtRwf } from '../../components/time';

interface Summary {
  customerPaymentsRwf: number;
  refundsRwf: number;
  providerFeesRwf: number;
  platformNetRwf: number;
  payoutsRwf: number;
  openRefunds: number;
  developmentPayments: number;
}
interface RefundRow {
  id: string;
  bookingId: string;
  bookingRef: string;
  amountRwf: number;
  reason: string;
  source: 'cancellation_policy' | 'staff_request';
  status: string;
  requestedBy: string | null;
  isDevelopment: boolean;
  providerRef: string | null;
  decisionNote: string | null;
  createdAt: string;
}
interface PayableEarning {
  id: string;
  bookingRef: string;
  role: string;
  amountRwf: number;
  customerPaymentRwf: number;
  providerFeeRwf: number;
  commissionRwf: number;
}
interface PayablePartner {
  partnerUserId: string;
  name: string;
  phone: string | null;
  payout: { method: 'momo' | 'bank'; momoPhone?: string; momoName?: string; bankName?: string; accountName?: string; accountNumber?: string } | null;
  totalRwf: number;
  earnings: PayableEarning[];
}
interface LedgerRow {
  id: string;
  type: string;
  party: string;
  bookingId: string | null;
  amountRwf: number;
  externalRef: string | null;
  memo: string | null;
  createdAt: string;
}

type Tab = 'refunds' | 'payouts' | 'ledger';

function Refunds() {
  const { t } = useTranslation();
  const { can, user } = useAuth();
  const [status, setStatus] = useState<'requested' | 'completed' | 'rejected' | 'failed'>('requested');
  const [rows, setRows] = useState<RefundRow[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [code, setCode, resetCode] = useStepUpCode();
  const load = useCallback(() => {
    api<{ refunds: RefundRow[] }>(`/admin/finance/refunds?status=${status}`).then((r) => setRows(r.refunds)).catch(setError);
  }, [status]);
  useEffect(load, [load]);
  const decide = async (id: string, action: 'approve' | 'reject') => {
    setError(null);
    try {
      await api(`/admin/finance/refunds/${id}/${action}`, { method: 'POST', headers: { 'X-2FA-Code': code }, body: action === 'approve' ? { note: notes[id] || null } : { note: notes[id] ?? '' } });
      resetCode();
      load();
    } catch (err) {
      setError(err);
    }
  };
  return (
    <div className="grid">
      <SlidingTabs
        label={t('finance.tabRefunds')}
        value={status}
        onChange={setStatus}
        tabs={[
          { value: 'requested', label: t('finance.requested') },
          { value: 'completed', label: t('finance.completed') },
          { value: 'rejected', label: t('finance.rejected') },
          { value: 'failed', label: t('finance.failed') },
        ]}
      />
      <ErrorText error={error} />
      {status === 'requested' && can('refunds.approve') && (
        <div style={{ maxWidth: 320 }}>
          <Field label={t('finance.stepUp')} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
        </div>
      )}
      {!rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <p className="card muted">{t('finance.noRefunds')}</p>
      ) : (
        rows.map((r) => (
          <Card key={r.id}>
            <div className="row between">
              <div>
                <strong className="big-amount" style={{ fontSize: '1.4rem' }}>
                  {fmtRwf(r.amountRwf)} RWF
                </strong>
                <div className="muted small">
                  <Link to={`/admin/bookings/${r.bookingId}`}>{r.bookingRef}</Link> · {r.source === 'cancellation_policy' ? t('finance.policy') : t('finance.staffRequest')} · {fmtKigali(r.createdAt)}
                </div>
                <div className="small">{r.reason}</div>
                {r.providerRef && (
                  <div className="hint">
                    {r.providerRef}
                    {r.isDevelopment ? ' (development, no money moved)' : ''}
                  </div>
                )}
                {r.decisionNote && <div className="hint">{r.decisionNote}</div>}
              </div>
            </div>
            {r.status === 'requested' && can('refunds.approve') && (
              <div className="row" style={{ marginTop: '0.75rem' }}>
                <input aria-label={t('finance.note')} placeholder={t('finance.note')} value={notes[r.id] ?? ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} style={{ flex: 1, minWidth: 180 }} />
                <button type="button" className="ok small" disabled={code.length !== 6 || r.requestedBy === user?.id} onClick={() => void decide(r.id, 'approve')}>
                  {t('finance.approve')}
                </button>
                <button type="button" className="danger small" disabled={code.length !== 6 || (notes[r.id] ?? '').trim().length < 3 || r.requestedBy === user?.id} onClick={() => void decide(r.id, 'reject')}>
                  {t('finance.reject')}
                </button>
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}

function PayoutForm({ partner, onDone }: { partner: PayablePartner; onDone: () => void }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string[]>(partner.earnings.map((e) => e.id));
  const [method, setMethod] = useState<'momo' | 'bank'>(partner.payout?.method ?? 'momo');
  const [destination, setDestination] = useState(partner.payout?.method === 'bank' ? `${partner.payout.bankName} ${partner.payout.accountNumber}` : (partner.payout?.momoPhone ?? partner.phone ?? ''));
  const [txRef, setTxRef] = useState('');
  const [code, setCode, resetCode] = useStepUpCode();
  // One idempotency key per payout form: a double click or a retry cannot record it twice.
  const [key] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const total = useMemo(() => partner.earnings.filter((e) => selected.includes(e.id)).reduce((s, e) => s + e.amountRwf, 0), [partner, selected]);
  return (
    <Card>
      <div className="row between">
        <div>
          <strong style={{ fontSize: '1.15rem' }}>{partner.name}</strong>
          <div className="muted small">
            {t('finance.payTo')}:{' '}
            {partner.payout
              ? partner.payout.method === 'momo'
                ? `MoMo ${partner.payout.momoPhone} (${partner.payout.momoName})`
                : `${partner.payout.bankName} · ${partner.payout.accountName} · ${partner.payout.accountNumber}`
              : t('finance.noDetails')}
          </div>
        </div>
        <span className="big-amount" style={{ fontSize: '1.4rem' }}>
          {fmtRwf(partner.totalRwf)} RWF
        </span>
      </div>
      <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
        <table>
          <tbody>
            {partner.earnings.map((e) => (
              <tr key={e.id}>
                <td>
                  <input type="checkbox" aria-label={`${t('finance.select')} ${e.bookingRef}`} checked={selected.includes(e.id)} onChange={() => setSelected(selected.includes(e.id) ? selected.filter((x) => x !== e.id) : [...selected, e.id])} />
                </td>
                <td>
                  <strong>{e.bookingRef}</strong> <span className="muted small">{e.role.replace('_', ' ')}</span>
                </td>
                <td className="muted small">
                  {t('finance.customerPaid')} {fmtRwf(e.customerPaymentRwf)} · {t('finance.commission')} {fmtRwf(e.commissionRwf)}
                  {e.providerFeeRwf ? ` · fee ${fmtRwf(e.providerFeeRwf)}` : ''}
                </td>
                <td className="num">{fmtRwf(e.amountRwf)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="form-grid" style={{ marginTop: '1rem' }}>
        <Field label={`${t('finance.total')} (RWF)`} value={fmtRwf(total)} readOnly />
        <div className="field">
          <label htmlFor={`m-${partner.partnerUserId}`}>{t('finance.method')}</label>
          <select id={`m-${partner.partnerUserId}`} value={method} onChange={(e) => setMethod(e.target.value as 'momo' | 'bank')}>
            <option value="momo">MoMo</option>
            <option value="bank">Bank</option>
          </select>
        </div>
        <Field label={t('finance.destination')} value={destination} onChange={(e) => setDestination(e.target.value)} />
        <Field label={t('finance.transactionRef')} value={txRef} onChange={(e) => setTxRef(e.target.value)} />
        <Field label={t('finance.stepUp')} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
      </div>
      <ErrorText error={error} />
      <button
        type="button"
        disabled={busy || !selected.length || txRef.trim().length < 4 || destination.trim().length < 3 || code.length !== 6}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await api('/admin/finance/payouts', {
              method: 'POST',
              headers: { 'X-2FA-Code': code },
              body: { partnerUserId: partner.partnerUserId, earningIds: selected, amountRwf: total, method, destination: destination.trim(), transactionRef: txRef.trim(), idempotencyKey: key },
            });
            resetCode();
            onDone();
          } catch (err) {
            setError(err);
          } finally {
            setBusy(false);
          }
        }}
      >
        {t('finance.confirm')} · {fmtRwf(total)} RWF
      </button>
    </Card>
  );
}

function Payouts() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [rows, setRows] = useState<PayablePartner[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const load = useCallback(() => {
    api<{ partners: PayablePartner[] }>('/admin/finance/payables').then((r) => setRows(r.partners)).catch(setError);
  }, []);
  useEffect(load, [load]);
  return (
    <div className="grid">
      <ErrorText error={error} />
      {done && <p className="notice good">{t('finance.recorded')}</p>}
      {!rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <p className="card muted">{t('finance.noPayables')}</p>
      ) : (
        rows.map((p) =>
          can('payouts.confirm') ? (
            <PayoutForm
              key={p.partnerUserId}
              partner={p}
              onDone={() => {
                setDone(true);
                load();
              }}
            />
          ) : (
            <Card key={p.partnerUserId}>
              <strong>{p.name}</strong> · {fmtRwf(p.totalRwf)} RWF
            </Card>
          ),
        )
      )}
    </div>
  );
}

export function LedgerTable({ rows }: { rows: LedgerRow[] }) {
  const { t } = useTranslation();
  if (!rows.length) return <p className="muted">{t('finance.ledgerEmpty')}</p>;
  return (
    <div className="table-wrap">
      <table data-testid="ledger-table">
        <thead>
          <tr>
            <th scope="col">{t('finance.when')}</th>
            <th scope="col">{t('finance.type')}</th>
            <th scope="col">{t('finance.party')}</th>
            <th scope="col" className="num">
              {t('finance.amount')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="small">{fmtKigali(r.createdAt)}</td>
              <td>
                <code>{r.type}</code>
                {r.memo && <div className="hint">{r.memo}</div>}
              </td>
              <td>{r.party.replace('_', ' ')}</td>
              <td className="num" style={{ color: r.amountRwf < 0 ? 'var(--danger)' : undefined }}>
                {fmtRwf(r.amountRwf)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Ledger() {
  const [rows, setRows] = useState<LedgerRow[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    api<{ entries: LedgerRow[] }>('/admin/finance/ledger?limit=200').then((r) => setRows(r.entries)).catch(setError);
  }, []);
  return error ? <ErrorText error={error} /> : rows ? <LedgerTable rows={rows} /> : <Loading />;
}

export function AdminFinancePage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'refunds';
  const [summary, setSummary] = useState<Summary | null>(null);
  useEffect(() => {
    if (can('finance.view')) api<Summary>('/admin/finance/summary').then(setSummary).catch(() => undefined);
  }, [can]);
  const tabs = [
    (can('finance.view') || can('refunds.request') || can('refunds.approve')) && { value: 'refunds' as Tab, label: t('finance.tabRefunds') },
    (can('finance.view') || can('payouts.confirm')) && { value: 'payouts' as Tab, label: t('finance.tabPayouts') },
    can('finance.view') && { value: 'ledger' as Tab, label: t('finance.tabLedger') },
  ].filter(Boolean) as Array<{ value: Tab; label: string }>;
  return (
    <section className="grid">
      <h1 className="h2" style={{ margin: 0 }}>
        {t('finance.title')}
      </h1>
      {summary && (
        <>
          <div className="grid-4">
            {(
              [
                ['payments', summary.customerPaymentsRwf],
                ['refunds', summary.refundsRwf],
                ['platformNet', summary.platformNetRwf],
                ['paidOut', summary.payoutsRwf],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="card stat">
                <p className="eyebrow" style={{ marginBottom: '0.3rem' }}>
                  {t(`finance.${k}`)}
                </p>
                <div className="big-amount">{fmtRwf(v)}</div>
              </div>
            ))}
          </div>
          {summary.developmentPayments > 0 && <p className="notice warn small">{t('finance.devNote', { count: summary.developmentPayments })}</p>}
        </>
      )}
      {tabs.length > 0 && <SlidingTabs<Tab> label={t('finance.title')} value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} tabs={tabs} />}
      <div key={tab} className="page-enter">
        {tab === 'refunds' && <Refunds />}
        {tab === 'payouts' && <Payouts />}
        {tab === 'ledger' && <Ledger />}
      </div>
    </section>
  );
}
