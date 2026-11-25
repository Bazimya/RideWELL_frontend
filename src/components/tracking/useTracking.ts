import { useEffect, useRef, useState } from 'react';
import { api, API_BASE, currentAccessToken, refreshSession } from '../../api/client';

export interface TrackingPoint {
  lat: number;
  lng: number;
  accuracyM: number | null;
  recordedAt: string;
  receivedAt: string | null;
}
export interface TrackingPlace {
  address: string;
  lat: number | null;
  lng: number | null;
}
export interface TrackingView {
  bookingId: string;
  status: string;
  state: 'not_yet' | 'open' | 'closed';
  reason?: string | null;
  opensAt: string | null;
  updateIntervalSeconds: number;
  provider: 'dev' | 'google';
  driverLocation: TrackingPoint | null;
  pickup: TrackingPlace | null;
  dropoff: TrackingPlace | null;
  estimate: { to: 'pickup' | 'dropoff'; distanceM: number; durationS: number | null; kind: 'route' | 'straight_line'; computedAt: string } | null;
}

type As = 'customer' | 'driver' | 'owner';
const restPath = (as: As, id: string) => (as === 'customer' ? `/bookings/${id}/tracking` : as === 'driver' ? `/driver/trips/${id}/tracking` : `/owner/trips/${id}/tracking`);

/**
 * The live tracking view for one booking: loaded over REST, then kept current over
 * the WebSocket. If the socket cannot be used it falls back to polling at the
 * update interval. Every message is re-authorised by the server.
 */
export function useTracking(bookingId: string, as: As, enabled = true): { view: TrackingView | null; live: boolean; error: unknown } {
  const [view, setView] = useState<TrackingView | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const retried = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let ws: WebSocket | null = null;
    let poll: number | null = null;

    const load = () =>
      api<TrackingView>(restPath(as, bookingId))
        .then((v) => alive && setView(v))
        .catch((e) => alive && setError(e));
    const startPolling = (seconds = 10) => {
      if (poll === null) poll = window.setInterval(() => void load(), seconds * 1000);
    };

    const connect = () => {
      const token = currentAccessToken();
      if (!token || typeof WebSocket === 'undefined') return startPolling();
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}${API_BASE}/tracking/ws`);
      ws.onopen = () => ws?.send(JSON.stringify({ type: 'auth', token }));
      ws.onmessage = (m) => {
        const msg = JSON.parse(String(m.data)) as { type: string; view?: TrackingView };
        if (msg.type === 'ready') ws?.send(JSON.stringify({ type: 'subscribe', bookingId, as }));
        if (msg.type === 'update' && msg.view && alive) {
          setLive(true);
          setView(msg.view);
        }
      };
      ws.onclose = async (e) => {
        if (!alive) return;
        setLive(false);
        if (e.code === 1000) return void load(); // tracking ended normally
        if (e.code === 4401 && !retried.current && (await refreshSession())) {
          retried.current = true;
          return connect();
        }
        startPolling(); // socket unavailable: keep the view current by polling
      };
    };

    void load().then(connect);
    return () => {
      alive = false;
      ws?.close();
      if (poll !== null) window.clearInterval(poll);
    };
  }, [bookingId, as, enabled]);

  return { view, live, error };
}

/** Re-render every second so "updated 12 s ago" stays true. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(iv);
  }, [ms]);
  return now;
}

export function ago(iso: string, now: number): { seconds: number; text: string } {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  return { seconds: s, text: s < 60 ? `${s} s` : s < 3600 ? `${Math.round(s / 60)} min` : `${Math.round(s / 3600)} h` };
}
