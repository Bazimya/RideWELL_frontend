import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { NotificationBell } from './components/NotificationBell';
import { useAuth } from './auth/AuthContext';
import { Loading } from './components/ui';
import { useScrolled } from './components/motion';
import { BrandMark } from './components/icons';
import { HomePage } from './pages/HomePage';
import { SignInPage } from './pages/SignInPage';
import { AccountPage } from './pages/AccountPage';

const BookPage = lazy(() => import('./pages/BookPage').then((m) => ({ default: m.BookPage })));
const BookingsPage = lazy(() => import('./pages/BookingsPage').then((m) => ({ default: m.BookingsPage })));
const BookingDetailPage = lazy(() => import('./pages/BookingDetailPage').then((m) => ({ default: m.BookingDetailPage })));
const DriverTripsPage = lazy(() => import('./pages/driver/DriverTripsPage').then((m) => ({ default: m.DriverTripsPage })));
const DriverTripPage = lazy(() => import('./pages/driver/DriverTripsPage').then((m) => ({ default: m.DriverTripPage })));
const OwnerTripsPage = lazy(() => import('./pages/driver/DriverTripsPage').then((m) => ({ default: m.OwnerTripsPage })));
const AdminBookingsPage = lazy(() => import('./pages/admin/AdminBookingsPage').then((m) => ({ default: m.AdminBookingsPage })));
const AdminBookingDetailPage = lazy(() => import('./pages/admin/AdminBookingDetailPage').then((m) => ({ default: m.AdminBookingDetailPage })));
const AdminSafetyPage = lazy(() => import('./pages/admin/AdminSafetyPage').then((m) => ({ default: m.AdminSafetyPage })));

const DriverApplicationPage = lazy(() => import('./pages/partner/DriverApplicationPage').then((m) => ({ default: m.DriverApplicationPage })));
const OwnerPage = lazy(() => import('./pages/partner/OwnerPage').then((m) => ({ default: m.OwnerPage })));
const VehiclePage = lazy(() => import('./pages/partner/VehiclePage').then((m) => ({ default: m.VehiclePage })));
// Admin screens load on demand so customers on slow connections never download them.
const AdminSignInPage = lazy(() => import('./pages/admin/AdminSignInPage').then((m) => ({ default: m.AdminSignInPage })));
const AdminResetPage = lazy(() => import('./pages/admin/AdminResetPage').then((m) => ({ default: m.AdminResetPage })));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const AdminApplicationsPage = lazy(() => import('./pages/admin/AdminApplicationsPage').then((m) => ({ default: m.AdminApplicationsPage })));
const AdminApplicationDetailPage = lazy(() => import('./pages/admin/AdminApplicationDetailPage').then((m) => ({ default: m.AdminApplicationDetailPage })));
const AdminStaffPage = lazy(() => import('./pages/admin/AdminStaffPage').then((m) => ({ default: m.AdminStaffPage })));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage })));
const EarningsPage = lazy(() => import('./pages/EarningsPage').then((m) => ({ default: m.EarningsPage })));
const AdminFinancePage = lazy(() => import('./pages/admin/AdminFinancePage').then((m) => ({ default: m.AdminFinancePage })));
const AdminOverviewPage = lazy(() => import('./pages/admin/AdminOverviewPage').then((m) => ({ default: m.AdminOverviewPage })));
const AdminReportsPage = lazy(() => import('./pages/admin/AdminReportsPage').then((m) => ({ default: m.AdminReportsPage })));
const AdminSupportPage = lazy(() => import('./pages/admin/AdminSupportPage').then((m) => ({ default: m.AdminSupportPage })));
const AdminNotificationsPage = lazy(() => import('./pages/admin/AdminNotificationsPage').then((m) => ({ default: m.AdminNotificationsPage })));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const SupportPage = lazy(() => import('./pages/SupportPage').then((m) => ({ default: m.SupportPage })));
const AdminAuditPage = lazy(() => import('./pages/admin/AdminAuditPage').then((m) => ({ default: m.AdminAuditPage })));

/** UI-level guard for navigation only. Every permission is enforced by the API. */
function RequireAuth({ admin, children }: { admin?: boolean; children: ReactNode }) {
  const { status, isAdmin } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <div className="page container"><Loading /></div>;
  if (status === 'signedOut') return <Navigate to={admin ? '/admin/sign-in' : '/sign-in'} replace state={{ from: location.pathname }} />;
  if (admin && !isAdmin) return <Navigate to="/account" replace />;
  if (!admin && isAdmin) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

function Header() {
  const { t } = useTranslation();
  const { status, isAdmin, signOut, user } = useAuth();
  const scrolled = useScrolled();
  const onHome = useLocation().pathname === '/';
  return (
    <header className="site-header" data-scrolled={scrolled || !onHome}>
      <div className="container inner">
        <a href="#main" className="skip">
          {t('nav.skip')}
        </a>
        <Link to="/" className="brand" aria-label="RideWELL home">
          <BrandMark />
          <span>
            Ride<b>WELL</b>
          </span>
        </Link>
        <nav className="nav" aria-label="Main">
          {onHome && (
            <>
              <a href="#services" className="hide-sm">
                {t('nav.services')}
              </a>
              <a href="#how" className="hide-sm">
                {t('nav.howItWorks')}
              </a>
            </>
          )}
          {status === 'signedIn' ? (
            <>
              {!isAdmin && <NavLink to="/dashboard">{t('nav.dashboard')}</NavLink>}
              {!isAdmin && (
                <NavLink to="/bookings" className="hide-sm">
                  {t('nav.bookings')}
                </NavLink>
              )}
              {user?.roles.includes('driver_partner') && <NavLink to="/driver/trips">{t('nav.trips')}</NavLink>}
              {!user?.roles.includes('driver_partner') && user?.roles.includes('vehicle_partner') && <NavLink to="/owner/trips">{t('nav.trips')}</NavLink>}
              {(user?.roles.includes('driver_partner') || user?.roles.includes('vehicle_partner')) && (
                <NavLink to="/earnings" className="hide-sm">
                  {t('nav.earnings')}
                </NavLink>
              )}
              {!isAdmin && <NotificationBell />}
              <NavLink to={isAdmin ? '/admin' : '/account'} className={isAdmin ? '' : 'hide-sm'}>
                {isAdmin ? t('nav.admin') : t('nav.account')}
              </NavLink>
              <button type="button" className="link" onClick={() => void signOut()}>
                {t('nav.signOut')}
              </button>
            </>
          ) : (
            status === 'signedOut' && (
              <>
                <NavLink to="/sign-in" className="hide-sm">
                  {t('nav.signIn')}
                </NavLink>
                <Link to="/sign-in?mode=register" className="nav-cta">
                  {t('nav.getStarted')}
                </Link>
              </>
            )
          )}
        </nav>
      </div>
    </header>
  );
}

/** Each route change eases the new page in and resets scroll, unless jumping to an anchor. */
function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  useEffect(() => {
    if (!location.hash) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname, location.hash]);
  return (
    <div key={location.pathname} className="page-enter">
      {children}
    </div>
  );
}

export function App() {
  const { t } = useTranslation();
  return (
    <>
      <Header />
      <main id="main">
        <PageTransition>
          <Suspense fallback={<div className="page container"><Loading /></div>}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/sign-in" element={<SignInPage />} />
              <Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
              <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
              <Route path="/notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
              <Route path="/support" element={<RequireAuth><SupportPage /></RequireAuth>} />
              <Route path="/book" element={<RequireAuth><BookPage /></RequireAuth>} />
              <Route path="/bookings" element={<RequireAuth><BookingsPage /></RequireAuth>} />
              <Route path="/bookings/:id" element={<RequireAuth><BookingDetailPage /></RequireAuth>} />
              <Route path="/driver/trips" element={<RequireAuth><DriverTripsPage /></RequireAuth>} />
              <Route path="/driver/trips/:id" element={<RequireAuth><DriverTripPage /></RequireAuth>} />
              <Route path="/owner/trips" element={<RequireAuth><OwnerTripsPage /></RequireAuth>} />
              <Route path="/earnings" element={<RequireAuth><EarningsPage /></RequireAuth>} />
              <Route path="/partner/driver" element={<RequireAuth><DriverApplicationPage /></RequireAuth>} />
              <Route path="/partner/owner" element={<RequireAuth><OwnerPage /></RequireAuth>} />
              <Route path="/partner/vehicles/:id" element={<RequireAuth><VehiclePage /></RequireAuth>} />
              <Route path="/admin/sign-in" element={<AdminSignInPage />} />
              <Route path="/admin/reset-password" element={<AdminResetPage />} />
              <Route path="/admin" element={<RequireAuth admin><AdminLayout /></RequireAuth>}>
                <Route path="overview" element={<AdminOverviewPage />} />
                <Route path="reports" element={<AdminReportsPage />} />
                <Route path="support" element={<AdminSupportPage />} />
                <Route path="notifications" element={<AdminNotificationsPage />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="bookings" element={<AdminBookingsPage />} />
                <Route path="bookings/:id" element={<AdminBookingDetailPage />} />
                <Route path="safety" element={<AdminSafetyPage />} />
                <Route path="applications" element={<AdminApplicationsPage />} />
                <Route path="applications/:kind/:id" element={<AdminApplicationDetailPage />} />
                <Route path="staff" element={<AdminStaffPage />} />
                <Route path="settings" element={<AdminSettingsPage />} />
                <Route path="finance" element={<AdminFinancePage />} />
                <Route path="audit" element={<AdminAuditPage />} />
              </Route>
              <Route
                path="*"
                element={
                  <div className="page container">
                    <h1>{t('common.notFound')}</h1>
                    <Link className="btn" to="/">
                      {t('common.goHome')}
                    </Link>
                  </div>
                }
              />
            </Routes>
          </Suspense>
        </PageTransition>
      </main>
    </>
  );
}
