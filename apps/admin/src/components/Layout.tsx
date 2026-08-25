import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import type { Permission } from '@chikbo/shared';
import { useAuth } from '../lib/auth';
import { humanize } from '../lib/format';
import { Icon } from './Icon';

export interface NavEntry {
  to: string;
  label: string;
  icon: string;
  permission: Permission;
  section?: string;
}

export const NAV_ENTRIES: NavEntry[] = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', permission: 'dashboard.view' },
  { to: '/reports', label: 'Reports', icon: 'chart', permission: 'reports.read' },
  { to: '/products', label: 'Products', icon: 'box', permission: 'products.read', section: 'Catalog' },
  { to: '/categories', label: 'Categories', icon: 'layers', permission: 'categories.write' },
  { to: '/inventory', label: 'Inventory', icon: 'clipboard', permission: 'inventory.read' },
  { to: '/orders', label: 'Orders', icon: 'bag', permission: 'orders.read', section: 'Fulfilment' },
  { to: '/shipments', label: 'Shipments', icon: 'truck', permission: 'shipments.read' },
  { to: '/returns', label: 'Returns', icon: 'undo', permission: 'returns.read' },
  { to: '/payments', label: 'Payments', icon: 'card', permission: 'payments.read' },
  { to: '/content', label: 'Homepage', icon: 'layout', permission: 'content.read', section: 'Content' },
  { to: '/customers', label: 'Customers', icon: 'users', permission: 'customers.read', section: 'People' },
  { to: '/coupons', label: 'Coupons', icon: 'ticket', permission: 'coupons.read' },
  { to: '/staff', label: 'Staff & Roles', icon: 'shield', permission: 'staff.read' },
  { to: '/settings/seo', label: 'SEO', icon: 'globe', permission: 'dashboard.view', section: 'Settings' },
];

export function Layout() {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();

  const visible = NAV_ENTRIES.filter((e) => hasPermission(e.permission));
  const roleLabel = user?.role === 'SUPER_ADMIN' ? 'Super Admin' : humanize(user?.role ?? 'STAFF');
  const initials = (user?.name ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  const onLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/brand/chikbo-logo.png" alt="Chikbo" className="sidebar-logo" style={{ height: 38, width: 'auto', objectFit: 'contain' }} />
          <div className="sidebar-tagline">Admin · Since 1992</div>
        </div>
        <nav aria-label="Main navigation">
          {visible.map((entry) => (
            <span key={entry.to} style={{ display: 'contents' }}>
              {entry.section && <div className="nav-section">{entry.section}</div>}
              <NavLink
                to={entry.to}
                end={entry.to === '/'}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <Icon name={entry.icon} />
                {entry.label}
              </NavLink>
            </span>
          ))}
        </nav>
        <div className="sidebar-foot">Woven with trust since 1992</div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">Chikbo Studio</div>
          <div className="topbar-user">
            <div className="who">
              <div className="name">{user?.name}</div>
              <span className="role-chip">{roleLabel}</span>
            </div>
            <div className="avatar" aria-hidden="true">
              {initials}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={onLogout}>
              Sign out
            </button>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
