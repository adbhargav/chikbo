import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { ApiError } from '../lib/api';
import { EMAIL_RE, PASSWORD_RE, PHONE_RE } from '../lib/format';
import { usePageMeta } from '../lib/usePageMeta';
import { AuthLayout } from '../components/AuthLayout';
import { GoogleSignIn } from '../components/GoogleSignIn';

export default function Register() {
  usePageMeta('Create account', 'Join Chikbo — trust, quality and budget friendly fashion since 1992.');
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = 'Enter your full name.';
    if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address.';
    if (phone.trim() && !PHONE_RE.test(phone.trim()))
      next.phone = 'Enter a valid 10-digit Indian mobile number.';
    if (!PASSWORD_RE.test(password))
      next.password = 'At least 8 characters, with a letter and a number.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
      });
      toast.show('Welcome to Chikbo — account created.', 'success');
      navigate('/', { replace: true });
    } catch (err) {
      setErrors({
        form: err instanceof ApiError ? err.message : 'Could not create your account.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Since 1992"
      title="Create account"
      subtitle="Trust, quality and budget friendly — welcome in."
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link>
        </>
      }
      aside={{
        quote:
          'Handpicked sarees, dresses and antique jewellery — quality checked by hand before they travel to your door.',
        attribution: 'Rikab Gunj, Hyderabad',
      }}
    >

        {errors.form && (
          <p className="alert alert-error" role="alert">
            {errors.form}
          </p>
        )}

        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="reg-name">Full name</label>
            <input
              id="reg-name"
              className="input"
              autoComplete="name"
              value={name}
              aria-invalid={!!errors.name}
              onChange={(e) => setName(e.target.value)}
            />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>
          <div className="field">
            <label htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              aria-invalid={!!errors.email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>
          <div className="field">
            <label htmlFor="reg-phone">Mobile number (optional)</label>
            <input
              id="reg-phone"
              className="input"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              autoComplete="tel-national"
              value={phone}
              aria-invalid={!!errors.phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            />
            {errors.phone && <span className="field-error">{errors.phone}</span>}
          </div>
          <div className="field">
            <label htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
              className="input"
              type="password"
              autoComplete="new-password"
              value={password}
              aria-invalid={!!errors.password}
              aria-describedby="reg-password-hint"
              onChange={(e) => setPassword(e.target.value)}
            />
            <span className="muted" id="reg-password-hint" style={{ fontSize: 12.5 }}>
              At least 8 characters, with a letter and a number.
            </span>
            {errors.password && <span className="field-error">{errors.password}</span>}
          </div>
          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>

      <GoogleSignIn mode="signup" />
    </AuthLayout>
  );
}
