import type { ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { BagIcon, BellIcon, HeartIcon, MapPinIcon, ReturnIcon, UserIcon } from '../../components/icons';
import '../../styles/account.css';

const LINKS: { to: string; label: string; hint: string; icon: ReactNode }[] = [
  { to: 'profile', label: 'Profile', hint: 'Name, mobile, password', icon: <UserIcon size={18} /> },
  { to: 'orders', label: 'Orders', hint: 'Track and manage', icon: <BagIcon size={18} /> },
  { to: 'returns', label: 'Returns', hint: 'Requests and status', icon: <ReturnIcon size={18} /> },
  { to: 'addresses', label: 'Addresses', hint: 'Delivery details', icon: <MapPinIcon size={18} /> },
  { to: 'wishlist', label: 'Wishlist', hint: 'Saved for later', icon: <HeartIcon size={18} /> },
  { to: 'notifications', label: 'Notifications', hint: 'Updates and offers', icon: <BellIcon size={18} /> },
];

/** Two-letter monogram for the avatar: "Chikbo Admin" → "CA". */
function initials(name: string | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export default function AccountLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const signOut = async () => {
    await logout();
    toast.show('Signed out. See you soon.', 'info');
    navigate('/');
  };

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <div className="container page account">
      <header className="account-head card">
        <div className="account-identity">
          <span className="account-avatar" aria-hidden="true">
            {initials(user?.name)}
          </span>
          <div className="account-identity-text">
            <span className="overline">My account</span>
            <h1>Namaste, {firstName}</h1>
            <p className="account-meta">
              <span>{user?.email}</span>
              {user?.phone && (
                <>
                  <span className="account-meta-dot" aria-hidden="true">
                    ·
                  </span>
                  <span>+91 {user.phone}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <button type="button" className="btn btn-secondary btn-sm account-signout" onClick={signOut}>
          Sign out
        </button>
      </header>

      <div className="account-layout">
        <nav className="account-nav card" aria-label="Account">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `account-nav-link${isActive ? ' account-nav-link--active' : ''}`}
            >
              <span className="account-nav-icon">{link.icon}</span>
              <span className="account-nav-text">
                <span className="account-nav-label">{link.label}</span>
                <span className="account-nav-hint">{link.hint}</span>
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="account-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
