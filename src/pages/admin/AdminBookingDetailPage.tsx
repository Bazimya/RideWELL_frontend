import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import type { Candidate, StaffBooking } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { Card, ErrorText, Field, Loading, StatusChip } from '../../components/ui';
import { Reveal } from '../../components/motion';
import { fmtKigali, fmtRwf } from '../../components/time';
import { serviceLabel } from '../BookingsPage';
import { BookingTimeline } from '../BookingDetailPage';
import { BookingFinanceCard } from './BookingFinanceCard';
import { EmergencyLocation } from '../../components/tracking/EmergencyLocation';

const REASON_TEXT: Record<string, string> = {
  not_accepting_trips: 'not accepting trips',
  marked_unavailable: 'marked unavailable',
  booked_at_this_time: 'booked at this time',
  licence_expired_or_missing: 'licence expires before the trip ends',
  insurance_expired_or_missing: 'insurance expires before the trip ends',
  not_enough_seats: 'not enough seats',
  paused_safety_review: 'paused (safety review)',
};

function Picker({ title, items, value, onChange, name }: { title: string; items: Candidate[]; value: string; onChange: (id: string) => void; name: string }) {
  const { t } = useTranslation();
  return (
    <div>
      <h3>{title}</h3>
      <div className="grid" style={{ gap: '0.5rem' }} role="radiogroup" aria-label={title}>
        {items.map((c) => (
          <label key={c.id} className={`candidate ${value === c.id ? 'selected' : ''} ${c.available ? '' : 'disabled'}`} data-testid={`candidate-${c.label}`}>
            <input type="radio" name={name} value={c.id} checked={value === c.id} disabled={!c.available} onChange={() => onChange(c.id)} />
            <span style={{ flex: 1 }}>
              <strong>{c.label}</strong>
              <span className="muted small" style={{ display: 'block' }}>
                {c.detail}
              </span>
              {!c.available && (
                <span className="small" style={{ color: 'var(--danger)' }}>
                  {t('ops.unavailable')}: {c.reasons.map((r) => REASON_TEXT[r.split(' ')[0]!] ?? r).join(', ')}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

/** Same integer split the server makes (preview only; the server computes and stores the real one). */
function previewSplit(total: number, shares: Record<string, number>) {
  const out: Record<string, number> = {};
  let allocated = 0;
  for (const [k, bps] of Object.entries(shares)) {
    if (k === 'platform') continue;
    out[k] = Math.floor((total * bps) / 10_000);
    allocated += out[k]!;
  }
  out.platform = total - allocated;
  return out;
}

export function AdminBookingDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { can } = useAuth();
  const [b, setB] = useState<StaffBooking | null>(null);
  const [cands, setCands] = useState<{ drivers: Candidate[]; vehicles: Candidate[] } | null>(null);
  const [cfg, setCfg] = useState<{ version: number; isPlaceholder: boolean; values: { shares: Record<string, Record<string, number>> } } | null>(null);
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [amount, setAmount] = useState('');
  const [duration, setDuration] = useState('');
  const [note, setNote] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [fullRefund, setFullRefund] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const manage = can('bookings.manage');

  const load = useCallback(async () => {
    try {
      const bk = await api<StaffBooking>(`/admin/bookings/${id}`);
      setB(bk);
      setDriverId(bk.driver?.id ?? '');
      setVehicleId(bk.vehicle?.id ?? '');
      setAmount(bk.quote ? String(bk.quote.amountRwf) : '');
      setDuration(String(Math.round((new Date(bk.endAt).getTime() - new Date(bk.startAt).getTime()) / 3_600_000)));
      if (manage && ['requested', 'quoted', 'paid', 'assigned'].includes(bk.status)) {
        setCands(await api(`/admin/bookings/${id}/candidates`));
      }
    } catch (err) {
      setError(err);
    }
  }, [id, manage]);
  useEffect(() => {
    void load();
    if (can('config.view')) api<{ config: typeof cfg }>('/admin/config').then((r) => setCfg(r.config)).catch(() => undefined);
  }, [load, can]);

  const split = useMemo(() => {
    if (!b || !cfg || !Number(amount)) return null;
    const s = b.service === 'driver_on_demand' ? cfg.values.shares.driver_on_demand! : cfg.values.shares.chauffeur!;
    const shares: Record<string, number> = b.service === 'driver_on_demand' ? { platform: s.platformBps!, driver: s.driverBps! } : { platform: s.platformBps!, driver: s.driverBps!, vehicle_owner: s.vehicleOwnerBps! };
    return previewSplit(Math.round(Number(amount)), shares);
  }, [b, cfg, amount]);

  const act = async (fn: () => Promise<StaffBooking>) => {
    setBusy(true);
    setError(null);
    try {
      setB(await fn());
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (!b) return error ? <ErrorText error={error} /> : <Loading />;
  const chauffeur = b.service === 'chauffeur';
  const quotable = b.status === 'requested' || b.status === 'quoted';
  const reassignable = b.status === 'paid' || b.status === 'assigned';

  return (
    <section>
      <p className="eyebrow">
        <Link to="/admin/bookings">← {t('ops.back')}</Link>
      </p>
      <div className="page-head" style={{ marginBottom: '1rem' }}>
        <div>
          <h1 className="h2" style={{ margin: 0 }} data-testid="staff-booking-ref">
            {b.ref} · {serviceLabel(t, b)}
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            {fmtKigali(b.startAt)} → {fmtKigali(b.endAt, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })} · {t('booking.passengersN', { count: b.passengers })} · {b.channel}
          </p>
        </div>
        <StatusChip status={b.status} />
      </div>
      <BookingTimeline status={b.status} history={b.history} />
      {(b.attention.needsReassignment || b.pinLocked || b.hasOpenSafetyReport) && (
        <p className="notice bad">
          <strong>{t('ops.attention')}:</strong> {b.attention.reason ?? ''} {b.pinLocked ? t('ops.pinLocked', { count: b.pinFailedAttempts }) : ''}{' '}
          {b.hasOpenSafetyReport ? <Link to="/admin/safety">{t('ops.navSafety')}</Link> : null}
        </p>
      )}
      <ErrorText error={error} />

      <div className="split">
        <div className="grid">
          <Reveal>
            <Card>
              <dl className="facts">
                <dt>{t('ops.customer')}</dt>
                <dd>
                  {b.customer?.name || '—'} {b.customer?.phone && <a href={`tel:${b.customer.phone}`}>{b.customer.phone}</a>} {b.customer?.email ?? ''}
                </dd>
                <dt>{t('booking.from')}</dt>
                <dd>{b.pickup.address}</dd>
                {b.dropoff && (
                  <>
                    <dt>{t('booking.to')}</dt>
                    <dd>{b.dropoff.address}</dd>
                  </>
                )}
                {b.airport?.flightNumber && (
                  <>
                    <dt>{t('trips.flight')}</dt>
                    <dd>{b.airport.flightNumber}</dd>
                  </>
                )}
                {b.customerVehicle?.make && (
                  <>
                    <dt>{t('trips.theirCar')}</dt>
                    <dd>
                      {b.customerVehicle.make} {b.customerVehicle.model} · {b.customerVehicle.plate}
                    </dd>
                  </>
                )}
                {b.notes && (
                  <>
                    <dt>{t('trips.notes')}</dt>
                    <dd>{b.notes}</dd>
                  </>
                )}
                <dt>{t('ops.driver')}</dt>
                <dd>{b.driver ? `${b.driver.name} · ${b.driver.phone ?? ''}` : '—'}</dd>
                {chauffeur && (
                  <>
                    <dt>{t('ops.vehicle')}</dt>
                    <dd>{b.vehicle ? `${b.vehicle.make} ${b.vehicle.model} · ${b.vehicle.plate}` : '—'}</dd>
                  </>
                )}
                {b.quote && (
                  <>
                    <dt>{t('booking.quote')}</dt>
                    <dd>
                      {fmtRwf(b.quote.amountRwf)} RWF · {t('booking.quoteValid', { time: fmtKigali(b.quote.validUntil) })}
                    </dd>
                  </>
                )}
                {b.commissionSnapshot && (
                  <>
                    <dt>{t('ops.split', { version: `v${b.commissionSnapshot.configVersion}`, placeholder: b.commissionSnapshot.isPlaceholder ? t('ops.placeholder') : '' })}</dt>
                    <dd>
                      {Object.entries(b.commissionSnapshot.split)
                        .map(([k, v]) => `${k.replace('_', ' ')} ${fmtRwf(v)}`)
                        .join(' · ')}
                    </dd>
                  </>
                )}
                {b.acceptance?.deadline && b.status === 'paid' && (
                  <>
                    <dt>{t('ops.acceptance')}</dt>
                    <dd>
                      {t('ops.deadline')} {fmtKigali(b.acceptance.deadline)} · {t('ops.driverAccepted')}: {b.acceptance.driverAcceptedAt ? '✓' : t('ops.pending')}
                      {chauffeur ? ` · ${t('ops.ownerAccepted')}: ${b.acceptance.vehicleAcceptedAt ? '✓' : t('ops.pending')}` : ''}
                    </dd>
                  </>
                )}
                {b.cancellation && (
                  <>
                    <dt>{t('booking.cancelled')}</dt>
                    <dd>
                      {fmtKigali(b.cancellation.at)} · {b.cancellation.actorType} · {b.cancellation.reason ?? ''}
                      {b.cancellation.refundDueRwf ? ` · ${t('booking.refundDue', { amount: fmtRwf(b.cancellation.refundDueRwf) })}` : ''}
                    </dd>
                  </>
                )}
              </dl>
            </Card>
          </Reveal>

          {manage && cands && (quotable || reassignable) && (
            <Reveal index={1}>
              <Card title={t('ops.choose', { vehicle: chauffeur ? ' & vehicle' : '' })}>
                <div className={chauffeur ? 'grid-2' : 'grid'}>
                  <Picker title={t('ops.driver')} name="driver" items={cands.drivers} value={driverId} onChange={setDriverId} />
                  {chauffeur && <Picker title={t('ops.vehicle')} name="vehicle" items={cands.vehicles} value={vehicleId} onChange={setVehicleId} />}
                </div>
                {quotable ? (
                  <div style={{ marginTop: '1.25rem' }}>
                    <div className="form-grid">
                      <Field label={t('ops.amount')} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
                      <Field label={t('ops.duration')} type="number" min={1} max={336} value={duration} onChange={(e) => setDuration(e.target.value)} />
                      <Field className="span-2" label={t('ops.note')} value={note} onChange={(e) => setNote(e.target.value)} />
                    </div>
                    {split && (
                      <p className="muted small" data-testid="split-preview">
                        {t('ops.split', { version: `v${cfg!.version}`, placeholder: cfg!.isPlaceholder ? t('ops.placeholder') : '' })}:{' '}
                        {Object.entries(split)
                          .map(([k, v]) => `${k.replace('_', ' ')} ${fmtRwf(v)}`)
                          .join(' · ')}
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={busy || !driverId || (chauffeur && !vehicleId) || Number(amount) < 100}
                      onClick={() =>
                        void act(() =>
                          api<StaffBooking>(`/admin/bookings/${b.id}/quote`, {
                            method: 'POST',
                            body: { amountRwf: Number(amount), driverId, ...(chauffeur ? { vehicleId } : {}), durationHours: Number(duration), note: note || null },
                          }),
                        )
                      }
                    >
                      {b.status === 'quoted' ? t('ops.reviseQuote') : t('ops.sendQuote')}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    style={{ marginTop: '1rem' }}
                    disabled={busy || !driverId}
                    onClick={() => void act(() => api<StaffBooking>(`/admin/bookings/${b.id}/assign`, { method: 'POST', body: { driverId, ...(chauffeur ? { vehicleId } : {}) } }))}
                  >
                    {t('ops.saveAssignment')}
                  </button>
                )}
              </Card>
            </Reveal>
          )}

          {b.payments.length > 0 && (
            <Card title={t('ops.payments')}>
              <ul className="checklist">
                {b.payments.map((p) => (
                  <li key={p.id} className={p.status === 'successful' ? 'done' : ''}>
                    {fmtRwf(p.amountRwf)} RWF · {p.provider}
                    {p.isDevelopment ? ' (development, no money moved)' : ''} · {p.status} · {fmtKigali(p.verifiedAt ?? p.createdAt)}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {b.payments.some((p) => p.status === 'successful') && <BookingFinanceCard bookingId={b.id} paid />}
        </div>

        <div className="grid" style={{ position: 'sticky', top: 90 }}>
          {can('tracking.emergency') && <EmergencyLocation bookingId={b.id} />}
          {manage && ['requested', 'quoted', 'paid', 'assigned'].includes(b.status) && (
            <Card title={t('ops.cancel')}>
              <Field label={t('ops.cancelReason')} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
              {(b.status === 'paid' || b.status === 'assigned') && (
                <label className="row" style={{ marginBottom: '1rem', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                  <input type="checkbox" checked={fullRefund} onChange={(e) => setFullRefund(e.target.checked)} /> <span>{t('ops.fullRefund')}</span>
                </label>
              )}
              <button
                type="button"
                className="danger"
                disabled={busy || cancelReason.trim().length < 1}
                onClick={() => void act(() => api<StaffBooking>(`/admin/bookings/${b.id}/cancel`, { method: 'POST', body: { reason: cancelReason, refundMode: fullRefund ? 'full' : 'policy' } }))}
              >
                {t('ops.cancel')}
              </button>
            </Card>
          )}
          {manage && b.status === 'in_progress' && (
            <Card title={t('ops.complete')}>
              <Field label={t('ops.completeReason')} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
              <button type="button" disabled={busy || !cancelReason.trim()} onClick={() => void act(() => api<StaffBooking>(`/admin/bookings/${b.id}/complete`, { method: 'POST', body: { reason: cancelReason } }))}>
                {t('ops.complete')}
              </button>
            </Card>
          )}
          <Card title={t('ops.history')}>
            <ul className="checklist">
              {b.history.map((h, i) => (
                <li key={i} className="done">
                  <span>
                    <strong>{t(`status.${h.to}`)}</strong> <span className="muted small">{fmtKigali(h.at)} · {h.actorType}</span>
                    {h.reason && <span className="muted small"> · {h.reason}</span>}
                  </span>
                </li>
              ))}
              {b.declines.map((d, i) => (
                <li key={`d${i}`}>
                  <span className="small">
                    Declined by {d.role} · {fmtKigali(d.at)} {d.reason ? `· ${d.reason}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </section>
  );
}
