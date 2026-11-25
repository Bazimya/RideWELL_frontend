import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import type { ApplicationRow } from '../../api/types';
import { ErrorText, Loading, StatusChip, fmtDateTime } from '../../components/ui';
import { SlidingTabs } from '../../components/motion';

type Kind = 'driver' | 'owner' | 'vehicle';
type Filter = 'open' | 'approved' | 'rejected' | 'suspended';
const FILTER_STATUSES: Record<Filter, string> = { open: 'applied,under_review', approved: 'approved', rejected: 'rejected', suspended: 'suspended' };

export function AdminApplicationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const kind = (params.get('kind') as Kind) || 'driver';
  const filter = (params.get('filter') as Filter) || 'open';
  const [rows, setRows] = useState<ApplicationRow[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    setRows(null);
    setError(null);
    api<{ applications: ApplicationRow[] }>(`/admin/partners/applications?kind=${kind}&status=${FILTER_STATUSES[filter]}`)
      .then((r) => setRows(r.applications))
      .catch(setError);
  }, [kind, filter]);

  const update = (k: Kind, f: Filter) => setParams({ kind: k, filter: f }, { replace: true });

  return (
    <section>
      <h1 className="h2">{t('admin.applications')}</h1>
      <div className="row" style={{ marginBottom: '1.25rem' }}>
        <SlidingTabs<Kind>
          label={t('admin.applications')}
          value={kind}
          onChange={(k) => update(k, filter)}
          tabs={[
            { value: 'driver', label: t('admin.kindDriver') },
            { value: 'owner', label: t('admin.kindOwner') },
            { value: 'vehicle', label: t('admin.kindVehicle') },
          ]}
        />
        <SlidingTabs<Filter>
          label={t('admin.status')}
          value={filter}
          onChange={(f) => update(kind, f)}
          tabs={[
            { value: 'open', label: t('admin.filterOpen') },
            { value: 'approved', label: t('admin.filterApproved') },
            { value: 'rejected', label: t('admin.filterRejected') },
            { value: 'suspended', label: t('admin.filterSuspended') },
          ]}
        />
      </div>
      <ErrorText error={error} />
      {!rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <p className="card muted page-enter">{t('admin.noApplications')}</p>
      ) : (
        <div className="table-wrap page-enter">
          <table data-testid="applications-table">
            <thead>
              <tr>
                <th scope="col">{t('admin.applicant')}</th>
                <th scope="col">{t('admin.summary')}</th>
                <th scope="col">{t('admin.submitted')}</th>
                <th scope="col">{t('admin.status')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="clickable"
                  tabIndex={0}
                  onClick={() => navigate(`/admin/applications/${r.kind}/${r.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/admin/applications/${r.kind}/${r.id}`)}
                >
                  <td>
                    <strong>{r.applicant?.name ?? '—'}</strong>
                    <div className="muted small">{r.applicant?.phone ?? r.applicant?.email}</div>
                  </td>
                  <td>{r.summary}</td>
                  <td>{fmtDateTime(r.submittedAt)}</td>
                  <td>
                    <StatusChip status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
