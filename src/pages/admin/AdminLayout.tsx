import { NavLink, Navigate, Outlet, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';

/** Menu items appear only for what the account may use. The API enforces each permission. */
export function useAdminNav() {
  const { t } = useTranslation();
  const { can, isSuperAdmin } = useAuth();
  return [
    { to: '/admin/overview', label: t('overview.nav') },
    can('bookings.view') && { to: '/admin/bookings', label: t('ops.navBookings') },
    (can('bookings.view') || can('finance.view')) && { to: '/admin/reports', label: t('reports.nav') },
    can('safety.handle') && { to: '/admin/safety', label: t('ops.navSafety') },
    can('support.handle') && { to: '/admin/support', label: t('support.adminNav') },
    can('partners.view') && { to: '/admin/applications', label: t('admin.navApplications') },
    can('users.view') && { to: '/admin/users', label: t('users.nav') },
    (can('finance.view') || can('refunds.request') || can('refunds.approve') || can('payouts.confirm')) && { to: '/admin/finance', label: t('finance.nav') },
    can('notifications.view') && { to: '/admin/notifications', label: t('deliveries.nav') },
    isSuperAdmin && { to: '/admin/staff', label: t('admin.navStaff') },
    (can('config.view') || can('config.edit')) && { to: '/admin/settings', label: t('admin.navSettings') },
    can('audit.view') && { to: '/admin/audit', label: t('admin.navAudit') },
  ].filter(Boolean) as Array<{ to: string; label: string }>;
}

export function AdminLayout() {
  const { t } = useTranslation();
  const { user, isSuperAdmin } = useAuth();
  const nav = useAdminNav();
  const location = useLocation();
  if (!user) return null;
  const role = isSuperAdmin ? t('roles.super_admin') : t('roles.staff');
  const ends = sessionStorage.getItem('rw_admin_session_ends');
  // /admin itself: open the overview, which every staff account can see.
  if (location.pathname === '/admin' && nav[0]) return <Navigate to={nav[0].to} replace />;
  return (
    <div className="page container">
      <div className="page-head">
        <div>
          <p className="eyebrow">{t('admin.dashboardTitle')}</p>
          <p data-testid="admin-whoami" style={{ margin: 0, fontWeight: 650 }}>
            {t('admin.signedInAs', { name: user.firstName ?? user.email, role })}
          </p>
          {ends && <p className="muted small" style={{ margin: 0 }}>{t('admin.sessionEnds', { time: new Date(ends).toLocaleTimeString() })}</p>}
        </div>
      </div>
      <div className="admin-shell">
        <nav className="side-nav" aria-label="Admin">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ minWidth: 0 }}>
          {nav.length === 0 ? (
            <div className="card">
              <h1 className="h2">{t('admin.welcomeTitle')}</h1>
              <p className="muted">{t('admin.noAccess')}</p>
            </div>
          ) : (
            <Outlet />
          )}
        </div>
      </div>
    </div>
  );
}
