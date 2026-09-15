import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { usePageMeta } from '../../lib/usePageMeta';
import { PASSWORD_RE, PHONE_RE } from '../../lib/format';

export default function Profile() {
  usePageMeta('Profile', 'Manage your Chikbo profile.');
  const { user, refreshUser, dropSession } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [savingPassword, setSavingPassword] = useState(false);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (name.trim().length < 2) errors.name = 'Enter your full name.';
    if (phone.trim() && !PHONE_RE.test(phone.trim()))
      errors.phone = 'Enter a valid 10-digit Indian mobile number.';
    setProfileErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingProfile(true);
    try {
      await api('/users/me', {
        method: 'PATCH',
        body: { name: name.trim(), phone: phone.trim() || undefined },
      });
      await refreshUser().catch(() => undefined);
      toast.show('Profile updated.', 'success');
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : 'Could not update your profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!currentPassword) errors.current = 'Enter your current password.';
    if (!PASSWORD_RE.test(newPassword))
      errors.next = 'At least 8 characters, with a letter and a number.';
    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingPassword(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      // The API revokes all sessions — require a fresh sign-in.
      dropSession();
      toast.show('Password changed. Please sign in again.', 'success');
      navigate('/login');
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : 'Could not change your password.', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="account-stack">
      <section className="card account-card" aria-labelledby="profile-title">
        <header className="account-card-head">
          <h2 id="profile-title">Personal details</h2>
          <p className="muted">How we address you and where we reach you about your orders.</p>
        </header>
        <form onSubmit={saveProfile} noValidate>
          <div className="account-card-body">
            <div className="field">
              <label htmlFor="profile-email">Email</label>
              <input id="profile-email" className="input" value={user?.email ?? ''} disabled />
              <span className="field-hint">Your sign-in email. Contact us to change it.</span>
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="profile-name">Full name</label>
                <input
                  id="profile-name"
                  className="input"
                  autoComplete="name"
                  value={name}
                  aria-invalid={!!profileErrors.name}
                  onChange={(e) => setName(e.target.value)}
                />
                {profileErrors.name && <span className="field-error">{profileErrors.name}</span>}
              </div>
              <div className="field">
                <label htmlFor="profile-phone">Mobile number</label>
                <input
                  id="profile-phone"
                  className="input"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  autoComplete="tel-national"
                  value={phone ?? ''}
                  aria-invalid={!!profileErrors.phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                />
                {profileErrors.phone && <span className="field-error">{profileErrors.phone}</span>}
              </div>
            </div>
          </div>
          <footer className="account-card-foot">
            <button type="submit" className="btn btn-primary btn-sm" disabled={savingProfile}>
              {savingProfile ? 'Saving…' : 'Save changes'}
            </button>
          </footer>
        </form>
      </section>

      <section className="card account-card" aria-labelledby="password-title">
        <header className="account-card-head">
          <h2 id="password-title">Password</h2>
          <p className="muted">Changing your password signs you out of all devices.</p>
        </header>
        <form onSubmit={changePassword} noValidate>
          <div className="account-card-body">
            <div className="form-row">
              <div className="field">
                <label htmlFor="pw-current">Current password</label>
                <input
                  id="pw-current"
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  aria-invalid={!!passwordErrors.current}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                {passwordErrors.current && <span className="field-error">{passwordErrors.current}</span>}
              </div>
              <div className="field">
                <label htmlFor="pw-new">New password</label>
                <input
                  id="pw-new"
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  aria-invalid={!!passwordErrors.next}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                {passwordErrors.next ? (
                  <span className="field-error">{passwordErrors.next}</span>
                ) : (
                  <span className="field-hint">At least 8 characters, with a letter and a number.</span>
                )}
              </div>
            </div>
          </div>
          <footer className="account-card-foot">
            <button type="submit" className="btn btn-secondary btn-sm" disabled={savingPassword}>
              {savingPassword ? 'Updating…' : 'Update password'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
