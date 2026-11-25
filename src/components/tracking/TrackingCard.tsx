import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui';
import { MapView, type MapMarker } from '../maps/MapView';
import { fmtKigali } from '../time';
import { ago, useNow, useTracking, type TrackingView } from './useTracking';

const km = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

export function markersFor(v: Pick<TrackingView, 'driverLocation' | 'pickup' | 'dropoff'>, labels: { driver: string; pickup: string; dropoff: string }): MapMarker[] {
  const out: MapMarker[] = [];
  if (v.pickup?.lat != null && v.pickup.lng != null) out.push({ lat: v.pickup.lat, lng: v.pickup.lng, kind: 'pickup', label: labels.pickup });
  if (v.dropoff?.lat != null && v.dropoff.lng != null) out.push({ lat: v.dropoff.lat, lng: v.dropoff.lng, kind: 'dropoff', label: labels.dropoff });
  if (v.driverLocation) out.push({ lat: v.driverLocation.lat, lng: v.driverLocation.lng, kind: 'driver', label: labels.driver, accuracyM: v.driverLocation.accuracyM });
  return out;
}

/** Where the driver is, with its time and accuracy. Never claims continuous tracking. */
export function LocationFreshness({ point, intervalSeconds }: { point: NonNullable<TrackingView['driverLocation']>; intervalSeconds: number }) {
  const { t } = useTranslation();
  const now = useNow();
  const age = ago(point.recordedAt, now);
  const stale = age.seconds > Math.max(120, intervalSeconds * 6);
  return (
    <>
      <p className="small" data-testid="location-freshness" style={{ margin: '0.5rem 0 0' }}>
        <span className={`live-dot ${stale ? 'stale' : ''}`} aria-hidden="true" /> {t('tracking.updated', { ago: age.text })}
        {point.accuracyM != null && ` · ${t('tracking.accuracy', { m: point.accuracyM })}`}
      </p>
      {stale && <p className="notice warn small">{t('tracking.stale', { ago: age.text })}</p>}
    </>
  );
}

export function TrackingCard({ bookingId, as, driverName }: { bookingId: string; as: 'customer' | 'owner'; driverName?: string }) {
  const { t } = useTranslation();
  const { view, live } = useTracking(bookingId, as);
  const markers = useMemo(
    () => (view ? markersFor(view, { driver: driverName ?? t('tracking.driver'), pickup: t('tracking.pickup'), dropoff: t('tracking.dropoff') }) : []),
    [view, driverName, t],
  );
  if (!view || (as === 'owner' && view.state !== 'open')) return null;
  const e = view.estimate;
  return (
    <Card title={t('tracking.title')}>
      <div data-testid="tracking-card" data-live={live ? 'socket' : 'polling'}>
        {view.state === 'not_yet' && <p className="muted">{t('tracking.notYet', { time: view.opensAt ? fmtKigali(view.opensAt) : '—' })}</p>}
        {view.state === 'closed' && <p className="muted">{t('tracking.closed')}</p>}
        {view.state === 'open' && !view.driverLocation && <p className="muted">{t('tracking.waiting')}</p>}
        {view.state === 'open' && view.driverLocation && (
          <>
            <MapView markers={markers} />
            <LocationFreshness point={view.driverLocation} intervalSeconds={view.updateIntervalSeconds} />
            {e && (
              <p className="small" data-testid="tracking-estimate" style={{ margin: '0.3rem 0 0' }}>
                {e.kind === 'route' && e.durationS != null
                  ? t(e.to === 'pickup' ? 'tracking.etaPickup' : 'tracking.etaDropoff', { min: Math.max(1, Math.round(e.durationS / 60)), dist: km(e.distanceM) })
                  : t(e.to === 'pickup' ? 'tracking.straightPickup' : 'tracking.straightDropoff', { dist: km(e.distanceM) })}
              </p>
            )}
          </>
        )}
        {view.state !== 'closed' && <p className="hint">{t('tracking.honest')}</p>}
      </div>
    </Card>
  );
}
