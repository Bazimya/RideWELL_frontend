import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api, type SelfUser } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { ErrorText, Field } from '../components/ui';
import { SlidingTabs } from '../components/motion';

type Method = 'phone' | 'email';

export function SignInPage() {
  const { t } = useTranslation();
  const { status, signedIn, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [method, setMethod] = useState<Method>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // phone
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  // email
  const [register, setRegister] = useState(params.get('mode') === 'register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  // Where to go after signing in: back to where the visitor came from (e.g. /book with a
  // saved draft), never into the admin area.
  const from = (location.state as { from?: string } | null)?.from;
  const target = from && from.startsWith('/') && !from.startsWith('/admin') ? from : '/dashboard';
  if (status === 'signedIn') return <Navigate to={isAdmin ? '/admin' : target} replace />;

  const done = (res: { accessToken: string; user: SelfUser }) => {
    signedIn(res.accessToken, res.user);
    navigate(target, { replace: true });
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const sendCode = (e?: FormEvent) => {
    e?.preventDefault();
    void run(async () => {
      const res = await api<{ developmentCode?: string }>('/auth/otp/request', { method: 'POST', body: { phone }, noRefresh: true });
      setStep('code');
      // Development only: the server says which fixed code to use (no SMS provider yet).
      setDevCode(res.developmentCode ?? null);
      setCode(res.developmentCode ?? '');
    });
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card glass">
        <h1 className="h2" style={{ marginBottom: '0.3rem' }}>
          {t('signIn.title')}
        </h1>
        <p className="muted" style={{ marginTop: 0 }}>
          {t('signIn.subtitle')}
        </p>
        <div style={{ margin: '1.25rem 0 1.5rem' }}>
          <SlidingTabs<Method>
            label={t('signIn.title')}
            value={method}
            onChange={(m) => {
              setMethod(m);
              setError(null);
            }}
            tabs={[
              { value: 'phone', label: t('signIn.tabPhone') },
              { value: 'email', label: t('signIn.tabEmail') },
            ]}
          />
        </div>

        <div key={`${method}-${step}-${register}`} className="page-enter">
          {method === 'phone' &&
            (step === 'phone' ? (
              <form onSubmit={sendCode} noValidate>
                <Field label={t('signIn.phoneLabel')} hint={t('signIn.phoneHint')} type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} />
                <ErrorText error={error} />
                <button type="submit" disabled={busy || phone.trim().length < 6} style={{ width: '100%' }}>
                  {t('signIn.sendCode')}
                </button>
              </form>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => done(await api('/auth/otp/verify', { method: 'POST', body: { phone, code }, noRefresh: true })));
                }}
                noValidate
              >
                <Field
                  label={t('signIn.codeLabel')}
                  hint={t('signIn.codeHint', { phone })}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  style={{ letterSpacing: '0.4em', fontSize: '1.3rem', textAlign: 'center' }}
                />
                {devCode && (
                  <p className="notice warn small" role="status">
                    {t('signIn.devCode', { code: devCode })}
                  </p>
                )}
                <ErrorText error={error} />
                <button type="submit" disabled={busy || code.length !== 6} style={{ width: '100%' }}>
                  {t('signIn.verify')}
                </button>
                <div className="row between" style={{ marginTop: '0.75rem' }}>
                  <button type="button" className="link" onClick={() => setStep('phone')}>
                    {t('signIn.changePhone')}
                  </button>
                  <button type="button" className="link" onClick={() => sendCode()} disabled={busy}>
                    {t('signIn.resend')}
                  </button>
                </div>
              </form>
            ))}

          {method === 'email' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () =>
                  done(
                    register
                      ? await api('/auth/email/register', { method: 'POST', body: { email, password, firstName, lastName }, noRefresh: true })
                      : await api('/auth/email/login', { method: 'POST', body: { email, password }, noRefresh: true }),
                  ),
                );
              }}
              noValidate
            >
              {register && (
                <div className="form-grid">
                  <Field label={t('signIn.firstName')} autoComplete="given-name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  <Field label={t('signIn.lastName')} autoComplete="family-name" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              )}
              <Field label={t('signIn.emailLabel')} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              <Field
                label={t('signIn.passwordLabel')}
                hint={register ? t('signIn.passwordHint') : undefined}
                type="password"
                autoComplete={register ? 'new-password' : 'current-password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <ErrorText error={error} />
              <button type="submit" disabled={busy || !email || !password || (register && (!firstName || !lastName))} style={{ width: '100%' }}>
                {register ? t('signIn.createEmail') : t('signIn.signInEmail')}
              </button>
              <p style={{ textAlign: 'center', marginBottom: 0 }}>
                <button type="button" className="link" onClick={() => setRegister(!register)}>
                  {register ? t('signIn.toLogin') : t('signIn.toRegister')}
                </button>
              </p>
            </form>
          )}
        </div>
        <hr className="divider" />
        <p className="small muted" style={{ textAlign: 'center', margin: 0 }}>
          <Link to="/admin/sign-in">{t('signIn.adminLink')}</Link>
        </p>
      </div>
    </div>
  );
}
