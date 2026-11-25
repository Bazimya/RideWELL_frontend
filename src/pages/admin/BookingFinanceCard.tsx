import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Card, ErrorText, Field, StatusChip } from '../../components/ui';
import { fmtKigali, fmtRwf } from '../../components/time';
import { LedgerTable } from './AdminFinancePage';

interface BookingFinance {
  balance: { paid: number; refunded: number; allocations: number; paidOut: number; balanced: boolean };
  entries: Array<{ id: string; type: string; party: string; bookingId: string | null; amountRwf: number; externalRef: string | null; memo: string | null; createdAt: string }>;
  earnings: Array<{ id: string; role: string; amountRwf: number; status: string; releaseAt: string | null }>;
  refunds: Array<{ id: string; amountRwf: number; status: string; source: string; reason: string; createdAt: string }>;
}

/** The money side of one booking: ledger balance, partner earnings, refunds, and a refund request. */
export function BookingFinanceCard({ bookingId, paid }: { bookingId: string; paid: boolean }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [data, setData] = useState<BookingFinance | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [sent, setSent] = useState(false);
  const load = useCallback(() => {
    api<BookingFinance>(`/admin/finance/bookings/${bookingId}`).then(setData).catch(setError);
  }, [bookingId]);
  useEffect(load, [load]);
  if (!can('finance.view') && !can('refunds.request') && !can('refunds.approve')) return null;
  const amountRwf = Number(amount);
  return (
    <Card title={t('finance.bookingFinance')}>
      <ErrorText error={error} />
      {data && (
        <div className="grid" style={{ gap: '1rem' }}>
          <p className={`notice ${data.balance.balanced ? 'good' : 'bad'} small`} data-testid="booking-balance">
            {data.balance.balanced ? t('finance.balanced') : t('finance.unbalanced')} · {t('finance.payments')} {fmtRwf(data.balance.paid)} · {t('finance.refunds')} {fmtRwf(data.balance.refunded)} · {t('finance.paidOut')} {fmtRwf(data.balance.paidOut)}
          </p>
          {data.earnings.length > 0 && (
            <div>
              <p className="eyebrow">{t('finance.earnings')}</p>
              <ul className="checklist">
                {data.earnings.map((e) => (
                  <li key={e.id}>
                    <span>
                      {e.role.replace('_', ' ')} · <strong>{fmtRwf(e.amountRwf)} RWF</strong> <StatusChip status={e.status} />
                      {e.releaseAt && e.status === 'held' ? <span className="muted small"> · {fmtKigali(e.releaseAt)}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.refunds.length > 0 && (
            <div>
              <p className="eyebrow">{t('finance.refunds')}</p>
              <ul className="checklist">
                {data.refunds.map((r) => (
                  <li key={r.id} className={r.status === 'completed' ? 'done' : ''}>
                    <span>
                      <strong>{fmtRwf(r.amountRwf)} RWF</strong> <StatusChip status={r.status} /> · {r.source === 'cancellation_policy' ? t('finance.policy') : t('finance.staffRequest')} · <span className="muted small">{r.reason}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {can('finance.view') && data.entries.length > 0 && (
            <details>
              <summary className="small">{t('finance.tabLedger')}</summary>
              <LedgerTable rows={data.entries} />
            </details>
          )}
          {paid && can('refunds.request') && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                setSent(false);
                try {
                  await api('/admin/finance/refunds', { method: 'POST', body: { bookingId, amountRwf, reason: reason.trim() } });
                  setSent(true);
                  setAmount('');
                  setReason('');
                  load();
                } catch (err) {
                  setError(err);
                }
              }}
            >
              <p className="eyebrow">{t('finance.requestRefund')}</p>
              <div className="form-grid">
                <Field label={t('finance.refundAmount')} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
                <Field label={t('finance.refundReason')} value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              {sent && (
                <p className="success" role="status">
                  {t('finance.requestSent')}
                </p>
              )}
              <button type="submit" className="ghost small" disabled={!(amountRwf >= 1) || reason.trim().length < 3}>
                {t('finance.sendRequest')}
              </button>
            </form>
          )}
        </div>
      )}
    </Card>
  );
}
