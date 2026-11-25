import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../../api/client';
import { Card } from '../ui';
import { fmtKigali } from '../time';
import { ago, useNow, useTracking } from './useTracking';

type WakeLockSentinel = { release(): Promise<void> };

/**
 * The driver shares their location while this page is open. Nothing runs in the
 * background: closing or leaving the page stops sharing, and the server refuses
 * points outside the trip's tracking window.
 */
export function ShareLocation({ bookingId }: { bookingId: string }) {
  const { t } = useTranslation();
  const { view } = useTracking(bookingId, 'driver');
  const [sharing, setSharing] = useState(false);
  const [last, setLast] = useState<{ at: string; accuracyM: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const watch = useRef<number | null>(null);
  const timer = useRef<number | null>(null);
  const latest = useRef<GeolocationPosition | null>(null);
  const lastSent = useRef(0);
  const wake = useRef<WakeLockSentinel | null>(null);
  const now = useNow();
  const interval = (view?.updateIntervalSeconds ?? 10) * 1000;

  const stop = () => {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    if (timer.current !== null) window.clearInterval(timer.current);
    watch.current = null;
    timer.current = null;
    latest.current = null;
    void wake.current?.release().catch(() => undefined);
    wake.current = null;
    setSharing(false);
  };
  useEffect(() => stop, []);
  useEffect(() => {
    if (view?.state === 'closed') {
      stop();
      setEnded(true);
    }
  }, [view?.state]);

  const start = async () => {
    setProblem(null);
    if (!('geolocation' in navigator)) return setProblem(t('tracking.noGps'));
    // Keep the screen on while sharing, where supported: a locked phone stops sending.
    try {
      wake.current = (await (navigator as unknown as { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinel> } }).wakeLock?.request('screen')) ?? null;
    } catch {
      wake.current = null;
    }
    setSharing(true);
    // The phone reports positions when it likes; we send the latest one every interval.
    // (Sending only on change would go quiet when the driver stops, or after a throttled update.)
    const sendLatest = async () => {
      const pos = latest.current;
      if (!pos || Date.now() - lastSent.current < interval - 250) return;
      // An old fix (phone not reporting while still): ask for a fresh one; the next tick sends it.
      if (Date.now() - pos.timestamp > 30_000) {
        navigator.geolocation.getCurrentPosition((p) => (latest.current = p), () => undefined, { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 });
      }
      lastSent.current = Date.now();
      const body = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracyM: Math.round(pos.coords.accuracy),
        // When the phone measured this position, never the send time: viewers see its true age.
        recordedAt: new Date(pos.timestamp).toISOString(),
        headingDeg: pos.coords.heading ?? null,
        speedMps: pos.coords.speed ?? null,
      };
      try {
        const r = await api<{ accepted: boolean }>(`/driver/trips/${bookingId}/location`, { method: 'POST', body });
        if (r.accepted) setLast({ at: body.recordedAt, accuracyM: body.accuracyM });
        setProblem(null);
      } catch (err) {
        if (err instanceof ApiError && (err.code === 'tracking_closed' || err.code === 'tracking_not_open')) {
          stop();
          if (err.code === 'tracking_closed') setEnded(true);
          setProblem(err.message);
        } else setProblem(t('tracking.sendFailed'));
      }
    };
    timer.current = window.setInterval(() => void sendLatest(), interval);
    watch.current = navigator.geolocation.watchPosition(
      (pos) => {
        const first = !latest.current;
        latest.current = pos;
        if (first) void sendLatest();
      },
      (err) => {
        setProblem(err.code === err.PERMISSION_DENIED ? t('tracking.gpsDenied') : t('tracking.gpsLost'));
        if (err.code === err.PERMISSION_DENIED) stop();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30_000 },
    );
  };

  if (!view || ended) return ended ? <p className="notice small">{t('tracking.sharingEnded')}</p> : null;
  return (
    <Card title={t('tracking.shareTitle')}>
      <div data-testid="share-location">
        {view.state === 'not_yet' ? (
          <p className="muted">{t('tracking.shareNotYet', { time: view.opensAt ? fmtKigali(view.opensAt) : '—' })}</p>
        ) : (
          <>
            {sharing ? (
              <p className="small" data-testid="sharing-status">
                <span className="live-dot" aria-hidden="true" /> {t('tracking.sharing')}
                {last && ` · ${t('tracking.lastSent', { ago: ago(last.at, now).text })} · ${t('tracking.accuracy', { m: last.accuracyM })}`}
              </p>
            ) : (
              <p className="muted small">{t('tracking.shareIntro')}</p>
            )}
            <button type="button" className={sharing ? 'ghost' : ''} onClick={() => (sharing ? stop() : void start())}>
              {sharing ? t('tracking.stopSharing') : t('tracking.startSharing')}
            </button>
          </>
        )}
        {problem && <p className="notice warn small">{problem}</p>}
        <p className="hint">{t('tracking.shareHonest')}</p>
      </div>
    </Card>
  );
}
