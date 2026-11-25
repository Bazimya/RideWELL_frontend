import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { Card, ErrorText, Loading } from '../../components/ui';

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : null);

interface AuditRow {
  id: string;
  at: string;
  action: string;
  targetType: string;
  targetId: string | null;
  actorId: string | null;
  actorRoles: string[];
  reason: string | null;
}

export function AdminAuditPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback((before?: string) => {
    api<{ entries: AuditRow[]; nextBefore: string | null }>(`/admin/audit-logs?limit=25${before ? `&before=${before}` : ''}`)
      .then((r) => {
        setRows((prev) => (before && prev ? [...prev, ...r.entries] : r.entries));
        setNext(r.nextBefore);
      })
      .catch(setError);
  }, []);
  useEffect(() => load(), [load]);

  return (
    <Card title={t('admin.auditLog')}>
      <ErrorText error={error} />
      {!rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <p className="muted">{t('admin.auditEmpty')}</p>
      ) : (
        <div className="table-wrap">
          <table data-testid="audit-table">
            <thead>
              <tr>
                <th scope="col">{t('admin.when')}</th>
                <th scope="col">{t('admin.action')}</th>
                <th scope="col">{t('admin.target')}</th>
                <th scope="col">{t('admin.actor')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{fmt(r.at)}</td>
                  <td>
                    <code>{r.action}</code>
                  </td>
                  <td>
                    {r.targetType}
                    {r.targetId ? ` ${r.targetId.slice(-6)}` : ''}
                  </td>
                  <td>{r.actorRoles.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {next && (
        <button type="button" className="secondary" onClick={() => load(next)}>
          {t('admin.loadMore')}
        </button>
      )}
    </Card>
  );
}

