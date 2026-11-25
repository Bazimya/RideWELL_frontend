import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { Card, ErrorText, Field } from '../ui';
import { MapView, type MapMarker } from '../maps/MapView';
import { fmtKigali } from '../time';
import { LocationFreshness, markersFor } from './TrackingCard';
import type { TrackingPlace, TrackingPoint } from './useTracking';

interface StaffTracking {
  eligible: boolean;
  basis: 'safety_report' | 'trip_not_started' | null;
  access: null | {
    reason: string;
    expiresAt: string;
    status: string;
    driverLocation: TrackingPoint | null;
    pickup: TrackingPlace | null;
    dropoff: TrackingPlace | null;
    trail: Array<{ lat: number; lng: number; accuracyM: number; recordedAt: string }>;
  };
}

/**
 * Break-glass: shown only while the booking has an open safety report or a
 * trip-not-started alert. Opening needs a written reason; every access is logged.
 */
export function EmergencyLocation({ bookingId }: { bookingId: string }) {
  const { t } = useTranslation();
  const [data, setData] = useState<StaffTracking | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(() => {
    api<StaffTracking>(`/admin/bookings/${bookingId}/tracking`).then(setData).catch(setError);
  }, [bookingId]);
  useEffect(load, [load]);
  useEffect(() => {
    if (!data?.access) return;
    const iv = window.setInterval(load, 15_000);
    return () => window.clearInterval(iv);
  }, [data?.access, load]);
  const markers = useMemo<MapMarker[]>(() => {
    if (!data?.access) return [];
    const a = data.access;
    return [...a.trail.slice(1).map((p) => ({ lat: p.lat, lng: p.lng, kind: 'trail' as const, label: '' })), ...markersFor(a, { driver: t('tracking.driver'), pickup: t('tracking.pickup'), dropoff: t('tracking.dropoff') })];
  }, [data, t]);
  if (!data || !data.eligible) return null;
  const basis = data.basis === 'safety_report' ? t('tracking.basisSafety') : t('tracking.basisNotStarted');
  return (
    <Card title={t('tracking.emergencyTitle')}>
      <div data-testid="emergency-location">
        <ErrorText error={error} />
        {!data.access ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              try {
                setData(await api<StaffTracking>(`/admin/bookings/${bookingId}/tracking-access`, { method: 'POST', body: { reason: reason.trim() } }));
              } catch (err) {
                setError(err);
              }
            }}
          >
            <p className="notice warn small">{t('tracking.emergencyIntro', { basis })}</p>
            <Field label={t('tracking.emergencyReason')} value={reason} onChange={(e) => setReason(e.target.value)} />
            <button type="submit" className="danger small" disabled={reason.trim().length < 10}>
              {t('tracking.emergencyOpen')}
            </button>
          </form>
        ) : (
          <>
            <p className="small muted">
              {basis} · {t('tracking.emergencyReasonShown')}: “{data.access.reason}” · {t('tracking.emergencyLogged')}
            </p>
            {data.access.driverLocation ? (
              <>
                <MapView markers={markers} />
                <LocationFreshness point={data.access.driverLocation} intervalSeconds={10} />
                <p className="hint">
                  {t('tracking.lastKnown')}: {fmtKigali(data.access.driverLocation.recordedAt)} · {data.access.trail.length} {t('tracking.points')}
                </p>
              </>
            ) : (
              <p className="muted">{t('tracking.noLocation')}</p>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
