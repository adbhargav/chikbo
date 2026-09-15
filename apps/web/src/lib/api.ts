import type { ApiResponse } from '@chikbo/shared';

/**
 * API base. In dev the Vite proxy forwards /api -> http://localhost:4000, so a
 * relative base works out of the box. In production set VITE_API_URL, e.g.
 * https://api.chikbo.in/api/v1
 */
const RAW_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
export const API_BASE = RAW_BASE || '/api/v1';

/** Origin used to resolve server-relative asset URLs like `/uploads/...`. */
export const ASSET_ORIGIN = RAW_BASE ? RAW_BASE.replace(/\/api\/v1$/, '') : '';

const ACCESS_KEY = 'chikbo.accessToken';
const REFRESH_KEY = 'chikbo.refreshToken';

export const getAccessToken = (): string | null => localStorage.getItem(ACCESS_KEY);
export const getRefreshToken = (): string | null => localStorage.getItem(REFRESH_KEY);

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export const hasSession = (): boolean => getRefreshToken() !== null;

const GUEST_KEY = 'chikbo.guestToken';

/**
 * Identifies this browser's guest cart and any orders placed before signing
 * in. Created lazily, sent on every request as `X-Guest-Token`, and kept
 * after sign-in so the server can claim what the guest session did.
 */
export function getGuestToken(): string {
  try {
    const existing = localStorage.getItem(GUEST_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(GUEST_KEY, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}

/** Start a fresh guest identity — after the old one has been claimed by an account. */
export function rotateGuestToken(): void {
  try {
    localStorage.setItem(GUEST_KEY, crypto.randomUUID());
  } catch {
    /* storage unavailable — nothing to rotate */
  }
}

/** Fired when the refresh token is rejected — the app signs the user out. */
export const SESSION_EXPIRED_EVENT = 'chikbo:session-expired';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** JSON-serialisable body. */
  body?: unknown;
  /** Multipart body (takes precedence over `body`). */
  formData?: FormData;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const json = (await res.json()) as ApiResponse<{ accessToken: string; refreshToken: string }>;
    if (!res.ok || !json.success) return false;
    // The refresh token rotates — always store the new pair.
    setTokens(json.data.accessToken, json.data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  let url = `${API_BASE}${path}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      params.set(key, String(value));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }
  return url;
}

async function request<T>(path: string, opts: RequestOptions, allowRetry: boolean): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = { 'X-Guest-Token': getGuestToken() };
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (opts.formData) {
    body = opts.formData;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? 'GET',
      headers,
      body,
      signal: opts.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach Chikbo. Check your connection and try again.');
  }

  if (res.status === 401 && hasSession() && allowRetry && !path.startsWith('/auth/login')) {
    refreshInFlight ??= refreshSession().finally(() => {
      refreshInFlight = null;
    });
    const refreshed = await refreshInFlight;
    if (refreshed) return request<T>(path, opts, false);
    clearTokens();
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    throw new ApiError(401, 'SESSION_EXPIRED', 'Your session has expired. Please sign in again.');
  }

  if (res.status === 204) return undefined as T;

  let json: ApiResponse<T>;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(res.status, 'BAD_RESPONSE', 'The server sent an unexpected response.');
  }

  if (!json.success) {
    throw new ApiError(res.status, json.error.code, json.error.message, json.error.details);
  }
  return json.data;
}

export function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  return request<T>(path, opts, true);
}

/** Upload 1–6 images via POST /uploads. Returns server-relative URLs. */
export async function uploadImages(files: File[]): Promise<{ url: string; size: number }[]> {
  const formData = new FormData();
  for (const file of files) formData.append('files', file);
  return api<{ url: string; size: number }[]>('/uploads', { method: 'POST', formData });
}
