/**
 * Minimal typed API client for the Chikbo admin.
 * - Unwraps the `{ success, data | error }` envelope.
 * - Bearer auth from localStorage with single-flight refresh-on-401
 *   (rotating refresh-token pair per the API contract).
 */
import type { ApiResponse } from '@chikbo/shared';

const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/+$/, '');

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

const ACCESS_KEY = 'chikbo.admin.accessToken';
const REFRESH_KEY = 'chikbo.admin.refreshToken';

export const tokenStore = {
  get access(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  get hasSession(): boolean {
    return localStorage.getItem(REFRESH_KEY) !== null;
  },
  set(access: string, refresh: string): void {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

/** Fired when the session is irrecoverably gone; AuthProvider listens. */
export const UNAUTHORIZED_EVENT = 'chikbo:unauthorized';

let refreshInFlight: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const json = (await res.json().catch(() => null)) as ApiResponse<{
      accessToken: string;
      refreshToken: string;
    }> | null;
    if (!res.ok || !json || !json.success) return false;
    tokenStore.set(json.data.accessToken, json.data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export type Query = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
}

/** Call an API endpoint. `path` is relative to `/api/v1`, e.g. `/admin/orders`. */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let url = `${API_BASE}/api/v1${path}`;
  if (opts.query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const isForm = opts.body instanceof FormData;
  const send = () => {
    const headers: Record<string, string> = {};
    if (!isForm && opts.body !== undefined) headers['Content-Type'] = 'application/json';
    const access = tokenStore.access;
    if (access) headers.Authorization = `Bearer ${access}`;
    return fetch(url, {
      method: opts.method ?? 'GET',
      headers,
      body: isForm ? (opts.body as FormData) : opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  };

  let res = await send();
  if (res.status === 401 && !path.startsWith('/auth/')) {
    if (await refreshSession()) {
      res = await send();
    } else {
      tokenStore.clear();
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
      throw new ApiClientError('Your session has expired. Please sign in again.', 'UNAUTHORIZED', 401);
    }
  }

  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!json) {
    throw new ApiClientError(`Unexpected response from the server (${res.status})`, 'BAD_RESPONSE', res.status);
  }
  if (!json.success) {
    throw new ApiClientError(json.error.message, json.error.code, res.status, json.error.details);
  }
  return json.data;
}

/** Upload images; returns server-relative `/uploads/...` URLs. */
export async function uploadFiles(files: File[]): Promise<{ url: string; size: number }[]> {
  const fd = new FormData();
  for (const f of files) fd.append('files', f);
  return api<{ url: string; size: number }[]>('/uploads', { method: 'POST', body: fd });
}

/**
 * Import an image from a URL. The API downloads it and re-hosts it under
 * /uploads, so the catalogue does not depend on someone else's server staying
 * up (or allowing hot-linking).
 */
export async function importImageFromUrl(url: string): Promise<{ url: string; size: number }> {
  return api<{ url: string; size: number }>('/uploads/from-url', { method: 'POST', body: { url } });
}

/** Prefix server-relative asset URLs (`/uploads/...`) with the API origin. */
export function assetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** "variants › 1 › discountPriceInPaise: Number must be…" for each rejected field. */
function validationDetail(details: unknown): string {
  const d = details as {
    issues?: { path: (string | number)[]; message: string }[];
    fieldErrors?: Record<string, string[] | undefined>;
  } | null;
  if (d?.issues?.length) {
    return d.issues
      .slice(0, 3)
      .map((i) => `${i.path.map((seg) => (typeof seg === 'number' ? seg + 1 : seg)).join(' › ')}: ${i.message}`)
      .join('; ');
  }
  return Object.entries(d?.fieldErrors ?? {})
    .slice(0, 3)
    .map(([field, msgs]) => `${field}: ${(msgs ?? []).join(', ')}`)
    .join('; ');
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiClientError && err.code === 'VALIDATION_ERROR') {
    const detail = validationDetail(err.details);
    return detail ? `${err.message} — ${detail}` : err.message;
  }
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}
