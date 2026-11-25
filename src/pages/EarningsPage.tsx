import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Card, ErrorText, Field, Loading, SelectField, StatusChip } from '../components/ui';
import { Reveal } from '../components/motion';
import { fmtKigali, fmtRwf } from '../components/time';

interface Earnings {
  totals: Record<'pending' | 'held' | 'payable' | 'paid' | 'disputed' | 'reversed', number>;
  earnings: Array<{ id: string; bookingRef: string; role: string; amountRwf: number; status: string; releaseAt: string | null; createdAt: string }>;
  payouts: Array<{ id: string; amountRwf: number; method: string; transactionRef: string; confirmedAt: string; earnings: number }>;
}

function PayoutDetails({ roles }: { roles: string[] }) {
  const { t } = useTranslation();
  const [role, setRole] = useState<'driver' | 'owner'>(roles.includes('driver_partner') ? 'driver' : 'owner');
  const [method, setMethod] = useState<'momo' | 'bank'>('momo');
  const [f, setF] = useState({ momoPhone: '', momoName: '', bankName: '', accountName: '', accountNumber: '' });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await api('/partners/payout-details', {
        method: 'PUT',
        body: { role, payout: method === 'momo' ? { method, momoPhone: f.momoPhone, momoName: f.momoName } : { method, bankName: f.bankName, accountName: f.accountName, accountNumber: f.accountNumber } },
      });
      setSaved(true);
    } catch (err) {
      setError(err);
    }
  };
  const both = roles.includes('driver_partner') && roles.includes('vehicle_partner');
  return (
    <Card title={t('earnings.details')}>
      <form onSubmit={save} noValidate>
        <div className="form-grid">
          {both && (
            <SelectField label={t('earnings.detailsRole')} value={role} onChange={(e) => setRole(e.target.value as 'driver' | 'owner')}>
              <option value="driver">{t('earnings.asDriver')}</option>
              <option value="owner">{t('earnings.asOwner')}</option>
            </SelectField>
          )}
          <SelectField label={t('partner.payout')} value={method} onChange={(e) => setMethod(e.target.value as 'momo' | 'bank')}>
            <option value="momo">{t('partner.payoutMomo')}</option>
            <option value="bank">{t('partner.payoutBank')}</option>
          </SelectField>
          {method === 'momo' ? (
            <>
              <Field label={t('partner.momoPhone')} type="tel" value={f.momoPhone} onChange={set('momoPhone')} />
              <Field label={t('partner.momoName')} value={f.momoName} onChange={set('momoName')} />
            </>
          ) : (
            <>
              <Field label={t('partner.bankName')} value={f.bankName} onChange={set('bankName')} />
              <Field label={t('partner.accountName')} value={f.accountName} onChange={set('accountName')} />
              <Field className="span-2" label={t('partner.accountNumber')} value={f.accountNumber} onChange={set('accountNumber')} />
            </>
          )}
        </div>
        <ErrorText error={error} />
        {saved && (
          <p className="success" role="status">
            {t('earnings.saved')}
          </p>
        )}
        <button type="submit" className="ghost">
          {t('earnings.save')}
        </button>
      </form>
    </Card>
  );
}

/** Read-only earnings for drivers and vehicle partners (brief: partners cannot change earnings or payouts). */
export function EarningsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [data, setData] = useState<Earnings | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    api<Earnings>('/partners/earnings').then(setData).catch(setError);
  }, []);
  if (!user) return null;
  const cards: Array<[keyof Earnings['totals'], string | null]> = [
    ['pending', t('earnings.pendingHint')],
    ['held', t('earnings.heldHint')],
    ['payable', t('earnings.payableHint')],
    ['paid', null],
  ];
  return (
    <div className="page container" style={{ maxWidth: 960 }}>
      <Reveal className="page-head">
        <div>
          <p className="eyebrow">{t('earnings.eyebrow')}</p>
          <h1>{t('earnings.title')}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {t('earnings.readOnly')}
          </p>
        </div>
      </Reveal>
      <ErrorText error={error} />
      {!data ? (
        <Loading />
      ) : (
        <div className="grid">
          <div className="grid-4">
            {cards.map(([k, hint], i) => (
              <Reveal key={k} index={i} className="card stat">
                <p className="eyebrow" style={{ marginBottom: '0.3rem' }}>
                  {t(`earnings.${k}`)}
                </p>
                <div className="big-amount" data-testid={`total-${k}`}>
                  {fmtRwf(data.totals[k])} <span className="muted small">RWF</span>
                </div>
                {hint && <p className="hint">{hint}</p>}
              </Reveal>
            ))}
          </div>
          {data.totals.disputed > 0 && (
            <p className="notice warn">
              {t('earnings.disputed')}: {fmtRwf(data.totals.disputed)} RWF · {t('earnings.disputedHint')}
            </p>
          )}
          <Card title={t('earnings.trips')}>
            {data.earnings.length === 0 ? (
              <p className="muted">{t('earnings.none')}</p>
            ) : (
              <div className="table-wrap">
                <table data-testid="earnings-table">
                  <thead>
                    <tr>
                      <th scope="col">{t('earnings.booking')}</th>
                      <th scope="col">{t('earnings.status')}</th>
                      <th scope="col" className="num">
                        {t('earnings.amount')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.earnings.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <strong>{e.bookingRef}</strong>
                          <div className="muted small">
                            {fmtKigali(e.createdAt)}
                            {e.status === 'held' && e.releaseAt ? ` · ${t('earnings.payableFrom', { time: fmtKigali(e.releaseAt) })}` : ''}
                          </div>
                        </td>
                        <td>
                          <StatusChip status={e.status} />
                        </td>
                        <td className="num">{fmtRwf(e.amountRwf)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card title={t('earnings.payouts')}>
            {data.payouts.length === 0 ? (
              <p className="muted">{t('earnings.noPayouts')}</p>
            ) : (
              <ul className="checklist">
                {data.payouts.map((p) => (
                  <li key={p.id} className="done">
                    <span>
                      <strong>{fmtRwf(p.amountRwf)} RWF</strong> · {p.method} · {t('earnings.ref')} {p.transactionRef} · <span className="muted">{fmtKigali(p.confirmedAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <PayoutDetails roles={user.roles} />
        </div>
      )}
    </div>
  );
}
