import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'chikbo.accessToken';
const REFRESH_KEY = 'chikbo.refreshToken';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// In-memory mirror so the axios request interceptor doesn't hit SecureStore on
// every request. SecureStore remains the durable source across app launches.
let cached: TokenPair | null = null;
let loaded = false;

export async function loadTokens(): Promise<TokenPair | null> {
  if (loaded) return cached;
  try {
    const [accessToken, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_KEY),
      SecureStore.getItemAsync(REFRESH_KEY),
    ]);
    cached = accessToken && refreshToken ? { accessToken, refreshToken } : null;
  } catch {
    cached = null;
  }
  loaded = true;
  return cached;
}

export function getTokens(): TokenPair | null {
  return cached;
}

export async function saveTokens(pair: TokenPair): Promise<void> {
  cached = pair;
  loaded = true;
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, pair.accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, pair.refreshToken),
  ]);
}

export async function clearTokens(): Promise<void> {
  cached = null;
  loaded = true;
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
  ]);
}
