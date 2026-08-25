import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { errorMessage } from '../lib/api';
import { usePageTitle } from '../components/ui';

export function Login() {
  const { user, booting, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  usePageTitle('Sign in');

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  if (!booting && user) return <Navigate to={from} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <img src="/brand/chikbo-logo.png" alt="Chikbo" className="login-mark" style={{ height: 60, width: 'auto', objectFit: 'contain' }} />
          <div className="heritage">Staff Console · Since 1992</div>
        </div>
        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@chikbo.in"
            />
          </div>
          <div className="field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', marginTop: 6 }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="muted" style={{ fontSize: 12, marginTop: 18, textAlign: 'center' }}>
          Staff accounts only. Woven with trust since 1992.
        </p>
      </div>
    </div>
  );
}
