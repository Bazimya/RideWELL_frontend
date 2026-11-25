import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api, type SelfUser } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Card, ErrorText, Field } from '../components/ui';
import { Reveal } from '../components/motion';
import { IconArrow, IconCar, IconSteering } from '../components/icons';

export function AccountPage() {
  const { t } = useTranslation();
  const { user, updateUser, signOut } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState<unknown>(null);
  if (!user) return null;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const body: Record<string, string | null> = {};
      if (firstName.trim()) body.firstName = firstName.trim();
      if (lastName.trim()) body.lastName = lastName.trim();
      body.email = email.trim() ? email.trim() : null;
      const res = await api<{ user: SelfUser }>('/me', { method: 'PATCH', body });
      updateUser(res.user);
      setSaved(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSaved(false);
    try {
      await api('/me/password', { method: 'PUT', body: user.hasPassword ? { currentPassword, newPassword } : { newPassword } });
      updateUser({ ...user, hasPassword: true });
      setCurrentPassword('');
      setNewPassword('');
      setPwSaved(true);
    } catch (err) {
      setPwError(err);
    }
  };

  return (
    <div className="page container">
      <Reveal className="page-head">
        <div>
          <p className="eyebrow">{t('account.eyebrow')}</p>
          <h1>{user.firstName ? t('account.hello', { name: user.firstName }) : t('account.helloAnon')}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {user.roles.map((r) => t(`roles.${r}`)).join(' · ')}
          </p>
        </div>
        <button type="button" className="ghost" onClick={() => void signOut(true)}>
          {t('account.signOutEverywhere')}
        </button>
      </Reveal>

      <Reveal index={1} className="row" style={{ marginBottom: '1.25rem' }}>
        <Link className="btn" to="/book">
          {t('booking.bookNow')} <IconArrow width={18} height={18} />
        </Link>
        <Link className="btn ghost" to="/bookings">
          {t('booking.myBookings')}
        </Link>
        {user.roles.includes('driver_partner') && (
          <Link className="btn ghost" to="/driver/trips">
            {t('trips.title')}
          </Link>
        )}
        {user.roles.includes('vehicle_partner') && (
          <Link className="btn ghost" to="/owner/trips">
            {t('trips.ownerTitle')}
          </Link>
        )}
        {(user.roles.includes('driver_partner') || user.roles.includes('vehicle_partner')) && (
          <Link className="btn ghost" to="/earnings">
            {t('earnings.title')}
          </Link>
        )}
      </Reveal>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Reveal index={2}>
          <Card title={t('account.profile')}>
            <dl className="facts" style={{ marginBottom: '1.25rem' }}>
              <dt>{t('account.phone')}</dt>
              <dd data-testid="account-phone">{user.phone ?? t('account.none')}</dd>
            </dl>
            <form onSubmit={save} noValidate>
              <div className="form-grid">
                <Field label={t('account.firstName')} autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                <Field label={t('account.lastName')} autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <Field label={t('account.email')} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <ErrorText error={error} />
              {saved && (
                <p className="success" role="status">
                  {t('account.saved')}
                </p>
              )}
              <button type="submit" disabled={busy}>
                {t('account.save')}
              </button>
            </form>
          </Card>
        </Reveal>

        <div className="grid">
          <Reveal index={3}>
            <Card title={t('account.partnerTitle')}>
              <div className="grid">
                <Link to="/partner/driver" className="card flat lift row" style={{ textDecoration: 'none', gap: '1rem', padding: '1rem 1.25rem' }}>
                  <div className="icon-tile" style={{ margin: 0 }}>
                    <IconSteering />
                  </div>
                  <div style={{ flex: 1 }}>
                    <strong>{t('account.driveCard')}</strong>
                    <p className="muted small" style={{ margin: 0 }}>
                      {t('account.driveText')}
                    </p>
                  </div>
                  <IconArrow />
                </Link>
                <Link to="/partner/owner" className="card flat lift row" style={{ textDecoration: 'none', gap: '1rem', padding: '1rem 1.25rem' }}>
                  <div className="icon-tile" style={{ margin: 0 }}>
                    <IconCar />
                  </div>
                  <div style={{ flex: 1 }}>
                    <strong>{t('account.ownerCard')}</strong>
                    <p className="muted small" style={{ margin: 0 }}>
                      {t('account.ownerText')}
                    </p>
                  </div>
                  <IconArrow />
                </Link>
              </div>
            </Card>
          </Reveal>

          <Reveal index={4}>
            <Card title={t('account.password')}>
              <p className="muted">{user.hasPassword ? t('account.passwordChangeText') : t('account.passwordSetText')}</p>
              <form onSubmit={savePassword} noValidate>
                {user.hasPassword && (
                  <Field label={t('account.currentPassword')} type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                )}
                <Field label={t('account.newPassword')} type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                <ErrorText error={pwError} />
                {pwSaved && (
                  <p className="success" role="status">
                    {t('account.passwordSaved')}
                  </p>
                )}
                <button type="submit" className="ghost" disabled={newPassword.length < 10}>
                  {t('account.savePassword')}
                </button>
              </form>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
