import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { api, rememberDevCode, type SelfUser } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { AuthShell, ErrorText, Field } from '../../components/ui';

type Step = 'password' | 'code' | 'setup' | 'recovery';
interface SignedInResponse {
  accessToken: string;
  user: SelfUser;
  sessionExpiresAt: string;
  recoveryCodes?: string[];
}

/**
 * Staff sign-in: password, then authenticator code. On a staff member's first
 * sign-in (account created by a Super Admin) the second step sets up the
 * authenticator app instead and shows one-time recovery codes.
 */
export function AdminSignInPage() {
  const { t } = useTranslation();
  const { status, isAdmin, signedIn } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [useRecovery, setUseRecovery] = useState(false);
  const [code, setCode] = useState('');
  const [secret, setSecret] = useState('');
  const [qr, setQr] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [pending, setPending] = useState<SignedInResponse | null>(null);
  const [devHint, setDevHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (status === 'signedIn' && step !== 'recovery') return <Navigate to={isAdmin ? '/admin' : '/account'} replace />;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err);
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const finish = (res: SignedInResponse) => {
    sessionStorage.setItem('rw_admin_session_ends', res.sessionExpiresAt);
    signedIn(res.accessToken, res.user);
    navigate('/admin', { replace: true });
  };

  const passwordStep = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const res = await api<{ mfaToken: string; setupRequired: boolean; developmentCode?: string }>('/auth/admin/login', {
        method: 'POST',
        body: { email, password },
        noRefresh: true,
      });
      setPassword('');
      setMfaToken(res.mfaToken);
      // Development only: the API tells us the fixed code to use instead of an authenticator.
      rememberDevCode(res.developmentCode);
      setDevHint(res.developmentCode ?? null);
      if (res.developmentCode) setCode(res.developmentCode);
      if (res.setupRequired) {
        const setup = await api<{ otpauthUri: string; secret: string }>('/auth/admin/2fa/setup', { method: 'POST', body: { mfaToken: res.mfaToken }, noRefresh: true });
        setSecret(setup.secret);
        setQr(await QRCode.toDataURL(setup.otpauthUri, { margin: 1, width: 220 }));
        setStep('setup');
      } else setStep('code');
    });
  };

  const codeStep = (e: FormEvent) => {
    e.preventDefault();
    void run(async () =>
      finish(
        await api<SignedInResponse>('/auth/admin/login/mfa', {
          method: 'POST',
          body: useRecovery ? { mfaToken, recoveryCode: code.trim().toLowerCase() } : { mfaToken, code },
          noRefresh: true,
        }),
      ),
    );
  };

  const setupStep = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const res = await api<SignedInResponse>('/auth/admin/2fa/confirm', { method: 'POST', body: { mfaToken, code }, noRefresh: true });
      setSecret('');
      setRecoveryCodes(res.recoveryCodes ?? []);
      setPending(res);
      setStep('recovery');
    });
  };

  if (step === 'setup' || step === 'recovery')
    return (
      <AuthShell title={t('admin.setupTitle')} subtitle={step === 'setup' ? t('admin.setupIntro') : undefined}>
        {step === 'setup' ? (
          <form onSubmit={setupStep} noValidate>
            <p>{t('admin.setupScan')}</p>
            {qr && <img src={qr} width={220} height={220} alt={t('admin.qrAlt')} className="qr" />}
            <p className="hint">
              {t('admin.setupManual')} <code data-testid="totp-secret">{secret}</code>
            </p>
            <Field
              label={t('admin.totpLabel')}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            <ErrorText error={error} />
            <button type="submit" style={{ width: '100%' }} disabled={busy || code.length !== 6}>
              {t('admin.setupConfirm')}
            </button>
          </form>
        ) : (
          <>
            <h3>{t('admin.recoveryTitle')}</h3>
            <p>{t('admin.recoveryText')}</p>
            <ul className="codes" data-testid="recovery-codes">
              {recoveryCodes.map((c) => (
                <li key={c}>
                  <code>{c}</code>
                </li>
              ))}
            </ul>
            <button type="button" style={{ width: '100%' }} onClick={() => pending && finish(pending)}>
              {t('admin.recoveryContinue')}
            </button>
          </>
        )}
      </AuthShell>
    );

  return (
    <AuthShell title={t('admin.signInTitle')} subtitle={t('admin.signInSub')}>
      {step === 'password' ? (
        <form onSubmit={passwordStep} noValidate>
          <Field label={t('admin.email')} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field label={t('admin.password')} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <ErrorText error={error} />
          <button type="submit" style={{ width: '100%' }} disabled={busy || !email || !password}>
            {t('admin.next')}
          </button>
          <p>
            <Link to="/admin/reset-password">{t('admin.forgot')}</Link>
          </p>
        </form>
      ) : (
        <form onSubmit={codeStep} noValidate>
          {useRecovery ? (
            <Field label={t('admin.recoveryLabel')} autoComplete="off" required value={code} onChange={(e) => setCode(e.target.value)} />
          ) : (
            <Field
              label={t('admin.totpLabel')}
              hint={t('admin.totpHint')}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          )}
          {devHint && !useRecovery && (
            <p className="notice warn small" role="status">
              {t('admin.devCode', { code: devHint })}
            </p>
          )}
          <ErrorText error={error} />
          <button type="submit" style={{ width: '100%' }} disabled={busy || (!useRecovery && code.length !== 6) || (useRecovery && code.length < 14)}>
            {t('admin.next')}
          </button>
          <button
            type="button"
            className="link"
            onClick={() => {
              setUseRecovery(!useRecovery);
              setCode('');
            }}
          >
            {useRecovery ? t('admin.useTotp') : t('admin.useRecovery')}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
