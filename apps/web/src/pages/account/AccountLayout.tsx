import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import '../../styles/account.css';

const LINKS = [
  { to: 'profile', label: 'Profile' },
  { to: 'orders', label: 'Orders' },
  { to: 'returns', label: 'Returns' },
  { to: 'addresses', label: 'Addresses' },
  { to: 'wishlist', label: 'Wishlist' },
  { to: 'notifications', label: 'Notifications' },
];

export default function AccountLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const signOut = async () => {
    await logout();
    toast.show('Signed out. See you soon.', 'info');
    navigate('/');
  };

  return (
    <div className="container page account">
      <header className="account-head">
        <span className="overline">My account</span>
        <h1>Namaste, {user?.name?.split(' ')[0] ?? 'there'}</h1>
      </header>

      <div className="account-layout">
        <nav className="account-nav" aria-label="Account">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `account-nav-link${isActive ? ' account-nav-link--active' : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
          <button type="button" className="account-nav-link account-signout" onClick={signOut}>
            Sign out
          </button>
        </nav>

        <div className="account-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
