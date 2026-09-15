import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { OrderClaimResponse } from '@chikbo/shared';
import {
  api,
  clearTokens,
  getGuestToken,
  getRefreshToken,
  hasSession,
  rotateGuestToken,
  setTokens,
  SESSION_EXPIRED_EVENT,
} from './api';
import { useToast } from './toast';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  role: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** True while the stored session is being restored on first load. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Exchange a Google ID token for a Chikbo session. */
  loginWithGoogle: (idToken: string) => Promise<void>;
  /** Exchange a Firebase ID token (Google sign-in via Firebase Auth) for a Chikbo session. */
  loginWithFirebase: (idToken: string) => Promise<void>;
  register: (input: { email: string; password: string; name: string; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-fetch /auth/me (after a profile edit). */
  refreshUser: () => Promise<void>;
  /** Clear local session without calling the API (e.g. after change-password revokes sessions). */
  dropSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthPayload {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

/**
 * Hand the guest session over to the account that just signed in: orders
 * placed as a guest become the account's orders and the guest cart folds into
 * the account cart. Best effort — a failure here must never block sign-in.
 */
async function claimGuestSession(): Promise<OrderClaimResponse | null> {
  const guestToken = getGuestToken();
  try {
    const result = await api<OrderClaimResponse>('/orders/claim', { method: 'POST', body: { guestToken } });
    // The token is spent once claimed; a fresh one keeps the next guest session separate.
    rotateGuestToken();
    return result;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(() => hasSession());
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    if (hasSession()) {
      api<AuthUser>('/auth/me')
        .then((me) => {
          if (!cancelled) setUser(me);
        })
        .catch(() => {
          /* session-expired event handles cleanup */
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      queryClient.clear();
      toast.show('Your session has expired. Please sign in again.', 'info');
      navigate('/login');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [navigate, queryClient, toast]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await api<AuthPayload>('/auth/login', { method: 'POST', body: { email, password } });
      setTokens(data.accessToken, data.refreshToken);
      await claimGuestSession();
      setUser(data.user);
      queryClient.clear();
    },
    [queryClient],
  );

  const loginWithGoogle = useCallback(
    async (idToken: string) => {
      const data = await api<AuthPayload>('/auth/google', { method: 'POST', body: { idToken } });
      setTokens(data.accessToken, data.refreshToken);
      await claimGuestSession();
      setUser(data.user);
      queryClient.clear();
    },
    [queryClient],
  );

  const loginWithFirebase = useCallback(
    async (idToken: string) => {
      const data = await api<AuthPayload>('/auth/firebase', { method: 'POST', body: { idToken } });
      setTokens(data.accessToken, data.refreshToken);
      await claimGuestSession();
      setUser(data.user);
      queryClient.clear();
    },
    [queryClient],
  );

  const register = useCallback(
    async (input: { email: string; password: string; name: string; phone?: string }) => {
      const data = await api<AuthPayload>('/auth/register', { method: 'POST', body: input });
      setTokens(data.accessToken, data.refreshToken);
      await claimGuestSession();
      setUser(data.user);
      queryClient.clear();
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await api('/auth/logout', { method: 'POST', body: { refreshToken } });
      } catch {
        /* best effort */
      }
    }
    clearTokens();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const refreshUser = useCallback(async () => {
    const me = await api<AuthUser>('/auth/me');
    setUser(me);
  }, []);

  const dropSession = useCallback(() => {
    clearTokens();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo(
    () => ({ user, loading, login, loginWithGoogle, loginWithFirebase, register, logout, refreshUser, dropSession }),
    [user, loading, login, loginWithGoogle, loginWithFirebase, register, logout, refreshUser, dropSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
