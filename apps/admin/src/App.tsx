import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { Permission } from '@chikbo/shared';
import { useAuth } from './lib/auth';
import { Layout, NAV_ENTRIES } from './components/Layout';
import { Login } from './pages/Login';
import { Forbidden, NotFound } from './pages/Errors';
import { Dashboard } from './pages/Dashboard';
import { Reports } from './pages/Reports';
import { Products } from './pages/Products';
import { ProductForm } from './pages/ProductForm';
import { Categories } from './pages/Categories';
import { Inventory } from './pages/Inventory';
import { Orders } from './pages/Orders';
import { OrderDetail } from './pages/OrderDetail';
import { Shipments } from './pages/Shipments';
import { Returns } from './pages/Returns';
import { Payments } from './pages/Payments';
import { Customers } from './pages/Customers';
import { CustomerDetail } from './pages/CustomerDetail';
import { Content } from './pages/Content';
import { ContentSection } from './pages/ContentSection';
import { Coupons } from './pages/Coupons';
import { Staff } from './pages/Staff';
import { Seo } from './pages/Seo';

function BootSplash() {
  return (
    <div className="login-screen">
      <div className="wordmark" style={{ color: 'var(--ink-900)', fontSize: 26 }}>
        CHIKB<span className="o">O</span>
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, booting } = useAuth();
  const location = useLocation();
  if (booting) return <BootSplash />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

/** Route-level RBAC gate: friendly 403 when navigated directly without access. */
function Perm({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) return <Forbidden />;
  return <>{children}</>;
}

/** "/" lands on the dashboard, or the first page this staff member may see. */
function Home() {
  const { hasPermission } = useAuth();
  if (hasPermission('dashboard.view')) return <Dashboard />;
  const first = NAV_ENTRIES.find((e) => hasPermission(e.permission));
  if (first) return <Navigate to={first.to} replace />;
  return <Forbidden />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/reports" element={<Perm permission="reports.read"><Reports /></Perm>} />
        <Route path="/products" element={<Perm permission="products.read"><Products /></Perm>} />
        <Route path="/products/new" element={<Perm permission="products.write"><ProductForm /></Perm>} />
        <Route path="/products/:id" element={<Perm permission="products.read"><ProductForm /></Perm>} />
        <Route path="/categories" element={<Perm permission="categories.write"><Categories /></Perm>} />
        <Route path="/inventory" element={<Perm permission="inventory.read"><Inventory /></Perm>} />
        <Route path="/orders" element={<Perm permission="orders.read"><Orders /></Perm>} />
        <Route path="/orders/:id" element={<Perm permission="orders.read"><OrderDetail /></Perm>} />
        <Route path="/shipments" element={<Perm permission="shipments.read"><Shipments /></Perm>} />
        <Route path="/returns" element={<Perm permission="returns.read"><Returns /></Perm>} />
        <Route path="/payments" element={<Perm permission="payments.read"><Payments /></Perm>} />
        <Route path="/content" element={<Perm permission="content.read"><Content /></Perm>} />
        <Route path="/content/:id" element={<Perm permission="content.read"><ContentSection /></Perm>} />
        <Route path="/customers" element={<Perm permission="customers.read"><Customers /></Perm>} />
        <Route path="/customers/:id" element={<Perm permission="customers.read"><CustomerDetail /></Perm>} />
        <Route path="/coupons" element={<Perm permission="coupons.read"><Coupons /></Perm>} />
        <Route path="/staff" element={<Perm permission="staff.read"><Staff /></Perm>} />
        <Route path="/settings/seo" element={<Perm permission="dashboard.view"><Seo /></Perm>} />
        <Route path="/settings/seo/:tab" element={<Perm permission="dashboard.view"><Seo /></Perm>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
