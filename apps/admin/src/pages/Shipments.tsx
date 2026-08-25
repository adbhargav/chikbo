import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { Paginated } from '@chikbo/shared';
import { api } from '../lib/api';
import type { AdminShipmentRow } from '../lib/types';
import { formatDateTime } from '../lib/format';
import { EmptyState, ErrorState, PageHead, Pagination, Pill, TableSkeleton } from '../components/ui';

export function Shipments() {
  const [page, setPage] = useState(1);
  const shipments = useQuery({
    queryKey: ['shipments', page],
    queryFn: () => api<Paginated<AdminShipmentRow>>('/admin/shipments', { query: { page, pageSize: 20 } }),
    placeholderData: keepPreviousData,
  });

  const data = shipments.data;

  return (
    <main className="page">
      <PageHead overline="Fulfilment" title="Shipments" sub="Every parcel on the road with Shiprocket." />

      {shipments.isError ? (
        <ErrorState error={shipments.error} onRetry={() => shipments.refetch()} />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>AWB</th>
                  <th>Courier</th>
                  <th>Order</th>
                  <th>Destination</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              {shipments.isPending ? (
                <TableSkeleton cols={6} rows={8} />
              ) : data && data.items.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        title="No shipments yet"
                        message="Create shipments from an order's detail page."
                      />
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody>
                  {data?.items.map((s) => (
                    <tr key={s.id}>
                      <td className="primary mono">{s.awbCode ?? '— pending'}</td>
                      <td>{s.courierName ?? '—'}</td>
                      <td>
                        <Link className="link" to={`/orders/${s.orderId}`}>
                          {s.order.orderNumber}
                        </Link>
                        {s.isReturn && (
                          <span className="pill neutral" style={{ marginLeft: 8 }}>
                            Return
                          </span>
                        )}
                      </td>
                      <td className="muted">
                        {s.order.shipCity}, {s.order.shipState}
                      </td>
                      <td>
                        <Pill status={s.status} />
                      </td>
                      <td className="muted">{formatDateTime(s.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
          {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />}
        </>
      )}
    </main>
  );
}
