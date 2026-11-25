import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import type { AdminSubjectView, Check, DocView } from '../../api/types';
import { Card, ErrorText, Field, Loading, StatusChip, TextArea, fmtDate, fmtDateTime } from '../../components/ui';
import { Checklist, DocViewer, StatusTimeline } from '../../components/partner';
import { Reveal } from '../../components/motion';
import { useAuth } from '../../auth/AuthContext';

const EXPIRING = new Set(['driving_licence', 'insurance']);

/** One document awaiting a decision: view it, approve (with expiry where needed) or reject with a reason. */
function DocReviewRow({ doc, canReview, canView, onDone }: { doc: DocView; canReview: boolean; canView: boolean; onDone: (v: AdminSubjectView) => void }) {
  const { t } = useTranslation();
  const [viewing, setViewing] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<unknown>(null);
  const decide = async (decision: 'approved' | 'rejected') => {
    setError(null);
    try {
      onDone(
        await api<AdminSubjectView>(`/admin/partners/documents/${doc.id}/review`, {
          method: 'POST',
          body: { decision, note: note || null, ...(decision === 'approved' && EXPIRING.has(doc.kind) ? { expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null } : {}) },
        }),
      );
    } catch (err) {
      setError(err);
    }
  };
  return (
    <div className="card flat" style={{ padding: '1rem 1.25rem' }} data-testid={`doc-${doc.kind}`}>
      <div className="row between">
        <div>
          <strong>{t(`docs.${doc.kind}`)}</strong>
          <div className="muted small">
            {fmtDateTime(doc.uploadedAt)}
            {doc.expiresAt ? ` · ${t('docs.expires', { date: fmtDate(doc.expiresAt) })}` : ''}
          </div>
        </div>
        <div className="row">
          <StatusChip status={doc.status} />
          {canView && (
            <button type="button" className="ghost small" onClick={() => setViewing(true)}>
              {t('docs.view')}
            </button>
          )}
        </div>
      </div>
      {doc.status === 'rejected' && doc.reviewNote && <p className="small" style={{ color: 'var(--danger)', margin: '0.5rem 0 0' }}>“{doc.reviewNote}”</p>}
      {canReview && doc.status === 'pending' && (
        <div className="form-grid" style={{ marginTop: '0.9rem' }}>
          {EXPIRING.has(doc.kind) && <Field label={t('admin.expiry')} type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />}
          <Field label={t('admin.docReject')} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="row span-2">
            <button type="button" className="ok small" onClick={() => void decide('approved')} disabled={EXPIRING.has(doc.kind) && !expiresAt}>
              {t('admin.approve')}
            </button>
            <button type="button" className="danger small" onClick={() => void decide('rejected')} disabled={!note.trim()}>
              {t('admin.reject')}
            </button>
          </div>
        </div>
      )}
      <ErrorText error={error} />
      {viewing && <DocViewer doc={doc} onClose={() => setViewing(false)} />}
    </div>
  );
}

function CheckRow({ label, check, onRecord }: { label: string; check: Check | null | undefined; onRecord?: (result: 'passed' | 'failed', notes: string) => Promise<void> }) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState('');
  return (
    <div className="card flat" style={{ padding: '1rem 1.25rem' }}>
      <div className="row between">
        <strong>{label}</strong>
        {check ? <StatusChip status={check.result} /> : <span className="chip">—</span>}
      </div>
      {check?.notes && <p className="muted small" style={{ margin: '0.4rem 0 0' }}>{check.notes}</p>}
      {onRecord && (
        <div className="row" style={{ marginTop: '0.75rem' }}>
          <input aria-label={`${label} ${t('admin.notes')}`} placeholder={t('admin.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
          <button type="button" className="ok small" onClick={() => void onRecord('passed', notes)}>
            {t('admin.pass')}
          </button>
          <button type="button" className="danger small" onClick={() => void onRecord('failed', notes)}>
            {t('admin.fail')}
          </button>
        </div>
      )}
    </div>
  );
}

export function AdminApplicationDetailPage() {
  const { t } = useTranslation();
  const { kind, id } = useParams<{ kind: 'driver' | 'owner' | 'vehicle'; id: string }>();
  const { can } = useAuth();
  const [view, setView] = useState<AdminSubjectView | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(() => {
    api<AdminSubjectView>(`/admin/partners/${kind}/${id}`).then(setView).catch(setError);
  }, [kind, id]);
  useEffect(load, [load]);

  const act = async (path: string, body?: unknown) => {
    setError(null);
    try {
      setView(await api<AdminSubjectView>(`/admin/partners/${kind}/${id}/${path}`, { method: 'POST', body }));
      setReason('');
    } catch (err) {
      setError(err);
    }
  };

  if (!view) return error ? <ErrorText error={error} /> : <Loading />;

  const subject = view.kind === 'vehicle' ? view.vehicle : view.profile;
  const status = subject.status;
  const mayReview = can('partners.review');
  const reviewing = status === 'under_review' && mayReview;
  const canReviewDocs = mayReview && ['applied', 'under_review', 'approved'].includes(status);
  const ready = view.approvalRequirements.every((r) => r.done);

  return (
    <section>
      <p className="eyebrow">
        <Link to={`/admin/applications?kind=${kind}`}>← {t('admin.back')}</Link>
      </p>
      <div className="page-head" style={{ marginBottom: '1rem' }}>
        <div>
          <h1 className="h2" style={{ margin: 0 }}>
            {view.kind === 'vehicle'
              ? `${view.vehicle.make} ${view.vehicle.model} · ${view.vehicle.plate}`
              : [view.applicant?.firstName, view.applicant?.lastName].filter(Boolean).join(' ') || t(`admin.kind${kind === 'driver' ? 'Driver' : 'Owner'}`)}
          </h1>
          {view.kind !== 'vehicle' && view.applicant && (
            <p className="muted" style={{ margin: 0 }}>
              {view.applicant.phone ?? ''} {view.applicant.email ? `· ${view.applicant.email}` : ''}
            </p>
          )}
        </div>
        <StatusChip status={status} />
      </div>
      <StatusTimeline status={status} />

      <div className="split">
        <div className="grid">
          <Reveal>
            <Card title={t('partner.details')}>
              <dl className="facts">
                {view.kind === 'driver' && (
                  <>
                    <dt>{t('partner.contactPhone')}</dt>
                    <dd>{view.profile.contactPhone ?? '—'}</dd>
                    <dt>{t('partner.licenceNumber')}</dt>
                    <dd>{view.profile.licenceNumber ?? '—'}</dd>
                    <dt>{t('partner.licenceExpiry')}</dt>
                    <dd>{fmtDate(view.profile.licenceExpiry)}</dd>
                    <dt>{t('partner.experienceYears')}</dt>
                    <dd>{view.profile.experienceYears ?? '—'}</dd>
                    <dt>{t('partner.areas')}</dt>
                    <dd>{view.profile.areas.join(', ') || '—'}</dd>
                    <dt>{t('partner.languages')}</dt>
                    <dd>{view.profile.languages.join(', ') || '—'}</dd>
                    {view.profile.references.map((r, i) => (
                      <div key={i} style={{ display: 'contents' }}>
                        <dt>
                          {t('partner.references')} {i + 1}
                        </dt>
                        <dd>
                          {r.name} · {r.phone} · {r.relationship}
                        </dd>
                      </div>
                    ))}
                  </>
                )}
                {view.kind === 'owner' && (
                  <>
                    <dt>{t('partner.ownerType')}</dt>
                    <dd>{view.profile.type ? t(`partner.${view.profile.type}`) : '—'}</dd>
                    <dt>{t('partner.contactPhone')}</dt>
                    <dd>{view.profile.contactPhone ?? '—'}</dd>
                    {view.profile.type === 'company' && (
                      <>
                        <dt>{t('partner.companyName')}</dt>
                        <dd>{view.profile.companyName ?? '—'}</dd>
                        <dt>{t('partner.rdbNumber')}</dt>
                        <dd>{view.profile.rdbNumber ?? '—'}</dd>
                        <dt>{t('partner.representativeName')}</dt>
                        <dd>{view.profile.representativeName ?? '—'}</dd>
                      </>
                    )}
                    <dt>{t('partner.payout')}</dt>
                    <dd>
                      {view.profile.payout?.method === 'momo'
                        ? `MoMo ${view.profile.payout.momoPhone} · ${view.profile.payout.momoName}`
                        : view.profile.payout
                          ? `${view.profile.payout.bankName} · ${view.profile.payout.accountName}`
                          : '—'}
                    </dd>
                  </>
                )}
                {view.kind === 'vehicle' && (
                  <>
                    <dt>{t('partner.category')}</dt>
                    <dd>{t(`partner.categories.${view.vehicle.category}`)}</dd>
                    <dt>{t('partner.year')}</dt>
                    <dd>{view.vehicle.year}</dd>
                    <dt>{t('partner.colour')}</dt>
                    <dd>{view.vehicle.colour}</dd>
                    <dt>{t('partner.seats')}</dt>
                    <dd>{view.vehicle.seats}</dd>
                    <dt>{t('partner.insurer')}</dt>
                    <dd>
                      {view.vehicle.insurer ?? '—'} · {fmtDate(view.vehicle.insuranceExpiry)}
                    </dd>
                    <dt>{t('partner.rates')}</dt>
                    <dd>
                      {[
                        view.vehicle.proposedRates.hourlyRwf && `${view.vehicle.proposedRates.hourlyRwf.toLocaleString()} / h`,
                        view.vehicle.proposedRates.dailyRwf && `${view.vehicle.proposedRates.dailyRwf.toLocaleString()} / day`,
                        view.vehicle.proposedRates.airportTransferRwf && `${view.vehicle.proposedRates.airportTransferRwf.toLocaleString()} airport`,
                      ]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </dd>
                    <dt>{t('admin.owner')}</dt>
                    <dd>
                      {view.owner ? (
                        <Link to={`/admin/applications/owner/${view.owner.id}`}>
                          {view.owner.companyName ?? t('partner.individual')} <StatusChip status={view.owner.status} />
                        </Link>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </>
                )}
              </dl>
            </Card>
          </Reveal>

          <Reveal index={1}>
            <Card title={t('partner.documents')}>
              <div className="grid">
                {view.documents.length === 0 && <p className="muted">—</p>}
                {view.documents.map((d) => (
                  <DocReviewRow key={d.id} doc={d} canReview={canReviewDocs} canView={can('documents.view')} onDone={setView} />
                ))}
              </div>
            </Card>
          </Reveal>

          {(view.kind === 'driver' || view.kind === 'vehicle') && (
            <Reveal index={2}>
              <Card title={view.kind === 'driver' ? t('admin.checks') : t('admin.inspection')}>
                <div className="grid">
                  {view.kind === 'driver'
                    ? (['interview', 'drivingTest', 'references'] as const).map((c) => (
                        <CheckRow
                          key={c}
                          label={t(`admin.check_${c}`)}
                          check={view.checks[c]}
                          onRecord={reviewing ? (result, notes) => act('checks', { check: c, result, notes: notes || null }) : undefined}
                        />
                      ))
                    : (
                        <CheckRow
                          label={t('admin.inspection')}
                          check={view.vehicle.inspection}
                          onRecord={reviewing ? (result, notes) => act('inspection', { result, notes: notes || null }) : undefined}
                        />
                      )}
                </div>
              </Card>
            </Reveal>
          )}
        </div>

        <div className="grid" style={{ position: 'sticky', top: 90 }}>
          <Reveal index={1}>
            <Card>
              <Checklist items={view.approvalRequirements} title={t('admin.approvalChecklist')} />
              {'eligibility' in view && (
                <p className="small" style={{ marginTop: '1rem' }}>
                  {t('admin.eligibility')}: <strong className={view.eligibility.assignable ? 'success' : ''}>{view.eligibility.assignable ? t('admin.eligibleYes') : t('admin.eligibleNo')}</strong>
                  {!view.eligibility.assignable && <span className="muted"> ({view.eligibility.reasons.join(', ').replace(/_/g, ' ')})</span>}
                </p>
              )}
              <hr className="divider" />
              <ErrorText error={error} />
              {status === 'applied' && mayReview && (
                <button type="button" style={{ width: '100%' }} onClick={() => void act('start-review')}>
                  {t('admin.startReview')}
                </button>
              )}
              {reviewing && (
                <>
                  <TextArea label={t('admin.rejectReason')} value={reason} onChange={(e) => setReason(e.target.value)} />
                  <div className="row">
                    <button type="button" className="ok" disabled={!ready} onClick={() => void act('decision', { decision: 'approve' })}>
                      {t('admin.approve')}
                    </button>
                    <button type="button" className="danger" disabled={reason.trim().length < 3} onClick={() => void act('decision', { decision: 'reject', reason })}>
                      {t('admin.reject')}
                    </button>
                  </div>
                </>
              )}
              {(status === 'approved' || status === 'suspended') && can('partners.suspend') && (
                <>
                  <Field label={t('admin.suspendReason')} value={reason} onChange={(e) => setReason(e.target.value)} />
                  <button
                    type="button"
                    className={status === 'approved' ? 'danger' : 'ok'}
                    disabled={reason.trim().length < 3}
                    onClick={() => void act(status === 'approved' ? 'suspend' : 'reinstate', { reason })}
                  >
                    {status === 'approved' ? t('admin.suspend') : t('admin.reinstate')}
                  </button>
                </>
              )}
            </Card>
          </Reveal>
          <Reveal index={2}>
            <Card title={t('admin.history')}>
              <ul className="checklist">
                {subject.statusHistory.map((h, i) => (
                  <li key={i} className="done">
                    <span>
                      <strong>{t(`status.${h.to}`)}</strong> <span className="muted small">{fmtDateTime(h.at)}</span>
                      {h.reason && <span className="muted small"> · {h.reason}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
