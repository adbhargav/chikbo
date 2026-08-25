import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useToast } from '../lib/toast';
import { usePageMeta } from '../lib/usePageMeta';
import { AuthLayout } from '../components/AuthLayout';

/** Mirrors the API rule: 8+ characters with at least one letter and one digit. */
const isStrongEnough = (value: string) =>
  value.length >= 8 && /[a-zA-Z]/.test(value) && /[0-9]/.test(value);

export default function ResetPassword() {
  usePageMeta('Set a new password', 'Choose a new password for your Chikbo account.');
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const toast = useToast();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!isStrongEnough(password)) {
      next.password = 'Use at least 8 characters, including a letter and a number.';
    }
    if (password !== confirm) next.confirm = 'Passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, newPassword: password } });
      // Resetting revokes every session, so the user signs in fresh.
      toast.show('Password updated. Please sign in.', 'success');
      navigate('/login', { replace: true });
    } catch (err) {
      setErrors({
        form: err instanceof ApiError ? err.message : 'Could not reset your password. Please try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout
        eyebrow="Account recovery"
        title="Link not valid"
        subtitle="This reset link is missing its token. Request a fresh one and try again."
      >
        <Link to="/forgot-password" className="btn btn-primary btn-block btn-lg">
          Request a new link
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Account recovery"
      title="Set a new password"
      subtitle="Choose something you haven't used before."
      footer={<Link to="/login">Back to sign in</Link>}
    >

        {errors.form && (
          <p className="alert alert-error" role="alert">
            {errors.form}
          </p>
        )}

        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="reset-password">New password</label>
            <input
              id="reset-password"
              className="input"
              type="password"
              autoComplete="new-password"
              autoFocus
              value={password}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'reset-password-error' : undefined}
              onChange={(e) => setPassword(e.target.value)}
            />
            {errors.password && (
              <span className="field-error" id="reset-password-error">
                {errors.password}
              </span>
            )}
          </div>
          <div className="field">
            <label htmlFor="reset-confirm">Confirm password</label>
            <input
              id="reset-confirm"
              className="input"
              type="password"
              autoComplete="new-password"
              value={confirm}
              aria-invalid={!!errors.confirm}
              aria-describedby={errors.confirm ? 'reset-confirm-error' : undefined}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {errors.confirm && (
              <span className="field-error" id="reset-confirm-error">
                {errors.confirm}
              </span>
            )}
          </div>
          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy ? 'Saving…' : 'Save new password'}
          </button>
      </form>
    </AuthLayout>
  );
}
