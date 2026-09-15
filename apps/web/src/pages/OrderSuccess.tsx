import { Link, useLocation, useParams } from 'react-router-dom';
import { formatPaise } from '@chikbo/shared';
import { useAuth } from '../lib/auth';
import { useOrderAfterCheckout } from '../lib/queries';
import { usePageMeta } from '../lib/usePageMeta';
import { StatusPill } from '../components/ui';
import { CheckIcon } from '../components/icons';
import '../styles/checkout.css';

export default function OrderSuccess() {
  usePageMeta('Order placed', 'Your Chikbo order has been placed.');
  const { orderId } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const fallbackNumber = (location.state as { orderNumber?: string } | null)?.orderNumber;
  const { data: order, isPending } = useOrderAfterCheckout(orderId);

  const orderNumber = order?.orderNumber ?? fallbackNumber;
  // Where sign-in / sign-up should return to, so the just-claimed order is right there.
  const here = location.pathname;

  return (
    <div className="container page">
      <div className="success-card">
        <span className="success-badge" aria-hidden="true">
          <CheckIcon size={28} />
        </span>
        <span className="overline">Thank you</span>
        <h1>Order placed</h1>
        {isPending && !orderNumber ? (
          <div className="skeleton" style={{ height: 20, width: 200, margin: '12px auto' }} />
        ) : (
          <p className="success-number">
            Order <strong>{orderNumber ?? '—'}</strong>
            {order && (
              <>
                {' '}
                · {formatPaise(order.totalInPaise)} · <StatusPill status={order.status} />
              </>
            )}
          </p>
        )}

        {user ? (
          <>
            <p className="muted">
              We are getting your order ready. Track every step from your account — we will keep you
              posted.
            </p>
            <div className="success-actions">
              <Link to={`/account/orders/${orderId}`} className="btn btn-primary">
                View order
              </Link>
              <Link to="/" className="btn btn-secondary">
                Continue shopping
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="muted">
              We are getting your order ready. A confirmation is on its way to your email.
            </p>

            <section className="success-account" aria-labelledby="success-account-title">
              <h2 id="success-account-title">Keep track of this order</h2>
              <p className="muted">
                Create a free account, or sign in if you already have one, and this order is added to it
                automatically — live tracking, order details, easy returns.
              </p>
              <div className="success-actions">
                <Link to="/register" state={{ from: here }} className="btn btn-primary">
                  Create account
                </Link>
                <Link to="/login" state={{ from: here }} className="btn btn-secondary">
                  Sign in
                </Link>
              </div>
            </section>

            <Link to="/" className="btn btn-ghost success-continue">
              Continue shopping
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
