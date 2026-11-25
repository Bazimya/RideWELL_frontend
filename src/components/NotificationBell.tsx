import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { Inbox } from '../api/types';

/** Unread count, refreshed every minute and on each page change. */
export function NotificationBell() {
  const { t } = useTranslation();
  const [unread, setUnread] = useState(0);
  const { pathname } = useLocation();
  useEffect(() => {
    let alive = true;
    const load = () =>
      api<Inbox>('/me/notifications?limit=1')
        .then((r) => alive && setUnread(r.unread))
        .catch(() => undefined);
    void load();
    const iv = window.setInterval(load, 60_000);
    return () => {
      alive = false;
      window.clearInterval(iv);
    };
  }, [pathname]);
  return (
    <NavLink to="/notifications" className="bell" aria-label={unread ? t('inbox.bellUnread', { count: unread }) : t('inbox.bell')} data-testid="bell">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {unread > 0 && (
        <span className="bell-count" data-testid="bell-count">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </NavLink>
  );
}
