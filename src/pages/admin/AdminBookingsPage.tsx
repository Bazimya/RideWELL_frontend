import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import type { BookingListRow, OpsAlert, StaffBooking } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { Card, ErrorText, Field, Loading, StatusChip } from '../../components/ui';
import { SlidingTabs } from '../../components/motion';
import { BookingForm, draftToBody, emptyDraft, type BookingDraft } from '../../components/BookingForm';
import { fmtKigali, fmtRwf } from '../../components/time';
import { serviceLabel } from '../BookingsPage';

type Filter = 'attention' | 'new' | 'quoted' | 'active' | 'done' | 'all';
const FILTERS: Record<Filter, string> = {
  attention: '',
  new: 'requested',
  quoted: 'quoted',
  active: 'paid,assigned,in_progress',
  done: 'completed,cancelled,expired,refunded',
  all: '',
};

function Alerts({ onChange }: { onChange: () => void }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [alerts, setAlerts] = useState<OpsAlert[] | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const [text, setText] = useState('');
  const load = useCallback(() => {
    api<{ alerts: OpsAlert[] }>('/admin/alerts').then((r) => setAlerts(r.alerts)).catch(() => setAlerts([]));
  }, []);
  useEffect(() => {
    load();
    const iv = window.setInterval(load, 20_000);
    return () => window.clearInterval(iv);
  }, [load]);
  if (!alerts) return null;
  return (
    <Card title={t('ops.alerts')}>
      {alerts.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          {t('ops.noAlerts')}
        </p>
      ) : (
        <div className="grid" data-testid="alerts">
          {alerts.map((a) => (
            <div key={a.id} className={`notice ${a.severity === 'high' ? 'bad' : 'warn'}`} style={{ margin: 0 }}>
              <div className="row between">
                <span>
                  <strong>{a.message}</strong> <span className="muted small">· {fmtKigali(a.createdAt)}</span>
                </span>
                <span className="row">
                  {a.bookingId && (
                    <Link className="btn ghost small" to={`/admin/bookings/${a.bookingId}`}>
                      {a.bookingRef}
                    </Link>
                  )}
                  {(can('bookings.manage') || can('safety.handle')) && (
                    <button type="button" className="ghost small" onClick={() => setResolving(resolving === a.id ? null : a.id)}>
                      {t('ops.resolve')}
                    </button>
                  )}
                </span>
              </div>
              {resolving === a.id && (
                <div className="row" style={{ marginTop: '0.6rem' }}>
                  <input aria-label={t('ops.resolution')} placeholder={t('ops.resolution')} value={text} onChange={(e) => setText(e.target.value)} style={{ flex: 1 }} />
                  <button
                    type="button"
                    className="small"
                    disabled={text.trim().length < 1}
                    onClick={async () => {
                      await api(`/admin/alerts/${a.id}/resolve`, { method: 'POST', body: { resolution: text.trim() } });
                      setText('');
                      setResolving(null);
                      load();
                      onChange();
                    }}
                  >
                    {t('ops.resolve')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function PhoneBooking({ onDone }: { onDone: (id: string) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<BookingDraft>(emptyDraft('chauffeur'));
  const [phone, setPhone] = useState('');
  const [first, setFirst] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Card title={t('ops.newPhone')}>
      <div className="form-grid">
        <Field label={t('ops.customerPhone')} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Field label={t('ops.customerFirst')} value={first} onChange={(e) => setFirst(e.target.value)} />
      </div>
      <BookingForm
        value={draft}
        onChange={setDraft}
        busy={busy || phone.trim().length < 6}
        submitLabel={t('ops.create')}
        footer={<ErrorText error={error} />}
        onSubmit={async (d) => {
          setBusy(true);
          setError(null);
          try {
            const b = await api<StaffBooking>('/admin/bookings', { method: 'POST', body: { ...draftToBody(d, t('booking.airportName')), customerPhone: phone, ...(first ? { customerFirstName: first } : {}) } });
            onDone(b.id);
          } catch (err) {
            setError(err);
          } finally {
            setBusy(false);
          }
        }}
      />
    </Card>
  );
}

export function AdminBookingsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filter = (params.get('filter') as Filter) || 'attention';
  const [rows, setRows] = useState<BookingListRow[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [showPhone, setShowPhone] = useState(false);

  const load = useCallback(() => {
    const q = filter === 'attention' ? 'attention=true' : FILTERS[filter] ? `status=${FILTERS[filter]}` : '';
    api<{ bookings: BookingListRow[] }>(`/admin/bookings?${q}`).then((r) => setRows(r.bookings)).catch(setError);
  }, [filter]);
  useEffect(() => {
    setRows(null);
    load();
    const iv = window.setInterval(load, 20_000);
    return () => window.clearInterval(iv);
  }, [load]);

  return (
    <section className="grid">
      <div className="row between">
        <h1 className="h2" style={{ margin: 0 }}>
          {t('ops.title')}
        </h1>
        {can('bookings.manage') && (
          <button type="button" className="ghost small" onClick={() => setShowPhone(!showPhone)}>
            + {t('ops.newPhone')}
          </button>
        )}
      </div>
      {showPhone && <PhoneBooking onDone={(id) => navigate(`/admin/bookings/${id}`)} />}
      <Alerts onChange={load} />
      <SlidingTabs<Filter>
        label={t('ops.title')}
        value={filter}
        onChange={(f) => setParams({ filter: f }, { replace: true })}
        tabs={[
          { value: 'attention', label: t('ops.filterAttention') },
          { value: 'new', label: t('ops.filterNew') },
          { value: 'quoted', label: t('ops.filterQuoted') },
          { value: 'active', label: t('ops.filterActive') },
          { value: 'done', label: t('ops.filterDone') },
          { value: 'all', label: t('ops.filterAll') },
        ]}
      />
      <ErrorText error={error} />
      {!rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <p className="card muted">{t('ops.none')}</p>
      ) : (
        <div className="table-wrap page-enter">
          <table data-testid="bookings-table">
            <thead>
              <tr>
                <th scope="col">{t('booking.ref')}</th>
                <th scope="col">{t('booking.when')}</th>
                <th scope="col">{t('booking.service')}</th>
                <th scope="col">{t('booking.from')}</th>
                <th scope="col">RWF</th>
                <th scope="col">{t('trips.status')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="clickable" tabIndex={0} onClick={() => navigate(`/admin/bookings/${b.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/admin/bookings/${b.id}`)}>
                  <td>
                    <strong>{b.ref}</strong>
                    {b.needsAttention && <div className="small" style={{ color: 'var(--danger)' }}>{b.attentionReason}</div>}
                  </td>
                  <td>{fmtKigali(b.startAt)}</td>
                  <td>{serviceLabel(t, b)}</td>
                  <td style={{ maxWidth: 260 }}>{b.pickup}</td>
                  <td>{fmtRwf(b.quoteAmountRwf)}</td>
                  <td>
                    <StatusChip status={b.status} />
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
