import { useNotifications } from '../../lib/queries';
import { usePageMeta } from '../../lib/usePageMeta';
import { formatDateTime } from '../../lib/format';
import { EmptyState, ErrorState } from '../../components/ui';

export default function Notifications() {
  usePageMeta('Notifications', 'Your Chikbo notifications.');
  const notifications = useNotifications();

  if (notifications.isPending) {
    return (
      <div className="account-stack" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton" style={{ height: 70 }} />
        ))}
      </div>
    );
  }
  if (notifications.isError) return <ErrorState onRetry={() => notifications.refetch()} />;

  const items = notifications.data;

  if (items.length === 0) {
    return (
      <EmptyState title="All quiet for now" body="Order updates and offers will appear here." />
    );
  }

  return (
    <div className="account-stack">
      <h2>Notifications</h2>
      <ul className="notif-list">
        {items.map((notification) => (
          <li
            key={notification.id}
            className={`card card-pad notif-item${notification.readAt ? '' : ' notif-item--unread'}`}
          >
            <p className="notif-title">{notification.title}</p>
            {(notification.body ?? notification.message) && (
              <p className="muted" style={{ fontSize: 14 }}>
                {notification.body ?? notification.message}
              </p>
            )}
            <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
              {formatDateTime(notification.createdAt)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
