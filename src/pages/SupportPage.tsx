import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { SupportCategory, SupportRequest } from '../api/types';
import { Card, ErrorText, Loading, SelectField, StatusChip, TextArea } from '../components/ui';
import { Reveal } from '../components/motion';
import { fmtKigali } from '../components/time';

const CATEGORIES: SupportCategory[] = ['booking', 'payment', 'account', 'partner', 'other'];

/** Help: ask the RideWELL team something and read their replies. Safety problems use the safety report instead. */
export function SupportPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const bookingId = params.get('booking');
  const bookingRef = params.get('ref');
  const [requests, setRequests] = useState<SupportRequest[] | null>(null);
  const [category, setCategory] = useState<SupportCategory>(bookingId ? 'booking' : 'other');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = () => api<{ requests: SupportRequest[] }>('/support').then((r) => setRequests(r.requests)).catch(setError);
  useEffect(() => {
    void load();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ request: SupportRequest }>('/support', { method: 'POST', body: { category, message: message.trim(), bookingId: bookingId || null } });
      setSent(r.request.ref);
      setMessage('');
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page container" style={{ maxWidth: 820 }}>
      <Reveal className="page-head">
        <div>
          <p className="eyebrow">{t('support.eyebrow')}</p>
          <h1>{t('support.title')}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {t('support.subtitle')}
          </p>
        </div>
      </Reveal>
      <p className="notice">{t('support.safetyNote')}</p>
      <div className="grid">
        <Reveal>
          <Card title={t('support.new')}>
            <form onSubmit={submit} noValidate data-testid="support-form">
              {bookingId && (
                <p className="muted small">
                  {t('support.about')} <Link to={`/bookings/${bookingId}`}>{bookingRef ?? t('support.thisBooking')}</Link>
                </p>
              )}
              <SelectField label={t('support.category')} value={category} onChange={(e) => setCategory(e.target.value as SupportCategory)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`support.cat_${c}`)}
                  </option>
                ))}
              </SelectField>
              <TextArea label={t('support.message')} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} required />
              <ErrorText error={error} />
              {sent && (
                <p className="success" role="status" data-testid="support-sent">
                  {t('support.sent', { ref: sent })}
                </p>
              )}
              <button type="submit" disabled={busy || message.trim().length < 3}>
                {t('support.send')}
              </button>
            </form>
          </Card>
        </Reveal>
        <Reveal index={1}>
          <Card title={t('support.yours')}>
            {!requests ? (
              <Loading />
            ) : requests.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                {t('support.none')}
              </p>
            ) : (
              <ol className="inbox" data-testid="support-list">
                {requests.map((r) => (
                  <li key={r.id} className="inbox-item">
                    <div className="row between" style={{ alignItems: 'baseline' }}>
                      <strong>
                        {r.ref} · {t(`support.cat_${r.category}`)}
                        {r.bookingRef && <span className="muted"> · {r.bookingRef}</span>}
                      </strong>
                      <StatusChip status={r.status === 'open' ? 'support_open' : 'support_answered'} />
                    </div>
                    <p className="muted small" style={{ margin: '0.15rem 0' }}>
                      {fmtKigali(r.createdAt)}
                    </p>
                    <p style={{ whiteSpace: 'pre-wrap', margin: '0.25rem 0' }}>{r.message}</p>
                    {r.reply && (
                      <p className="notice good" style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }} data-testid="support-reply">
                        <strong>{t('support.reply')}:</strong> {r.reply}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
