import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { ErrorText, Field, Loading, SelectField, StatusChip } from '../../components/ui';
import { fmtKigali } from '../../components/time';

interface UserRow {
  id: string;
  phone: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  roles: string[];
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
}

/** Customer and partner accounts (staff accounts are managed under Staff). */
export function AdminUsersPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [phone, setPhone] = useState('');
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const query = useCallback(
    (before?: string) => {
      const p = new URLSearchParams();
      if (role) p.set('role', role);
      if (status) p.set('status', status);
      const digits = phone.replace(/[^\d+]/g, '');
      if (digits.length >= 3) p.set('phone', digits);
      if (before) p.set('before', before);
      return api<{ users: UserRow[]; nextBefore: string | null }>(`/admin/users?${p.toString()}`);
    },
    [role, status, phone],
  );
  useEffect(() => {
    const id = window.setTimeout(() => {
      query()
        .then((r) => {
          setRows(r.users);
          setNext(r.nextBefore);
        })
        .catch(setError);
    }, 250);
    return () => window.clearTimeout(id);
  }, [query]);

  const toggle = async (u: UserRow) => {
    const suspend = u.status === 'active';
    const reason = window.prompt(suspend ? t('users.suspendReason') : t('users.reactivateReason'));
    if (!reason || reason.trim().length < 3) return;
    try {
      await api(`/admin/users/${u.id}/${suspend ? 'suspend' : 'reactivate'}`, { method: 'POST', body: { reason: reason.trim() } });
      const r = await query();
      setRows(r.users);
    } catch (err) {
      setError(err);
    }
  };

  return (
    <section className="grid">
      <h1 className="h2" style={{ margin: 0 }}>
        {t('users.title')}
      </h1>
      <div className="form-grid">
        <SelectField label={t('users.role')} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">{t('users.any')}</option>
          {['customer', 'driver_partner', 'vehicle_partner'].map((r) => (
            <option key={r} value={r}>
              {t(`roles.${r}`)}
            </option>
          ))}
        </SelectField>
        <SelectField label={t('users.status')} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('users.any')}</option>
          {['active', 'suspended', 'anonymised'].map((s) => (
            <option key={s} value={s}>
              {t(`users.st_${s}`)}
            </option>
          ))}
        </SelectField>
        <Field label={t('users.phone')} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+25078…" />
      </div>
      <ErrorText error={error} />
      {!rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <p className="muted">{t('users.none')}</p>
      ) : (
        <div className="table-wrap">
          <table data-testid="users-table">
            <thead>
              <tr>
                <th scope="col">{t('users.name')}</th>
                <th scope="col">{t('users.contact')}</th>
                <th scope="col">{t('users.roles')}</th>
                <th scope="col">{t('users.status')}</th>
                <th scope="col">{t('users.lastLogin')}</th>
                {can('users.suspend') && <th scope="col" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>{[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}</td>
                  <td className="small">
                    {u.phone}
                    {u.phone && u.email && <br />}
                    {u.email}
                  </td>
                  <td className="small">{u.roles.map((r) => t(`roles.${r}`)).join(', ')}</td>
                  <td>
                    <StatusChip status={u.status} />
                  </td>
                  <td className="small">{u.lastLoginAt ? fmtKigali(u.lastLoginAt) : '—'}</td>
                  {can('users.suspend') && (
                    <td>
                      {u.status !== 'anonymised' && (
                        <button type="button" className={`small ${u.status === 'active' ? 'danger' : 'ghost'}`} onClick={() => void toggle(u)}>
                          {u.status === 'active' ? t('users.suspend') : t('users.reactivate')}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {next && (
        <button
          type="button"
          className="ghost"
          onClick={async () => {
            const r = await query(next);
            setRows((cur) => [...(cur ?? []), ...r.users]);
            setNext(r.nextBefore);
          }}
        >
          {t('users.more')}
        </button>
      )}
    </section>
  );
}
