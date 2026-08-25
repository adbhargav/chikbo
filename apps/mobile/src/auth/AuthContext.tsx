import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { authApi } from '../api/endpoints';
import { setOnSessionExpired } from '../api/client';
import type { AuthUser } from '../api/types';
import { clearTokens, getTokens, loadTokens, saveTokens } from './tokenStore';
import { registerPushToken } from '../notifications/push';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; name: string; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUserState] = useState<AuthUser | null>(null);
  const queryClient = useQueryClient();
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Boot: restore tokens from SecureStore, then validate the session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tokens = await loadTokens();
      if (!tokens) {
        if (!cancelled) setStatus('signedOut');
        return;
      }
      try {
        // The axios interceptor transparently refreshes if the access token expired.
        const me = await authApi.me();
        if (cancelled) return;
        setUserState(me);
        setStatus('signedIn');
        void registerPushToken();
      } catch {
        if (cancelled) return;
        await clearTokens();
        setUserState(null);
        setStatus('signedOut');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signOutLocal = useCallback(() => {
    setUserState(null);
    setStatus('signedOut');
    queryClient.clear();
  }, [queryClient]);

  // When the interceptor fails to refresh, drop straight to the login screen.
  useEffect(() => {
    setOnSessionExpired(() => {
      if (mounted.current) signOutLocal();
    });
    return () => setOnSessionExpired(null);
  }, [signOutLocal]);

  const login = useCallback(async (email: string, password: string) => {
    const session = await authApi.login({ email, password });
    await saveTokens({ accessToken: session.accessToken, refreshToken: session.refreshToken });
    setUserState(session.user);
    setStatus('signedIn');
    void registerPushToken();
  }, []);

  const register = useCallback(
    async (input: { email: string; password: string; name: string; phone?: string }) => {
      const session = await authApi.register(input);
      await saveTokens({ accessToken: session.accessToken, refreshToken: session.refreshToken });
      setUserState(session.user);
      setStatus('signedIn');
      void registerPushToken();
    },
    [],
  );

  const logout = useCallback(async () => {
    const tokens = getTokens();
    if (tokens) {
      try {
        await authApi.logout(tokens.refreshToken);
      } catch {
        // Best effort — revoke locally regardless.
      }
    }
    await clearTokens();
    signOutLocal();
  }, [signOutLocal]);

  const setUser = useCallback((next: AuthUser) => setUserState(next), []);

  const value = useMemo(
    () => ({ status, user, login, register, logout, setUser }),
    [status, user, login, register, logout, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
