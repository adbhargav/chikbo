import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

import { API_BASE_URL } from '../config';
import { clearTokens, getTokens, saveTokens } from '../auth/tokenStore';
import type { ApiErr, ApiOk, TokenPairResponse } from './types';

/** Normalized API error — every failed call surfaces one of these. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number | undefined;
  readonly details: unknown;

  constructor(code: string, message: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as ApiErr | undefined;
    if (body && body.success === false && body.error) {
      return new ApiError(
        body.error.code,
        body.error.message,
        err.response?.status,
        body.error.details,
      );
    }
    if (err.response) {
      return new ApiError('HTTP_ERROR', `Request failed (${err.response.status})`, err.response.status);
    }
    return new ApiError('NETWORK_ERROR', 'Could not reach Chikbo. Check your connection.');
  }
  return new ApiError('UNKNOWN', err instanceof Error ? err.message : 'Something went wrong');
}

/** Called when the session can no longer be refreshed — the AuthProvider signs out. */
let onSessionExpired: (() => void) | null = null;
export function setOnSessionExpired(cb: (() => void) | null): void {
  onSessionExpired = cb;
}

export const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const tokens = getTokens();
  if (tokens && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`;
  }
  return config;
});

// --- Rotating-refresh single-flight -----------------------------------------
// On 401 we refresh once (concurrent 401s share the same promise), persist the
// NEW pair (the server rotates refresh tokens), and replay the original request.

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const tokens = getTokens();
  if (!tokens) return null;
  try {
    // Plain axios: must not recurse through our interceptors.
    const res = await axios.post<ApiOk<TokenPairResponse>>(
      `${API_BASE_URL}/auth/refresh`,
      { refreshToken: tokens.refreshToken },
      { timeout: 15_000 },
    );
    const pair = res.data.data;
    await saveTokens({ accessToken: pair.accessToken, refreshToken: pair.refreshToken });
    return pair.accessToken;
  } catch {
    await clearTokens();
    onSessionExpired?.();
    return null;
  }
}

const NO_REFRESH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const url = config?.url ?? '';
    const isAuthEndpoint = NO_REFRESH_PATHS.some((p) => url.includes(p));

    if (error.response?.status === 401 && config && !config._retried && !isAuthEndpoint) {
      config._retried = true;
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const newAccess = await refreshPromise;
      if (newAccess) {
        config.headers.Authorization = `Bearer ${newAccess}`;
        return client(config);
      }
    }
    return Promise.reject(toApiError(error));
  },
);

// --- Envelope-unwrapping helpers --------------------------------------------

export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res = await client.get<ApiOk<T>>(url, { params });
  return res.data.data;
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const res = await client.post<ApiOk<T>>(url, body);
  return res.data.data;
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  const res = await client.patch<ApiOk<T>>(url, body);
  return res.data.data;
}

export async function apiDelete<T>(url: string): Promise<T> {
  const res = await client.delete<ApiOk<T>>(url);
  return res.data.data;
}
