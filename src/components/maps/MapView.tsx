import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMapsConfig } from './useMapsConfig';

export interface MapMarker {
  lat: number;
  lng: number;
  kind: 'driver' | 'pickup' | 'dropoff' | 'trail';
  label: string;
  accuracyM?: number | null;
}

const COLORS: Record<MapMarker['kind'], string> = { driver: 'var(--accent, #c9a45c)', pickup: '#4fb286', dropoff: '#6aa3ff', trail: 'rgba(201,164,92,0.45)' };

/**
 * A map of the trip. With the Google browser key configured it is a Google map.
 * Without it (development) it is an honest to-scale plot of the real coordinates on
 * a plain grid, labelled as such: no map tiles, no streets, nothing invented.
 */
export function MapView({ markers, height = 280 }: { markers: MapMarker[]; height?: number }) {
  const cfg = useMapsConfig();
  if (!markers.length) return null;
  if (cfg?.browserKey) return <GoogleMap apiKey={cfg.browserKey} markers={markers} height={height} />;
  return <PlotMap markers={markers} height={height} />;
}

// ---------------------------------------------------------------------------
// Development: to-scale plot
// ---------------------------------------------------------------------------

function niceMeters(m: number) {
  const steps = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  return steps.find((s) => s >= m) ?? 50000;
}

function PlotMap({ markers, height }: { markers: MapMarker[]; height: number }) {
  const { t } = useTranslation();
  const W = 600;
  const H = Math.round((height / 280) * 300);
  const geo = useMemo(() => {
    const lat0 = markers.reduce((s, m) => s + m.lat, 0) / markers.length;
    const kx = 111_320 * Math.cos((lat0 * Math.PI) / 180); // metres per degree of longitude
    const ky = 110_540; // metres per degree of latitude
    const xs = markers.map((m) => m.lng * kx);
    const ys = markers.map((m) => m.lat * ky);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    const span = Math.max(spanX / W, spanY / H, 400 / Math.min(W, H)); // at least ~400 m across
    const mpp = span * 1.35; // metres per pixel, with padding
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
    const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    const project = (m: { lat: number; lng: number }) => ({ x: W / 2 + (m.lng * kx - cx) / mpp, y: H / 2 - (m.lat * ky - cy) / mpp });
    return { project, mpp };
  }, [markers, H]);
  const bar = niceMeters(geo.mpp * 120);
  const barPx = bar / geo.mpp;
  const ordered = [...markers].sort((a, b) => (a.kind === 'trail' ? -1 : 0) - (b.kind === 'trail' ? -1 : 0));
  return (
    <figure className="map-plot" style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('tracking.mapAria')} style={{ width: '100%', height, display: 'block' }}>
        <defs>
          <pattern id="rw-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#rw-grid)" />
        {ordered.map((m, i) => {
          const p = geo.project(m);
          const r = m.accuracyM ? m.accuracyM / geo.mpp : 0;
          if (m.kind === 'trail') return <circle key={i} cx={p.x} cy={p.y} r={3} fill={COLORS.trail} />;
          return (
            <g key={i} data-testid={`map-marker-${m.kind}`}>
              {r > 6 && <circle cx={p.x} cy={p.y} r={Math.min(r, W)} fill="rgba(201,164,92,0.12)" stroke="rgba(201,164,92,0.4)" />}
              <circle cx={p.x} cy={p.y} r={m.kind === 'driver' ? 9 : 7} fill={COLORS[m.kind]} stroke="#0b0d10" strokeWidth={2} className={m.kind === 'driver' ? 'map-pulse' : undefined} />
              <text x={p.x + 13} y={p.y + 4} fill="currentColor" fontSize="13">
                {m.label}
              </text>
            </g>
          );
        })}
        <g transform={`translate(16 ${H - 18})`}>
          <line x1={0} y1={0} x2={barPx} y2={0} stroke="currentColor" strokeWidth={2} />
          <text x={0} y={-6} fill="currentColor" fontSize="11">
            {bar >= 1000 ? `${bar / 1000} km` : `${bar} m`}
          </text>
        </g>
      </svg>
      <figcaption className="hint">{t('tracking.devMap')}</figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Google Maps JavaScript API (browser key, restricted to RideWELL domains)
// ---------------------------------------------------------------------------

type GoogleNS = { maps: { Map: new (el: HTMLElement, o: object) => GMap; Marker: new (o: object) => { setMap(m: GMap | null): void }; Circle: new (o: object) => { setMap(m: GMap | null): void }; LatLngBounds: new () => { extend(p: object): void } } };
type GMap = { fitBounds(b: object, pad?: number): void; setCenter(p: object): void; setZoom(z: number): void };

let loader: Promise<GoogleNS> | null = null;
function loadGoogle(key: string): Promise<GoogleNS> {
  const w = window as unknown as { google?: GoogleNS; __rwMapsReady?: () => void };
  if (w.google?.maps) return Promise.resolve(w.google);
  loader ??= new Promise((resolve, reject) => {
    w.__rwMapsReady = () => resolve(w.google!);
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&callback=__rwMapsReady`;
    s.async = true;
    s.onerror = () => reject(new Error('maps_load_failed'));
    document.head.appendChild(s);
  });
  return loader;
}

function GoogleMap({ apiKey, markers, height }: { apiKey: string; markers: MapMarker[]; height: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const map = useRef<GMap | null>(null);
  const drawn = useRef<Array<{ setMap(m: GMap | null): void }>>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    loadGoogle(apiKey)
      .then((g) => {
        if (!alive || !ref.current) return;
        map.current ??= new g.maps.Map(ref.current, { disableDefaultUI: true, zoomControl: true, gestureHandling: 'cooperative', colorScheme: 'DARK' });
        drawn.current.forEach((d) => d.setMap(null));
        drawn.current = [];
        const bounds = new g.maps.LatLngBounds();
        for (const m of markers) {
          const position = { lat: m.lat, lng: m.lng };
          bounds.extend(position);
          drawn.current.push(new g.maps.Marker({ position, map: map.current, title: m.label, label: m.kind === 'trail' ? undefined : m.label.slice(0, 1) }));
          if (m.accuracyM && m.kind === 'driver') drawn.current.push(new g.maps.Circle({ center: position, radius: m.accuracyM, map: map.current, strokeOpacity: 0.4, fillOpacity: 0.1 }));
        }
        if (markers.length > 1) map.current.fitBounds(bounds, 48);
        else {
          map.current.setCenter({ lat: markers[0]!.lat, lng: markers[0]!.lng });
          map.current.setZoom(15);
        }
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [apiKey, markers]);
  if (failed) return <PlotMap markers={markers} height={height} />;
  return <div ref={ref} style={{ width: '100%', height, borderRadius: 'var(--radius, 14px)' }} />;
}
