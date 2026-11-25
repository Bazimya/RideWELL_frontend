import { useEffect, useState } from 'react';
import { api } from '../../api/client';

export interface MapsConfig {
  provider: 'dev' | 'google';
  search: boolean;
  browserKey: string | null;
}

let cached: Promise<MapsConfig> | null = null;

/** Which map features are live. Fetched once per page load. */
export function useMapsConfig(): MapsConfig | null {
  const [cfg, setCfg] = useState<MapsConfig | null>(null);
  useEffect(() => {
    cached ??= api<MapsConfig>('/maps/config', { noRefresh: true }).catch(() => ({ provider: 'dev' as const, search: false, browserKey: null }));
    let alive = true;
    void cached.then((c) => alive && setCfg(c));
    return () => {
      alive = false;
    };
  }, []);
  return cfg;
}

/** Kigali International Airport (KGL), a fixed public place. */
export const KIGALI_AIRPORT = { lat: -1.96863, lng: 30.13945 };
