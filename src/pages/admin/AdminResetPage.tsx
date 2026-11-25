import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { ErrorText, Field, AuthShell } from '../../components/ui';

export function AdminResetPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

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

  if (done) {
    return (
      <AuthShell title={t('resetPassword.title')}>
        <p className="success">{t('resetPassword.done')}</p>
        <Link className="btn" to="/admin/sign-in">
          {t('nav.signIn')}
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t('resetPassword.title')}>
      {!sent ? (
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void run(async () => {
              const res = await api<{ developmentCode?: string }>('/auth/admin/password-reset/request', { method: 'POST', body: { email }, noRefresh: true });
              // Development only: pre-fill the fixed code for both the SMS and authenticator fields.
              if (res.developmentCode) {
                setCode(res.developmentCode);
                setTotpCode(res.developmentCode);
              }
              setSent(true);
            });
          }}
          noValidate
        >
          <p>{t('resetPassword.requestText')}</p>
          <Field label={t('admin.email')} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          <ErrorText error={error} />
          <button type="submit" style={{ width: '100%' }} disabled={busy || !email}>
            {t('resetPassword.send')}
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void run(async () => {
              await api('/auth/admin/password-reset/confirm', { method: 'POST', body: { email, code, totpCode, newPassword }, noRefresh: true });
              setDone(true);
            });
          }}
          noValidate
        >
          <p className="notice">{t('resetPassword.sent')}</p>
          <Field label={t('resetPassword.smsCode')} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          <Field label={t('admin.totpLabel')} inputMode="numeric" maxLength={6} value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))} />
          <Field
            label={t('resetPassword.newPassword')}
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <ErrorText error={error} />
          <button type="submit" style={{ width: '100%' }} disabled={busy || code.length !== 6 || totpCode.length !== 6 || newPassword.length < 10}>
            {t('resetPassword.confirm')}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
