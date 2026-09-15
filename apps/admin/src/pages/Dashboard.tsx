import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../lib/api';
import type { DashboardData, SalesReport } from '../lib/types';
import { formatDayShort, formatDateTime, formatPaise, formatPaiseCompact } from '../lib/format';
import { useAuth } from '../lib/auth';
import { CardSkeleton, EmptyState, ErrorState, Money, PageHead, Pill, TableSkeleton } from '../components/ui';

const KPI_DEFS: {
  key: keyof Omit<DashboardData, 'recentOrders'>;
  label: string;
  money?: boolean;
  accent?: boolean;
  alert?: boolean;
}[] = [
  { key: 'ordersToday', label: 'Orders today' },
  { key: 'revenueTodayInPaise', label: 'Revenue today', money: true, accent: true },
  { key: 'revenueMonthInPaise', label: 'Revenue this month', money: true, accent: true },
  { key: 'pendingShipments', label: 'Pending shipments' },
  { key: 'openReturns', label: 'Open returns' },
  { key: 'lowStockCount', label: 'Low stock', alert: true },
  { key: 'customers', label: 'Customers' },
];

export function Dashboard() {
  const { hasPermission } = useAuth();
  const canSeeReports = hasPermission('reports.read');

  const dash = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardData>('/admin/dashboard'),
  });
  const sales = useQuery({
    queryKey: ['reports', 30],
    queryFn: () => api<SalesReport>('/admin/reports/sales', { query: { days: 30 } }),
    enabled: canSeeReports,
  });

  return (
    <main className="page">
      <PageHead overline="Since 1992" title="Good to see you" sub="Here's how the house is doing today." />

      {dash.isError ? (
        <ErrorState error={dash.error} onRetry={() => dash.refetch()} />
      ) : (
        <>
          <div className="kpi-grid">
            {KPI_DEFS.map((def) => (
              <div
                key={def.key}
                className={`kpi ${def.accent ? 'accent' : ''} ${
                  def.alert && dash.data && dash.data[def.key] > 0 ? 'alert' : ''
                }`}
              >
                <div className="label">{def.label}</div>
                {dash.isPending ? (
                  <div className="skel" style={{ height: 30, marginTop: 8, width: '70%' }} />
                ) : (
                  <div className="value">
                    {def.money ? formatPaise(dash.data[def.key]) : dash.data[def.key].toLocaleString('en-IN')}
                  </div>
                )}
              </div>
            ))}
          </div>

          {canSeeReports && (
            <div className="card chart-card" style={{ marginBottom: 22 }}>
              <h3>Revenue · last 30 days</h3>
              {sales.isPending ? (
                <CardSkeleton height={260} />
              ) : sales.isError ? (
                <ErrorState error={sales.error} onRetry={() => sales.refetch()} />
              ) : sales.data.daily.length === 0 ? (
                <EmptyState title="No sales yet" message="Revenue will chart here as orders come in." />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={sales.data.daily} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#EA7A12" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#EA7A12" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(185,178,169,.3)" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tickFormatter={(d: string) => formatDayShort(d)}
                      tick={{ fontSize: 11, fill: '#6E675F' }}
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(185,178,169,.5)' }}
                    />
                    <YAxis
                      tickFormatter={(v: number) => formatPaiseCompact(v)}
                      tick={{ fontSize: 11, fill: '#6E675F' }}
                      tickLine={false}
                      axisLine={false}
                      width={58}
                    />
                    <Tooltip
                      formatter={(value) => [formatPaise(Number(value)), 'Revenue']}
                      labelFormatter={(d) => formatDayShort(String(d))}
                      contentStyle={{
                        background: '#1A1714',
                        border: 'none',
                        borderRadius: 10,
                        color: '#FDFBF7',
                        fontSize: 13,
                      }}
                      itemStyle={{ color: '#FDFBF7' }}
                      labelStyle={{ color: '#B9B2A9' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#EA7A12"
                      strokeWidth={2}
                      fill="url(#revFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          <div className="card">
            <div className="pad" style={{ paddingBottom: 0 }}>
              <h3 className="card-title">Recent orders</h3>
            </div>
            <div className="table-wrap" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th className="num">Items</th>
                    <th>Status</th>
                    <th className="num">Total</th>
                    <th>Placed</th>
                  </tr>
                </thead>
                {dash.isPending ? (
                  <TableSkeleton cols={6} rows={6} />
                ) : dash.data.recentOrders.length === 0 ? (
                  <tbody>
                    <tr>
                      <td colSpan={6}>
                        <EmptyState title="No orders yet" message="New orders will appear here." />
                      </td>
                    </tr>
                  </tbody>
                ) : (
                  <tbody>
                    {dash.data.recentOrders.map((o) => (
                      <tr key={o.id}>
                        <td className="primary">
                          <Link className="link" to={`/orders/${o.id}`}>
                            {o.orderNumber}
                          </Link>
                        </td>
                        <td>{o.user?.name ?? `${o.shipFullName} (guest)`}</td>
                        <td className="num">{o.items.reduce((s, i) => s + i.qty, 0)}</td>
                        <td>
                          <Pill status={o.status} />
                        </td>
                        <td className="money">
                          <Money paise={o.totalInPaise} />
                        </td>
                        <td className="muted">{formatDateTime(o.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                )}
              </table>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
