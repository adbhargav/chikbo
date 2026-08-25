import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { EMAIL_RE } from '../lib/format';
import { usePageMeta } from '../lib/usePageMeta';
import { AuthLayout } from '../components/AuthLayout';

export default function ForgotPassword() {
  usePageMeta('Forgot password', 'Reset your Chikbo account password.');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email: email.trim() } });
      // The API answers identically for unknown addresses, so the confirmation
      // is deliberately non-committal — it must not reveal who has an account.
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the reset link. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Account recovery"
      title={sent ? 'Check your inbox' : 'Forgot password'}
      aside={{
        quote: 'Locked out happens. A single link and you are back to your wardrobe.',
        attribution: 'Chikbo customer care',
      }}
      footer={
        sent ? undefined : (
          <>
            Remembered it? <Link to="/login">Back to sign in</Link>
          </>
        )
      }
    >
      <div className="auth-body">
        {sent ? (
          <>
            <p className="muted auth-sub">
              If an account exists for <strong>{email.trim()}</strong>, we've sent a link to choose a
              new password. It expires in an hour and can be used once.
            </p>
            <p className="muted auth-sub">
              Nothing arrived? Check your spam folder, or{' '}
              <button type="button" className="link-button" onClick={() => setSent(false)}>
                try another address
              </button>
              .
            </p>
            <Link to="/login" className="btn btn-secondary btn-block">
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <p className="muted auth-sub">
              Enter the email on your account and we'll send you a link to set a new password.
            </p>

            {error && (
              <p className="alert alert-error" role="alert">
                {error}
              </p>
            )}

            <form onSubmit={submit} noValidate>
              <div className="field">
                <label htmlFor="forgot-email">Email</label>
                <input
                  id="forgot-email"
                  className="input"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  aria-invalid={!!error}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
                {busy ? 'Sending…' : 'Send reset link'}
              </button>
            </form>

          </>
        )}
      </div>
    </AuthLayout>
  );
}
