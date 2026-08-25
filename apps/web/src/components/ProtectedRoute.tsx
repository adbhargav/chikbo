import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth';

/** Gate for authenticated routes: waits for session restore, then redirects to /login. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="container page">
        <div className="skeleton" style={{ height: 32, width: 260, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }
  return <>{children}</>;
}
