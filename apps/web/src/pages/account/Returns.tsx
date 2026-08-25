import { Link } from 'react-router-dom';
import { useReturns } from '../../lib/queries';
import { usePageMeta } from '../../lib/usePageMeta';
import { formatDate } from '../../lib/format';
import { EmptyState, ErrorState, StatusPill } from '../../components/ui';

export default function Returns() {
  usePageMeta('Returns', 'Your return requests.');
  const returns = useReturns();

  if (returns.isPending) {
    return (
      <div className="account-stack" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="skeleton" style={{ height: 90 }} />
        ))}
      </div>
    );
  }
  if (returns.isError) return <ErrorState onRetry={() => returns.refetch()} />;

  const items = returns.data;

  if (items.length === 0) {
    return (
      <EmptyState
        title="No return requests"
        body="Delivered something damaged? Raise a return from the order's page."
        cta={{ label: 'View orders', to: '/account/orders' }}
      />
    );
  }

  return (
    <div className="account-stack">
      <h2>Returns</h2>
      <ul className="order-rows">
        {items.map((request) => (
          <li key={request.id} className="card card-pad return-row">
            <div className="account-section-head" style={{ marginBottom: 6 }}>
              <strong>
                {request.productName ?? request.orderNumber ?? `Request ${request.id.slice(0, 8)}`}
              </strong>
              <StatusPill status={request.status} />
            </div>
            <p className="muted" style={{ fontSize: 14 }}>
              {request.reason}
            </p>
            {request.adminNote && (
              <p className="alert alert-info" style={{ marginTop: 10, marginBottom: 0 }}>
                Note from Chikbo: {request.adminNote}
              </p>
            )}
            <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
              Requested {formatDate(request.createdAt)}
              {request.orderId && (
                <>
                  {' · '}
                  <Link to={`/account/orders/${request.orderId}`} style={{ textDecoration: 'underline' }}>
                    View order
                  </Link>
                </>
              )}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
