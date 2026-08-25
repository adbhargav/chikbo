import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../lib/api';
import type { SalesReport } from '../lib/types';
import { formatDayShort, formatPaise, formatPaiseCompact } from '../lib/format';
import { CardSkeleton, EmptyState, ErrorState, Money, PageHead, TableSkeleton } from '../components/ui';

const RANGES = [30, 90, 180] as const;

const tooltipStyle = {
  background: '#1A1714',
  border: 'none',
  borderRadius: 10,
  color: '#FDFBF7',
  fontSize: 13,
} as const;

export function Reports() {
  const [days, setDays] = useState<number>(30);
  const report = useQuery({
    queryKey: ['reports', days],
    queryFn: () => api<SalesReport>('/admin/reports/sales', { query: { days } }),
  });

  const totalRevenue = report.data?.daily.reduce((s, d) => s + d.revenue, 0) ?? 0;
  const totalOrders = report.data?.daily.reduce((s, d) => s + d.orders, 0) ?? 0;

  return (
    <main className="page">
      <PageHead
        overline="Insight"
        title="Reports"
        sub="Sales, best sellers and category performance."
        actions={
          <div className="segmented" role="tablist" aria-label="Date range">
            {RANGES.map((r) => (
              <button
                key={r}
                role="tab"
                aria-selected={days === r}
                className={days === r ? 'active' : ''}
                onClick={() => setDays(r)}
              >
                {r} days
              </button>
            ))}
          </div>
        }
      />

      {report.isError ? (
        <ErrorState error={report.error} onRetry={() => report.refetch()} />
      ) : (
        <>
          <div className="kpi-grid">
            <div className="kpi accent">
              <div className="label">Revenue · {days} days</div>
              {report.isPending ? (
                <div className="skel" style={{ height: 30, marginTop: 8, width: '70%' }} />
              ) : (
                <div className="value">{formatPaise(totalRevenue)}</div>
              )}
            </div>
            <div className="kpi">
              <div className="label">Orders · {days} days</div>
              {report.isPending ? (
                <div className="skel" style={{ height: 30, marginTop: 8, width: '50%' }} />
              ) : (
                <div className="value">{totalOrders.toLocaleString('en-IN')}</div>
              )}
            </div>
            <div className="kpi">
              <div className="label">Avg order value</div>
              {report.isPending ? (
                <div className="skel" style={{ height: 30, marginTop: 8, width: '60%' }} />
              ) : (
                <div className="value">{formatPaise(totalOrders ? Math.round(totalRevenue / totalOrders) : 0)}</div>
              )}
            </div>
          </div>

          <div className="card chart-card" style={{ marginBottom: 22 }}>
            <h3>Daily revenue</h3>
            {report.isPending ? (
              <CardSkeleton height={280} />
            ) : report.data.daily.length === 0 ? (
              <EmptyState title="Nothing sold in this window" message="Try a wider range." />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={report.data.daily} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="repFill" x1="0" y1="0" x2="0" y2="1">
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
                    formatter={(value, name) =>
                      name === 'revenue' ? [formatPaise(Number(value)), 'Revenue'] : [String(value), 'Orders']
                    }
                    labelFormatter={(d) => formatDayShort(String(d))}
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: '#FDFBF7' }}
                    labelStyle={{ color: '#B9B2A9' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#EA7A12" strokeWidth={2} fill="url(#repFill)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="two-col">
            <div className="card">
              <div className="pad" style={{ paddingBottom: 0 }}>
                <h3 className="card-title">Best sellers</h3>
              </div>
              <div className="table-wrap" style={{ border: 'none', maxHeight: 420 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th className="num">Units</th>
                      <th className="num">Revenue</th>
                    </tr>
                  </thead>
                  {report.isPending ? (
                    <TableSkeleton cols={4} rows={6} />
                  ) : report.data.bestSellers.length === 0 ? (
                    <tbody>
                      <tr>
                        <td colSpan={4}>
                          <EmptyState title="No sales in this window" />
                        </td>
                      </tr>
                    </tbody>
                  ) : (
                    <tbody>
                      {report.data.bestSellers.map((row) => (
                        <tr key={row.sku}>
                          <td className="primary">{row.productName}</td>
                          <td className="muted">{row.sku}</td>
                          <td className="num">{row.units}</td>
                          <td className="money">
                            <Money paise={row.revenue} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  )}
                </table>
              </div>
            </div>

            <div className="card chart-card">
              <h3>Revenue by category</h3>
              {report.isPending ? (
                <CardSkeleton height={340} />
              ) : report.data.byCategory.length === 0 ? (
                <EmptyState title="No category sales yet" />
              ) : (
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart
                    data={report.data.byCategory}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid stroke="rgba(185,178,169,.3)" strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      tickFormatter={(v: number) => formatPaiseCompact(v)}
                      tick={{ fontSize: 11, fill: '#6E675F' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="category"
                      width={120}
                      tick={{ fontSize: 12, fill: '#3D3833' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(value) => [formatPaise(Number(value)), 'Revenue']}
                      contentStyle={tooltipStyle}
                      itemStyle={{ color: '#FDFBF7' }}
                      labelStyle={{ color: '#B9B2A9' }}
                      cursor={{ fill: 'rgba(234,122,18,.06)' }}
                    />
                    <Bar dataKey="revenue" fill="#EA7A12" radius={[0, 6, 6, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
