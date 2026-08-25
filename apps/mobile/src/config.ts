import Constants from 'expo-constants';

/**
 * API base URL resolution order:
 *  1. EXPO_PUBLIC_API_URL env var (set in .env or the shell before `expo start`)
 *  2. expo.extra.apiUrl in app.json
 *  3. localhost fallback (iOS simulator only — physical devices need your LAN IP)
 */
const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };

export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? extra.apiUrl ?? 'http://localhost:4000/api/v1';

/** Origin (scheme://host:port) of the API — used to absolutize server-relative upload/image URLs. */
export const API_ORIGIN: string = API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');

/** Turn a server-relative URL (`/uploads/...`, `/images/...`) into an absolute one. */
export function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}
