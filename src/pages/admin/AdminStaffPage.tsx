import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Card, ErrorText, Field, Loading, SelectField, StatusChip, fmtDateTime } from '../../components/ui';
import { Reveal } from '../../components/motion';
import { useStepUpCode } from '../../components/useStepUpCode';

interface PermissionDef {
  key: string;
  group: string;
  label: string;
}
interface Catalog {
  permissions: PermissionDef[];
  presets: Record<string, { label: string; permissions: string[] }>;
}
interface StaffRow {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  accountType: 'staff' | 'super_admin' | 'removed';
  permissions: string[];
  status: string;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
}

function generatePassword(): string {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(18));
  const s = Array.from(bytes, (b) => a[b % a.length]).join('');
  return `${s.slice(0, 6)}-${s.slice(6, 12)}-${s.slice(12)}`;
}

/** Grouped checkboxes for every permission, with quick-select presets. */
export function PermissionPicker({ catalog, value, onChange, disabled }: { catalog: Catalog; value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  const groups = catalog.permissions.reduce<Record<string, PermissionDef[]>>((acc, p) => {
    (acc[p.group] ??= []).push(p);
    return acc;
  }, {});
  const toggle = (key: string) => onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  return (
    <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0 }}>
      <div className="row" style={{ marginBottom: '0.9rem' }}>
        <span className="muted small">{t('admin.presets')}:</span>
        {Object.entries(catalog.presets).map(([key, p]) => (
          <button key={key} type="button" className="ghost small" onClick={() => onChange([...p.permissions])}>
            {p.label}
          </button>
        ))}
        <button type="button" className="ghost small" onClick={() => onChange(catalog.permissions.map((p) => p.key))}>
          {t('admin.selectAll')}
        </button>
        <button type="button" className="ghost small" onClick={() => onChange([])}>
          {t('admin.selectNone')}
        </button>
      </div>
      <div className="grid-2">
        {Object.entries(groups).map(([group, perms]) => (
          <div key={group} className="card flat" style={{ padding: '1rem 1.1rem' }}>
            <strong className="small" style={{ letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>
              {group}
            </strong>
            <div style={{ display: 'grid', gap: '0.55rem', marginTop: '0.7rem' }}>
              {perms.map((p) => (
                <label key={p.key} className="row" style={{ alignItems: 'flex-start', gap: '0.65rem', cursor: 'pointer', flexWrap: 'nowrap' }}>
                  <input type="checkbox" checked={value.includes(p.key)} onChange={() => toggle(p.key)} aria-describedby={`perm-${p.key}`} />
                  <span>
                    <span>{p.label}</span>
                    <code id={`perm-${p.key}`} className="hint" style={{ display: 'block' }}>
                      {p.key}
                    </code>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}

function StaffEditor({ row, catalog, onDone, onClose }: { row: StaffRow; catalog: Catalog; onDone: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [permissions, setPermissions] = useState(row.permissions);
  const [newPassword, setNewPassword] = useState('');
  const [code, setCode, resetCode] = useStepUpCode();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const isSuper = row.accountType === 'super_admin';

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      resetCode();
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  const h = { 'X-2FA-Code': code };

  return (
    <div className="card flat page-enter" style={{ marginTop: '0.75rem' }} data-testid={`staff-editor-${row.email}`}>
      {!isSuper && (
        <>
          <h3>{t('admin.permissions')}</h3>
          <PermissionPicker catalog={catalog} value={permissions} onChange={setPermissions} />
        </>
      )}
      <div className="form-grid" style={{ marginTop: '1rem' }}>
        <Field label={t('admin.stepUp')} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
        <Field label={t('admin.setPassword')} type="text" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      </div>
      <ErrorText error={error} />
      <div className="row">
        {!isSuper && (
          <button type="button" disabled={busy || code.length !== 6} onClick={() => void run(() => api(`/admin/staff/${row.id}`, { method: 'PUT', body: { permissions }, headers: h }))}>
            {t('admin.savePermissions')}
          </button>
        )}
        <button
          type="button"
          className="ghost"
          disabled={busy || code.length !== 6 || newPassword.length < 10}
          onClick={() => void run(() => api(`/admin/staff/${row.id}/password`, { method: 'POST', body: { password: newPassword }, headers: h }))}
        >
          {t('admin.setPassword')}
        </button>
        <button
          type="button"
          className="ghost"
          disabled={busy || code.length !== 6}
          onClick={() => window.confirm(t('admin.reset2faConfirm')) && void run(() => api(`/admin/staff/${row.id}/reset-2fa`, { method: 'POST', headers: h }))}
        >
          {t('admin.reset2fa')}
        </button>
        <button
          type="button"
          className="danger"
          disabled={busy || code.length !== 6}
          onClick={() => {
            const reason = window.prompt(t('admin.removeConfirm'));
            if (reason) void run(() => api(`/admin/staff/${row.id}`, { method: 'DELETE', body: { reason }, headers: h }));
          }}
        >
          {t('admin.removeStaff')}
        </button>
        <button type="button" className="link" onClick={onClose}>
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}

export function AdminStaffPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [rows, setRows] = useState<StaffRow[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', accountType: 'staff' as 'staff' | 'super_admin' });
  const [permissions, setPermissions] = useState<string[]>([]);
  const [code, setCode, resetCode] = useStepUpCode();
  const [created, setCreated] = useState(false);
  const [formError, setFormError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ staff: StaffRow[] }>('/admin/staff').then((r) => setRows(r.staff)).catch(setError);
  }, []);
  useEffect(() => {
    load();
    api<Catalog>('/admin/permissions').then(setCatalog).catch(setError);
  }, [load]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    setCreated(false);
    try {
      await api('/admin/staff', {
        method: 'POST',
        headers: { 'X-2FA-Code': code },
        body: { ...form, phone: form.phone.trim() || null, permissions: form.accountType === 'staff' ? permissions : [] },
      });
      setCreated(true);
      setForm({ firstName: '', lastName: '', email: '', phone: '', password: '', accountType: 'staff' });
      setPermissions([]);
      load();
    } catch (err) {
      setFormError(err);
    } finally {
      resetCode();
      setBusy(false);
    }
  };
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  if (!catalog || !rows) return error ? <ErrorText error={error} /> : <Loading />;
  const permLabel = new Map(catalog.permissions.map((p) => [p.key, p.label]));

  return (
    <section className="grid">
      <Reveal>
        <h1 className="h2" style={{ marginBottom: '0.3rem' }}>
          {t('admin.staff')}
        </h1>
        <p className="muted">{t('admin.staffIntro')}</p>
      </Reveal>

      <Reveal index={1}>
        <div className="grid">
          {rows.map((r) => (
            <div key={r.id} className="card" style={{ padding: '1.1rem 1.25rem' }} data-testid={`staff-${r.email}`}>
              <div className="row between">
                <div>
                  <strong>
                    {r.firstName} {r.lastName} {r.id === user?.id && <span className="muted small">({t('admin.you')})</span>}
                  </strong>
                  <div className="muted small">
                    {r.email} {r.phone ? `· ${r.phone}` : ''} · {t('admin.lastLogin')}: {r.lastLoginAt ? fmtDateTime(r.lastLoginAt) : t('admin.never')}
                  </div>
                </div>
                <div className="row">
                  <span className="chip">{r.accountType === 'super_admin' ? t('roles.super_admin') : r.accountType === 'staff' ? t('roles.staff') : t('admin.removedAccount')}</span>
                  {r.accountType !== 'removed' && (
                    <span className={`chip ${r.twoFactorEnabled ? 's-approved' : 's-pending'}`}>
                      {t('admin.twoFa')}: {r.twoFactorEnabled ? t('admin.twoFaOn') : t('admin.twoFaPending')}
                    </span>
                  )}
                  {r.status !== 'active' && <StatusChip status={r.status} />}
                  {r.id !== user?.id && r.accountType !== 'removed' && (
                    <button type="button" className="ghost small" onClick={() => setEditing(editing === r.id ? null : r.id)}>
                      {t('admin.edit')}
                    </button>
                  )}
                </div>
              </div>
              {r.accountType === 'staff' && (
                <ul className="file-list" style={{ marginTop: '0.75rem' }}>
                  {r.permissions.length === 0 && <li className="muted small">—</li>}
                  {r.permissions.map((p) => (
                    <li key={p} className="chip code" title={permLabel.get(p)}>
                      {p}
                    </li>
                  ))}
                </ul>
              )}
              {r.accountType === 'super_admin' && <p className="muted small" style={{ margin: '0.6rem 0 0' }}>{t('admin.allPermissions')}</p>}
              {editing === r.id && (
                <StaffEditor
                  row={r}
                  catalog={catalog}
                  onClose={() => setEditing(null)}
                  onDone={() => {
                    setEditing(null);
                    load();
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal index={2}>
        <Card title={t('admin.newStaff')}>
          <form onSubmit={create} noValidate>
            <div className="form-grid">
              <Field label={t('admin.firstName')} value={form.firstName} onChange={set('firstName')} />
              <Field label={t('admin.lastName')} value={form.lastName} onChange={set('lastName')} />
              <Field label={t('admin.email')} type="email" autoComplete="off" value={form.email} onChange={set('email')} />
              <Field label={t('admin.phone')} type="tel" value={form.phone} onChange={set('phone')} />
              <div className="field span-2">
                <label htmlFor="staff-password">{t('admin.password')}</label>
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <input id="staff-password" type="text" autoComplete="new-password" value={form.password} onChange={set('password')} aria-describedby="staff-password-hint" />
                  <button type="button" className="ghost small" onClick={() => setForm({ ...form, password: generatePassword() })}>
                    {t('admin.generate')}
                  </button>
                </div>
                <p className="hint" id="staff-password-hint">
                  {t('admin.passwordHintStaff')}
                </p>
              </div>
              <SelectField className="span-2" label={t('admin.accountType')} value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value as 'staff' | 'super_admin' })}>
                <option value="staff">{t('admin.typeStaff')}</option>
                <option value="super_admin">{t('admin.typeSuper')}</option>
              </SelectField>
            </div>
            {form.accountType === 'staff' && (
              <>
                <h3>{t('admin.permissions')}</h3>
                <PermissionPicker catalog={catalog} value={permissions} onChange={setPermissions} />
              </>
            )}
            <div className="form-grid" style={{ marginTop: '1rem' }}>
              <Field label={t('admin.stepUp')} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            </div>
            <ErrorText error={formError} />
            {created && (
              <p className="notice good" role="status">
                {t('admin.staffCreated')}
              </p>
            )}
            <button type="submit" disabled={busy || code.length !== 6 || !form.email || form.password.length < 10 || !form.firstName || !form.lastName}>
              {t('admin.createStaff')}
            </button>
          </form>
        </Card>
      </Reveal>
    </section>
  );
}
