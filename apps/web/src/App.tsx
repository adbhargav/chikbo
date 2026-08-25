import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { AuthProvider } from './lib/auth';
import { ToastProvider } from './lib/toast';
import { CartUiProvider } from './lib/cart-ui';
import { SmoothScrollProvider } from './lib/lenis';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

const Home = lazy(() => import('./pages/Home'));
const Category = lazy(() => import('./pages/Category'));
const Search = lazy(() => import('./pages/Search'));
const Product = lazy(() => import('./pages/Product'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const OrderSuccess = lazy(() => import('./pages/OrderSuccess'));
const Policy = lazy(() => import('./pages/Policy'));
const NotFound = lazy(() => import('./pages/NotFound'));
const AccountLayout = lazy(() => import('./pages/account/AccountLayout'));
const Profile = lazy(() => import('./pages/account/Profile'));
const Addresses = lazy(() => import('./pages/account/Addresses'));
const Orders = lazy(() => import('./pages/account/Orders'));
const OrderDetail = lazy(() => import('./pages/account/OrderDetail'));
const Returns = lazy(() => import('./pages/account/Returns'));
const Wishlist = lazy(() => import('./pages/account/Wishlist'));
const Notifications = lazy(() => import('./pages/account/Notifications'));

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <SmoothScrollProvider>
        <ToastProvider>
          <AuthProvider>
            <CartUiProvider>
              <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="/c/:slug" element={<Category />} />
            <Route path="/search" element={<Search />} />
            <Route path="/p/:slug" element={<Product />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/policy/:slug" element={<Policy />} />
            <Route
              path="/checkout"
              element={
                <ProtectedRoute>
                  <Checkout />
                </ProtectedRoute>
              }
            />
            <Route
              path="/order-success/:orderId"
              element={
                <ProtectedRoute>
                  <OrderSuccess />
                </ProtectedRoute>
              }
            />
            <Route
              path="/account"
              element={
                <ProtectedRoute>
                  <AccountLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="profile" replace />} />
              <Route path="profile" element={<Profile />} />
              <Route path="addresses" element={<Addresses />} />
              <Route path="orders" element={<Orders />} />
              <Route path="orders/:id" element={<OrderDetail />} />
              <Route path="returns" element={<Returns />} />
              <Route path="wishlist" element={<Wishlist />} />
              <Route path="notifications" element={<Notifications />} />
            </Route>
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </CartUiProvider>
        </AuthProvider>
      </ToastProvider>
    </SmoothScrollProvider>
  </MotionConfig>
  );
}
