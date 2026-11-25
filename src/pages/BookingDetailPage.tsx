import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api, authorizedBlobUrl } from '../api/client';
import type { BookingStatus, CustomerBooking } from '../api/types';
import { Card, ErrorText, Loading, StatusChip, TextArea } from '../components/ui';
import { Reveal } from '../components/motion';
import { fmtKigali, fmtRwf } from '../components/time';
import { TrackingCard } from '../components/tracking/TrackingCard';
import { serviceLabel } from './BookingsPage';

const FLOW: BookingStatus[] = ['requested', 'quoted', 'paid', 'assigned', 'in_progress', 'completed'];

export function BookingTimeline({ status, history }: { status: BookingStatus; history: Array<{ to: string; at: string }> }) {
  const { t } = useTranslation();
  const off = !FLOW.includes(status);
  const reached = new Map(history.map((h) => [h.to, h.at]));
  const current = FLOW.indexOf(status);
  return (
    <ol className="timeline" aria-label="Booking progress">
      {FLOW.map((s, i) => (
        <li key={s} className={`${!off && i <= current ? 'done' : reached.has(s) ? 'done' : ''} ${!off && i === current ? 'current' : ''}`}>
          {t(`status.${s}`)}
          {reached.get(s) && <div className="hint">{fmtKigali(reached.get(s)!, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</div>}
        </li>
      ))}
    </ol>
  );
}

function DriverPhoto({ bookingId }: { bookingId: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    authorizedBlobUrl(`/bookings/${bookingId}/driver-photo`)
      .then((u) => {
        url = u;
        setSrc(u);
      })
      .catch(() => setSrc(null));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [bookingId]);
  return src ? <img className="driver-photo" src={src} alt="" /> : <div className="driver-photo" aria-hidden="true" />;
}

function RateDriver({ b, onRated }: { b: CustomerBooking; onRated: (b: CustomerBooking) => void }) {
  const { t } = useTranslation();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  if (b.rating) {
    return (
      <Card title={t('rating.yours')}>
        <p className="stars" aria-label={t('rating.outOf', { stars: b.rating.stars })} data-testid="rating-given">
          {'★'.repeat(b.rating.stars)}
          <span className="muted">{'★'.repeat(5 - b.rating.stars)}</span>
        </p>
        {b.rating.comment && <p style={{ margin: 0 }}>{b.rating.comment}</p>}
      </Card>
    );
  }
  if (!b.canRate) return null;
  return (
    <Card title={t('rating.title', { name: b.driver?.firstName ?? t('booking.yourDriver') })}>
      <div className="star-input" role="radiogroup" aria-label={t('rating.label')}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={stars === n}
            aria-label={t('rating.outOf', { stars: n })}
            className={n <= stars ? 'on' : ''}
            data-testid={`star-${n}`}
            onClick={() => setStars(n)}
          >
            ★
          </button>
        ))}
      </div>
      <TextArea label={t('rating.comment')} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
      <p className="hint">{t('rating.hint')}</p>
      <ErrorText error={error} />
      <button
        type="button"
        disabled={busy || stars === 0}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            onRated(await api<CustomerBooking>(`/bookings/${b.id}/rating`, { method: 'POST', body: { stars, comment: comment.trim() || null } }));
          } catch (err) {
            setError(err);
          } finally {
            setBusy(false);
          }
        }}
      >
        {t('rating.send')}
      </button>
    </Card>
  );
}

const REFUND_STATUS_KEY = { requested: 'booking.refundRequested', completed: 'booking.refundCompleted', rejected: 'booking.refundRejected', failed: 'booking.refundFailed' } as const;

export function BookingDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const location = useLocation();
  const [b, setB] = useState<CustomerBooking | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [safety, setSafety] = useState('');
  const [safetySent, setSafetySent] = useState(false);

  const load = useCallback(() => {
    api<CustomerBooking>(`/bookings/${id}`).then(setB).catch(setError);
  }, [id]);
  useEffect(() => {
    load();
    // Live-ish status: refresh every 20 s while the page is open.
    const iv = window.setInterval(load, 20_000);
    return () => window.clearInterval(iv);
  }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (!b) return <div className="page container">{error ? <ErrorText error={error} /> : <Loading />}</div>;

  return (
    <div className="page container" style={{ maxWidth: 860 }}>
      <Reveal className="page-head">
        <div>
          <p className="eyebrow">
            <Link to="/bookings">← {t('booking.myBookings')}</Link>
          </p>
          <h1 style={{ marginBottom: '0.2rem' }}>{serviceLabel(t, b)}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {t('booking.ref')} <strong data-testid="booking-ref">{b.ref}</strong> · {fmtKigali(b.startAt)}
          </p>
        </div>
        <StatusChip status={b.status} />
      </Reveal>
      {(location.state as { justBooked?: boolean } | null)?.justBooked && b.status === 'requested' && (
        <p className="notice good">
          <strong>{t('booking.sent')}.</strong> {t('booking.howNext')}
        </p>
      )}
      <Reveal index={1}>
        <BookingTimeline status={b.status} history={b.history} />
      </Reveal>
      <ErrorText error={error} />

      <div className="grid">
        {/* Driver and PIN, once confirmed */}
        {b.driver && (
          <Reveal index={2}>
            <Card title={t('booking.yourDriver')}>
              <div className="row" style={{ gap: '1rem', alignItems: 'center' }}>
                {b.driver.hasPhoto && <DriverPhoto bookingId={b.id} />}
                <div>
                  <strong style={{ fontSize: '1.2rem' }} data-testid="driver-name">
                    {b.driver.firstName}
                  </strong>
                  {b.vehicle && (
                    <div className="muted">
                      {b.vehicle.colour} {b.vehicle.make} {b.vehicle.model} · <strong style={{ color: 'var(--text)' }}>{b.vehicle.plate}</strong>
                    </div>
                  )}
                </div>
              </div>
              {b.tripPin && (
                <div style={{ marginTop: '1.25rem' }}>
                  <p className="eyebrow" style={{ marginBottom: 0 }}>
                    {t('booking.pin')}
                  </p>
                  <p className="pin" data-testid="trip-pin">
                    {b.tripPin}
                  </p>
                  <p className="hint">{t('booking.pinHint')}</p>
                </div>
              )}
            </Card>
          </Reveal>
        )}

        {(b.status === 'assigned' || b.status === 'in_progress') && (
          <Reveal index={3}>
            <TrackingCard bookingId={b.id} as="customer" driverName={b.driver?.firstName} />
          </Reveal>
        )}

        {/* Quote and payment */}
        {b.quote && (
          <Reveal index={3}>
            <Card title={t('booking.quote')}>
              <p className="big-amount" style={{ margin: 0 }}>
                {fmtRwf(b.quote.amountRwf)} <span className="muted" style={{ fontSize: '1rem' }}>RWF</span>
              </p>
              {b.status === 'quoted' && <p className="muted">{t('booking.quoteValid', { time: fmtKigali(b.quote.validUntil) })}</p>}
              {b.quote.note && (
                <p className="notice small">
                  <strong>{t('booking.quoteNote')}:</strong> {b.quote.note}
                </p>
              )}
              {b.canPay && (
                <>
                  <button type="button" disabled={busy} onClick={() => void act(() => api(`/bookings/${b.id}/pay`, { method: 'POST' }))}>
                    {t('booking.payDev', { amount: fmtRwf(b.quote.amountRwf) })}
                  </button>
                  <p className="hint" style={{ marginTop: '0.5rem' }}>
                    {t('booking.payDevHint')}
                  </p>
                </>
              )}
              {b.payment && (
                <p className="success" style={{ marginBottom: 0 }}>
                  {t('booking.paid', { amount: fmtRwf(b.payment.amountRwf) })}
                  {b.payment.isDevelopment && <span className="muted small"> · {t('booking.paidDev')}</span>}
                </p>
              )}
              {b.status === 'paid' && <p className="notice small">{t('booking.waitingDriver')}</p>}
            </Card>
          </Reveal>
        )}

        {/* Trip details */}
        <Reveal index={4}>
          <Card>
            <dl className="facts">
              <dt>{t('booking.when')}</dt>
              <dd>{fmtKigali(b.startAt)}</dd>
              <dt>{t('booking.until')}</dt>
              <dd>{fmtKigali(b.endAt)}</dd>
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
              <dt>{t('booking.passengers')}</dt>
              <dd>{b.passengers}</dd>
              {b.customerVehicle?.make && (
                <>
                  <dt>{t('booking.yourCar')}</dt>
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
            </dl>
          </Card>
        </Reveal>

        {b.cancellation && (
          <p className="notice">
            <strong>{t('booking.cancelled')}</strong> · {fmtKigali(b.cancellation.at)}
            {b.cancellation.refundDueRwf ? ` · ${t('booking.refundDue', { amount: fmtRwf(b.cancellation.refundDueRwf) })}` : ''}
          </p>
        )}

        {b.refunds.map((r, i) => (
          <p key={i} className={`notice ${r.status === 'completed' ? 'good' : r.status === 'failed' ? 'bad' : ''}`} data-testid="refund-status">
            {t('booking.refundStatus', { amount: fmtRwf(r.amountRwf), status: t(REFUND_STATUS_KEY[r.status]) })}
            {r.completedAt ? ` · ${fmtKigali(r.completedAt)}` : ''}
            {r.isDevelopment ? ' · development, no money moved' : ''}
          </p>
        ))}

        <RateDriver b={b} onRated={setB} />

        {b.canReportSafety && (
          <Card title={t('booking.safety')}>
            {safetySent || b.hasOpenSafetyReport ? (
              <p className="notice good">{t('booking.safetySent')}</p>
            ) : (
              <>
                <p className="hint">{t('booking.safetyHint')}</p>
                <TextArea label={t('booking.safetyMessage')} value={safety} onChange={(e) => setSafety(e.target.value)} maxLength={2000} />
                <button
                  type="button"
                  className="danger"
                  disabled={busy || safety.trim().length < 3}
                  onClick={() =>
                    void act(async () => {
                      await api(`/bookings/${b.id}/safety-report`, { method: 'POST', body: { message: safety.trim() } });
                      setSafetySent(true);
                    })
                  }
                >
                  {t('booking.safetySend')}
                </button>
              </>
            )}
          </Card>
        )}

        <p className="muted small" style={{ margin: 0 }}>
          {t('support.needHelp')} <Link to={`/support?booking=${b.id}&ref=${encodeURIComponent(b.ref)}`}>{t('support.askAbout')}</Link>
        </p>

        {b.cancellable && (
          <div className="card flat">
            {b.cancellationPreview && (
              <p className="muted small" style={{ marginTop: 0 }}>
                {b.cancellationPreview.refundDueRwf > 0
                  ? t('booking.refundPreview', { amount: fmtRwf(b.cancellationPreview.refundDueRwf), hours: b.cancellationPreview.hoursBeforePickup })
                  : t('booking.noRefundPreview', { hours: b.cancellationPreview.hoursBeforePickup })}
              </p>
            )}
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={() => window.confirm(t('booking.cancelConfirm')) && void act(() => api(`/bookings/${b.id}/cancel`, { method: 'POST', body: {} }))}
            >
              {t('booking.cancel')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
