import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import type { SupportRequest } from '../../api/types';
import { Card, ErrorText, Loading, TextArea } from '../../components/ui';
import { SlidingTabs } from '../../components/motion';
import { fmtKigali, relative } from '../../components/time';

type Row = SupportRequest & { user: { id: string; name: string | null; phone: string | null; email: string | null; roles: string[] } | null };

function RequestCard({ r, onDone }: { r: Row; onDone: () => void }) {
  const { t } = useTranslation();
  const [reply, setReply] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <div className="row between">
        <strong>
          {r.ref} · {t(`support.cat_${r.category}`)}
          {r.bookingId && (
            <>
              {' '}· <Link to={`/admin/bookings/${r.bookingId}`}>{r.bookingRef}</Link>
            </>
          )}
        </strong>
        <span className="muted small" title={fmtKigali(r.createdAt)}>
          {relative(r.createdAt)}
        </span>
      </div>
      {r.user && (
        <p className="muted small" style={{ margin: '0.2rem 0' }}>
          {r.user.name ?? '—'} · {r.user.phone ?? r.user.email ?? ''} · {r.user.roles.filter((x) => x !== 'customer').map((x) => t(`roles.${x}`)).join(', ') || t('roles.customer')}
        </p>
      )}
      <p style={{ whiteSpace: 'pre-wrap' }}>{r.message}</p>
      {r.status === 'resolved' ? (
        <p className="notice good" style={{ whiteSpace: 'pre-wrap' }}>
          {r.reply}
        </p>
      ) : (
        <>
          <TextArea label={t('support.replyLabel')} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={2000} />
          <p className="hint">{t('support.replyHint')}</p>
          <ErrorText error={error} />
          <button
            type="button"
            disabled={busy || reply.trim().length < 3}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`/admin/support/${r.id}/resolve`, { method: 'POST', body: { reply: reply.trim() } });
                onDone();
              } catch (err) {
                setError(err);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('support.replyAndClose')}
          </button>
        </>
      )}
    </Card>
  );
}

export function AdminSupportPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'open' | 'resolved'>('open');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(() => {
    api<{ requests: Row[] }>(`/admin/support?status=${status}`).then((r) => setRows(r.requests)).catch(setError);
  }, [status]);
  useEffect(load, [load]);
  return (
    <section className="grid">
      <h1 className="h2" style={{ margin: 0 }}>
        {t('support.adminTitle')}
      </h1>
      <SlidingTabs<'open' | 'resolved'> tabs={[{ value: 'open', label: t('support.tabOpen') }, { value: 'resolved', label: t('support.tabAnswered') }]} value={status} onChange={setStatus} label={t('support.adminTitle')} />
      <ErrorText error={error} />
      {!rows ? <Loading /> : rows.length === 0 ? <p className="muted">{t('support.queueEmpty')}</p> : rows.map((r) => <RequestCard key={r.id} r={r} onDone={load} />)}
    </section>
  );
}
