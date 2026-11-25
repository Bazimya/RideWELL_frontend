import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { Inbox, InboxItem } from '../api/types';
import { ErrorText, Loading } from '../components/ui';
import { Reveal } from '../components/motion';
import { fmtKigali } from '../components/time';

/** Every message RideWELL sent this account, newest first. Opening the page marks them read. */
export function NotificationsPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    api<Inbox>('/me/notifications?limit=20')
      .then((r) => {
        setItems(r.notifications);
        setNext(r.nextBefore);
        if (r.unread) void api('/me/notifications/read', { method: 'POST', body: {} });
      })
      .catch(setError);
  }, []);

  const more = async () => {
    if (!next) return;
    const r = await api<Inbox>(`/me/notifications?limit=20&before=${next}`);
    setItems((cur) => [...(cur ?? []), ...r.notifications]);
    setNext(r.nextBefore);
  };

  return (
    <div className="page container" style={{ maxWidth: 760 }}>
      <Reveal className="page-head">
        <div>
          <p className="eyebrow">{t('inbox.eyebrow')}</p>
          <h1>{t('inbox.title')}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {t('inbox.subtitle')}
          </p>
        </div>
      </Reveal>
      <ErrorText error={error} />
      {!items ? (
        <Loading />
      ) : items.length === 0 ? (
        <p className="muted">{t('inbox.none')}</p>
      ) : (
        <ol className="inbox" data-testid="inbox">
          {items.map((n, i) => (
            <Reveal as="li" key={n.id} index={Math.min(i, 6)} className={`inbox-item ${n.readAt ? '' : 'unread'}`}>
              <div className="row between" style={{ alignItems: 'baseline' }}>
                <strong>{n.title}</strong>
                <span className="muted small">{fmtKigali(n.createdAt)}</span>
              </div>
              <p style={{ margin: '0.25rem 0 0' }}>{n.body}</p>
              {n.link && (
                <Link to={n.link} className="small">
                  {t('inbox.open')} →
                </Link>
              )}
            </Reveal>
          ))}
        </ol>
      )}
      {next && (
        <button type="button" className="ghost" onClick={() => void more()}>
          {t('inbox.more')}
        </button>
      )}
    </div>
  );
}
