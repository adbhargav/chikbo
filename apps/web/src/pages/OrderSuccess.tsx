import { Link, useLocation, useParams } from 'react-router-dom';
import { formatPaise } from '@chikbo/shared';
import { useOrder } from '../lib/queries';
import { usePageMeta } from '../lib/usePageMeta';
import { StatusPill } from '../components/ui';
import { CheckIcon } from '../components/icons';
import '../styles/checkout.css';

export default function OrderSuccess() {
  usePageMeta('Order placed', 'Your Chikbo order has been placed.');
  const { orderId } = useParams();
  const location = useLocation();
  const fallbackNumber = (location.state as { orderNumber?: string } | null)?.orderNumber;
  const { data: order, isPending } = useOrder(orderId);

  const orderNumber = order?.orderNumber ?? fallbackNumber;

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
      </div>
    </div>
  );
}
