import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { OrderStatus } from '@chikbo/shared';
import { humanizeStatus } from '../lib/format';
import { absoluteUrl, breadcrumbSchema, canonicalFor } from '../lib/seo';

/* ---------------------------------------------------------------- Pills */

const STATUS_TONE: Record<string, string> = {
  PENDING: 'neutral',
  CONFIRMED: 'info',
  PROCESSING: 'info',
  SHIPPED: 'warn',
  OUT_FOR_DELIVERY: 'warn',
  DELIVERED: 'success',
  CANCELLED: 'error',
  RETURN_REQUESTED: 'warn',
  RETURNED: 'neutral',
  REFUND_INITIATED: 'info',
  REFUNDED: 'success',
  REQUESTED: 'warn',
  APPROVED: 'success',
  REJECTED: 'error',
  PICKUP_SCHEDULED: 'info',
  IN_TRANSIT: 'info',
  RECEIVED: 'success',
};

export function StatusPill({ status }: { status: OrderStatus | string }) {
  const tone = STATUS_TONE[status] ?? 'neutral';
  return <span className={`pill pill--${tone}`}>{humanizeStatus(status)}</span>;
}

/* ---------------------------------------------------------- Breadcrumbs */

export interface Crumb {
  label: string;
  to?: string;
}

/**
 * The visible breadcrumb trail *and* its BreadcrumbList JSON-LD, both derived
 * from the one `items` array — so the schema can never disagree with what the
 * user actually sees (a common cause of "breadcrumb mismatch" penalties).
 *
 * Pass `schema={false}` on noindex routes where the markup buys nothing.
 */
export function Breadcrumbs({ items, schema = true }: { items: Crumb[]; schema?: boolean }) {
  const { pathname } = useLocation();
  const last = items.length - 1;

  return (
    <>
      {schema && items.length > 1 && (
        <JsonLd
          data={breadcrumbSchema(
            items.map((item, i) => ({
              name: item.label,
              // The trailing crumb is the page itself; everything else links.
              url: item.to ? absoluteUrl(item.to) : i === last ? canonicalFor(pathname) : null,
            })),
          )}
        />
      )}
      <nav aria-label="Breadcrumb" className="breadcrumbs">
        <ol>
          {items.map((item, i) => (
            <li key={i}>
              {item.to && i < last ? (
                <Link to={item.to}>{item.label}</Link>
              ) : (
                <span aria-current={i === last ? 'page' : undefined}>{item.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}

/* ----------------------------------------------------------- Qty stepper */

interface QtyProps {
  value: number;
  max: number;
  onChange: (qty: number) => void;
  disabled?: boolean;
  label?: string;
}

export function QtyStepper({ value, max, onChange, disabled, label = 'Quantity' }: QtyProps) {
  const clampedMax = Math.max(1, max);
  return (
    <div className="qty-stepper" role="group" aria-label={label}>
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={disabled || value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        −
      </button>
      <span aria-live="polite">{value}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={disabled || value >= clampedMax}
        onClick={() => onChange(Math.min(clampedMax, value + 1))}
      >
        +
      </button>
    </div>
  );
}

/* ------------------------------------------------------------ Pagination */

interface PaginationProps {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}

export function Pagination({ page, totalPages, onPage }: PaginationProps) {
  if (totalPages <= 1) return null;
  const pages: number[] = [];
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  for (let p = start; p <= end; p++) pages.push(p);
  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="page-btn"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        aria-label="Previous page"
      >
        ‹
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          className={`page-btn${p === page ? ' page-btn--active' : ''}`}
          aria-current={p === page ? 'page' : undefined}
          onClick={() => onPage(p)}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        className="page-btn"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        aria-label="Next page"
      >
        ›
      </button>
    </nav>
  );
}

/* ---------------------------------------------------- Empty/error states */

interface EmptyProps {
  title: string;
  body?: string;
  cta?: { label: string; to: string };
  children?: ReactNode;
}

export function EmptyState({ title, body, cta, children }: EmptyProps) {
  return (
    <div className="empty-state">
      <span className="empty-state-mono" aria-hidden="true">
        C
      </span>
      <h3>{title}</h3>
      {body && <p className="muted">{body}</p>}
      {cta && (
        <Link to={cta.to} className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>
          {cta.label}
        </Link>
      )}
      {children}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="empty-state" role="alert">
      <h3>Something went astray</h3>
      <p className="muted">{message ?? 'We could not load this right now. Please try again.'}</p>
      {onRetry && (
        <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- JSON-LD */

/**
 * Serialise structured data for an inline `<script>`.
 *
 * `</script>` inside a string value would terminate the block and turn the
 * remainder of the payload into executable markup, so `<`, `>` and `&` are
 * escaped to their JSON unicode forms — legal JSON, inert HTML. U+2028/2029
 * are escaped too: they are valid JSON but illegal in JS string literals.
 */
function serialiseJsonLd(data: object): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function JsonLd({ data }: { data: object }) {
  return (
    // eslint-disable-next-line react/no-danger
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialiseJsonLd(data) }} />
  );
}
