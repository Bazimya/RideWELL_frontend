/**
 * API client. The access token lives in memory only (never localStorage); the
 * refresh token is an httpOnly cookie the browser sends to /api/v1/auth only.
 * Refreshes are single-flight: concurrent 401s share one refresh, because the
 * server treats a second use of a rotated refresh token as theft.
 */

export const API_BASE = '/api/v1';

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;
let onSessionEnded: (() => void) | null = null;

/** The in-memory access token, for the tracking WebSocket's first message. */
export const currentAccessToken = (): string | null => accessToken;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function onSessionEnd(cb: () => void): void {
  onSessionEnded = cb;
}

export interface RefreshResult {
  accessToken: string;
  user: SelfUser;
}

export interface SelfUser {
  id: string;
  phone: string | null;
  email: string | null;
  emailVerified: boolean;
  hasPassword: boolean;
  firstName: string | null;
  lastName: string | null;
  roles: Array<'customer' | 'driver_partner' | 'vehicle_partner' | 'staff' | 'super_admin'>;
  /** Effective admin permissions (all for super admins, ticked ones for staff, none otherwise). */
  permissions: string[];
  status: string;
  twoFactorEnabled: boolean;
}

let lastRefresh: RefreshResult | null = null;

/**
 * Several tabs share one refresh cookie. A Web Lock makes them refresh one at a
 * time, so each tab sends the newest cookie and none replays a rotated one
 * (which the server would treat as theft and end the session).
 */
function withCrossTabLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request('ridewell-refresh', fn) as Promise<T>;
  }
  return fn();
}

async function doRefresh(): Promise<boolean> {
  try {
    const res = await withCrossTabLock(() =>
      fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-RideWELL-Client': 'web' },
      }),
    );
    if (!res.ok) {
      accessToken = null;
      lastRefresh = null;
      return false;
    }
    lastRefresh = (await res.json()) as RefreshResult;
    accessToken = lastRefresh.accessToken;
    return true;
  } catch {
    return false;
  }
}

/** Try to restore or extend the session from the refresh cookie. */
export async function refreshSession(): Promise<RefreshResult | null> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return (await refreshInFlight) ? lastRefresh : null;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  /** Do not try a refresh on 401 (sign-in calls). */
  noRefresh?: boolean;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const send = () =>
    fetch(`${API_BASE}${path}`, {
      method: opts.method ?? 'GET',
      credentials: 'same-origin',
      headers: {
        'X-RideWELL-Client': 'web',
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...opts.headers,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

  let res: Response;
  try {
    res = await send();
    if (res.status === 401 && !opts.noRefresh && accessToken) {
      const body = (await res.clone().json().catch(() => null)) as { error?: ApiErrorBody } | null;
      // A step-up challenge is not an expired session.
      if (!body?.error?.code?.startsWith('step_up')) {
        if (await refreshSession()) res = await send();
        else onSessionEnded?.();
      }
    }
  } catch {
    throw new ApiError(0, 'network_error', 'network');
  }

  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as ({ error?: ApiErrorBody } & T) | null;
  if (!res.ok) {
    const e = data?.error;
    throw new ApiError(res.status, e?.code ?? 'error', e?.message ?? 'Request failed', e?.details);
  }
  return data as T;
}

/** Upload one file (multipart). The server checks the real file type and cleans it. */
export async function uploadFile<T>(path: string, kind: string, file: File): Promise<T> {
  const form = new FormData();
  form.append('kind', kind);
  form.append('file', file);
  const send = () =>
    fetch(`${API_BASE}${path}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-RideWELL-Client': 'web', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      body: form,
    });
  let res: Response;
  try {
    res = await send();
    if (res.status === 401 && accessToken && (await refreshSession())) res = await send();
  } catch {
    throw new ApiError(0, 'network_error', 'network');
  }
  const data = (await res.json().catch(() => null)) as ({ error?: ApiErrorBody } & T) | null;
  if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? 'error', data?.error?.message ?? 'Upload failed', data?.error?.details);
  return data as T;
}

/**
 * Open a private document: ask for a 5-minute link bound to this session, then
 * fetch it with the bearer token. Returns an object URL; revoke it when done.
 */
export async function fetchDocumentBlobUrl(documentId: string): Promise<{ url: string; type: string }> {
  const link = await api<{ url: string }>(`/documents/${documentId}/link`, { method: 'POST' });
  const res = await fetch(link.url, { credentials: 'same-origin', headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });
  if (!res.ok) throw new ApiError(res.status, 'document_unavailable', 'The document could not be opened.');
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), type: blob.type };
}

/**
 * DEVELOPMENT ONLY: the fixed verification code the API reports while no SMS
 * provider or authenticator is in use. Kept for this tab so code fields can be
 * pre-filled. The API never reports one in production.
 */
export function rememberDevCode(code: string | undefined): void {
  if (code) sessionStorage.setItem('rw_dev_code', code);
}
export function devCode(): string {
  return sessionStorage.getItem('rw_dev_code') ?? '';
}

/** Fetch an authenticated binary (e.g. the assigned driver's photo) as an object URL. Revoke it when done. */
export async function authorizedBlobUrl(path: string): Promise<string> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'same-origin', headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });
  if (!res.ok) throw new ApiError(res.status, 'unavailable', 'Not available.');
  return URL.createObjectURL(await res.blob());
}
