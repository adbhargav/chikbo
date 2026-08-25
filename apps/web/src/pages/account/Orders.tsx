import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatPaise } from '@chikbo/shared';
import { useOrders } from '../../lib/queries';
import { usePageMeta } from '../../lib/usePageMeta';
import { formatDate } from '../../lib/format';
import { EmptyState, ErrorState, Pagination, StatusPill } from '../../components/ui';

export default function Orders() {
  usePageMeta('Orders', 'Your Chikbo orders.');
  const [page, setPage] = useState(1);
  const orders = useOrders(page);

  if (orders.isPending) {
    return (
      <div className="account-stack" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton" style={{ height: 84 }} />
        ))}
      </div>
    );
  }
  if (orders.isError) return <ErrorState onRetry={() => orders.refetch()} />;

  const { items, totalPages } = orders.data;

  if (items.length === 0) {
    return (
      <EmptyState
        title="No orders yet"
        body="When you place your first order, it will live here."
        cta={{ label: 'Start shopping', to: '/' }}
      />
    );
  }

  return (
    <div className="account-stack">
      <h2>Orders</h2>
      <ul className="order-rows">
        {items.map((order) => (
          <li key={order.id}>
            <Link to={`/account/orders/${order.id}`} className="order-row card">
              <div className="order-row-main">
                <strong>{order.orderNumber}</strong>
                <span className="muted">
                  {formatDate(order.createdAt)} · {order.items.length} item
                  {order.items.length === 1 ? '' : 's'}
                </span>
              </div>
              <span className="price">{formatPaise(order.totalInPaise)}</span>
              <StatusPill status={order.status} />
              <span className="order-row-arrow" aria-hidden="true">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Pagination page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  );
}
