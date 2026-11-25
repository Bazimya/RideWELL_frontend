import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { useMapsConfig } from './useMapsConfig';

export interface PlaceCoords {
  lat: number;
  lng: number;
  accuracyM: number | null;
  source: 'search' | 'gps';
}

interface Suggestion {
  placeId: string;
  primary: string;
  secondary: string | null;
}

/**
 * Address field with place search (when the Google key is configured) and "use my
 * current location" (browser permission, asked only when the button is pressed).
 * If search is unavailable or permission is refused, the typed address is used.
 */
export function PlaceField({
  label,
  hint,
  address,
  coords,
  onChange,
  allowCurrentLocation = true,
  className = '',
}: {
  label: string;
  hint?: string;
  address: string;
  coords: PlaceCoords | null;
  onChange: (address: string, coords: PlaceCoords | null) => void;
  allowCurrentLocation?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const cfg = useMapsConfig();
  const id = useId();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [gpsState, setGpsState] = useState<'idle' | 'asking' | 'denied' | 'unavailable'>('idle');
  const session = useRef<string>(crypto.randomUUID());
  const typed = useRef(false);

  useEffect(() => {
    if (!cfg?.search || !typed.current || address.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const q = address.trim();
    const timer = setTimeout(() => {
      api<{ suggestions: Suggestion[] }>(`/maps/autocomplete?q=${encodeURIComponent(q)}&session=${session.current}`, { noRefresh: true })
        .then((r) => {
          setSuggestions(r.suggestions);
          setOpen(true);
        })
        .catch(() => setSuggestions([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [address, cfg?.search]);

  const choose = async (s: Suggestion) => {
    setOpen(false);
    typed.current = false;
    try {
      const { place } = await api<{ place: { address: string; lat: number; lng: number } }>(`/maps/place/${encodeURIComponent(s.placeId)}?session=${session.current}`, { noRefresh: true });
      onChange(place.address, { lat: place.lat, lng: place.lng, accuracyM: null, source: 'search' });
    } catch {
      onChange([s.primary, s.secondary].filter(Boolean).join(', '), null);
    }
    session.current = crypto.randomUUID(); // one billing session per chosen place
  };

  const useCurrent = () => {
    if (!('geolocation' in navigator)) return setGpsState('unavailable');
    setGpsState('asking');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setGpsState('idle');
        const c: PlaceCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: Math.round(pos.coords.accuracy), source: 'gps' };
        let addr = address;
        if (!addr.trim()) {
          const r = await api<{ address: string | null }>(`/maps/reverse?lat=${c.lat}&lng=${c.lng}`, { noRefresh: true }).catch(() => ({ address: null }));
          addr = r.address ?? '';
        }
        onChange(addr, c);
      },
      (err) => setGpsState(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  };

  return (
    <div className={`field place-field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={address}
        autoComplete="street-address"
        role={cfg?.search ? 'combobox' : undefined}
        aria-expanded={cfg?.search ? open && suggestions.length > 0 : undefined}
        aria-controls={cfg?.search ? `${id}-list` : undefined}
        onChange={(e) => {
          typed.current = true;
          // A typed change no longer matches a searched place; a GPS position stays (the text then describes it).
          onChange(e.target.value, coords?.source === 'gps' ? coords : null);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && suggestions.length > 0 && (
        <ul id={`${id}-list`} role="listbox" className="place-suggestions">
          {suggestions.map((s) => (
            <li key={s.placeId} role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()} onClick={() => void choose(s)}>
              <strong>{s.primary}</strong>
              {s.secondary && <span className="muted small"> {s.secondary}</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="row place-meta">
        {coords ? (
          <span className="chip s-assigned small" data-testid="place-coords">
            {coords.source === 'gps' ? t('maps.gpsAttached', { accuracy: coords.accuracyM ?? '?' }) : t('maps.placeAttached')}
            <button type="button" className="link small" onClick={() => onChange(address, null)} aria-label={t('maps.removeLocation')}>
              ×
            </button>
          </span>
        ) : (
          allowCurrentLocation && (
            <button type="button" className="link small" onClick={useCurrent} disabled={gpsState === 'asking'}>
              {gpsState === 'asking' ? t('maps.locating') : t('maps.useCurrent')}
            </button>
          )
        )}
        {gpsState === 'denied' && <span className="hint">{t('maps.gpsDenied')}</span>}
        {gpsState === 'unavailable' && <span className="hint">{t('maps.gpsUnavailable')}</span>}
      </div>
      {hint && <span className="hint">{hint}</span>}
      {cfg && !cfg.search && !hint && <span className="hint">{t('maps.searchOff')}</span>}
    </div>
  );
}
