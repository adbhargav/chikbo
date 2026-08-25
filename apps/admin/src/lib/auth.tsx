import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Permission, UserRole } from '@chikbo/shared';
import { api, tokenStore, UNAUTHORIZED_EVENT } from './api';

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: Permission[];
}

interface AuthContextValue {
  user: StaffUser | null;
  /** True while restoring the session on first load. */
  booting: boolean;
  login: (email: string, password: string) => Promise<StaffUser>;
  logout: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface LoginResponse {
  user: { id: string; email: string; name: string; role: UserRole };
  accessToken: string;
  refreshToken: string;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [booting, setBooting] = useState(() => tokenStore.hasSession);

  // Restore session
  useEffect(() => {
    if (!tokenStore.hasSession) return;
    let cancelled = false;
    api<StaffUser>('/auth/me')
      .then((me) => {
        if (cancelled) return;
        if (me.role === 'CUSTOMER') {
          tokenStore.clear();
          setUser(null);
        } else {
          setUser(me);
        }
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setBooting(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Hard logout when a refresh fails mid-session
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<LoginResponse>('/auth/login', { method: 'POST', body: { email, password } });
    if (res.user.role === 'CUSTOMER') {
      throw new Error('Not a staff account');
    }
    tokenStore.set(res.accessToken, res.refreshToken);
    const me = await api<StaffUser>('/auth/me');
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.refresh;
    if (refreshToken) {
      await api('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => undefined);
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  const hasPermission = useCallback(
    (permission: Permission) => {
      if (!user) return false;
      if (user.role === 'SUPER_ADMIN') return true;
      return user.permissions.includes(permission);
    },
    [user],
  );

  const value = useMemo(
    () => ({ user, booting, login, logout, hasPermission }),
    [user, booting, login, logout, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Renders children only when the signed-in staff holds the permission. */
export function PermissionGate({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { hasPermission } = useAuth();
  return <>{hasPermission(permission) ? children : fallback}</>;
}
