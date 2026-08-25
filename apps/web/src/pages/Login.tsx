import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { ApiError } from '../lib/api';
import { EMAIL_RE } from '../lib/format';
import { usePageMeta } from '../lib/usePageMeta';
import { AuthLayout } from '../components/AuthLayout';
import { GoogleSignIn } from '../components/GoogleSignIn';

export default function Login() {
  usePageMeta('Sign in', 'Sign in to your Chikbo account.');
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await login(email.trim(), password);
      toast.show('Welcome back to Chikbo.', 'success');
      navigate(from, { replace: true });
    } catch (err) {
      setErrors({ form: err instanceof ApiError ? err.message : 'Could not sign in. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Sign in"
      subtitle="Your wardrobe has been waiting."
      footer={
        <>
          New to Chikbo? <Link to="/register">Create an account</Link>
        </>
      }
    >
      {errors.form && (
        <p className="alert alert-error" role="alert">
          {errors.form}
        </p>
      )}

      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            className="input"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'login-email-error' : undefined}
            onChange={(e) => setEmail(e.target.value)}
          />
          {errors.email && (
            <span className="field-error" id="login-email-error">
              {errors.email}
            </span>
          )}
        </div>

        <div className="field">
          <div className="field-row">
            <label htmlFor="login-password">Password</label>
            <Link to="/forgot-password" className="field-hint-link">
              Forgot password?
            </Link>
          </div>
          <input
            id="login-password"
            className="input"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'login-password-error' : undefined}
            onChange={(e) => setPassword(e.target.value)}
          />
          {errors.password && (
            <span className="field-error" id="login-password-error">
              {errors.password}
            </span>
          )}
        </div>

        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <GoogleSignIn mode="signin" />
    </AuthLayout>
  );
}
