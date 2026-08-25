import { useEffect, useState, type ReactNode } from 'react';
import { formatPaise, humanize, toneForStatus } from '../lib/format';
import { assetUrl, errorMessage } from '../lib/api';

/** Soft tinted status pill with a dot, per the design system. */
export function Pill({ status }: { status: string }) {
  return <span className={`pill ${toneForStatus(status)}`}>{humanize(status)}</span>;
}

/** Right-aligned tabular-nums money cell content. */
export function Money({ paise }: { paise: number }) {
  return <>{formatPaise(paise)}</>;
}

/** Product thumbnail with a graceful cream + monogram fallback (never a broken image). */
export function Thumb({ url, name, large }: { url: string | null | undefined; name: string; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = assetUrl(url);
  useEffect(() => setFailed(false), [src]);
  return (
    <div className={`thumb ${large ? 'lg' : ''}`} aria-hidden={src && !failed ? undefined : true}>
      {src && !failed ? (
        <img src={src} alt={name} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span className="mono">{(name.trim()[0] ?? 'C').toUpperCase()}</span>
      )}
    </div>
  );
}

/** Shimmering skeleton rows for a table while it loads. */
export function TableSkeleton({ cols, rows = 6 }: { cols: number; rows?: number }) {
  return (
    <tbody aria-hidden="true">
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }, (_, c) => (
            <td key={c}>
              <div className="skel" style={{ width: `${55 + ((r * 7 + c * 13) % 40)}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export function CardSkeleton({ height = 220 }: { height?: number }) {
  return <div className="skel" style={{ height, borderRadius: 12 }} aria-hidden="true" />;
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="state-box">
      <div className="glyph">C</div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="state-box" role="alert">
      <div className="glyph">!</div>
      <h3>Couldn't load this</h3>
      <p>{errorMessage(error)}</p>
      {onRetry && (
        <button className="btn btn-secondary btn-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (page: number) => void;
}) {
  if (total === 0) return null;
  return (
    <div className="pagination">
      <span>
        Page {page} of {Math.max(totalPages, 1)} · {total.toLocaleString('en-IN')} total
      </span>
      <div className="pages">
        <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          ← Prev
        </button>
        <button
          className="btn btn-secondary btn-sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

/** Accessible toggle switch. */
export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}

/** Sets the document title for the page. */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Chikbo Admin`;
    return () => {
      document.title = 'Chikbo Admin';
    };
  }, [title]);
}

/** Debounce a fast-changing value (search inputs). */
export function useDebounced<T>(value: T, ms = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** Standard page header with gold overline. */
export function PageHead({
  overline,
  title,
  sub,
  actions,
}: {
  overline: string;
  title: string;
  sub?: string;
  actions?: ReactNode;
}) {
  usePageTitle(title);
  return (
    <div className="page-head">
      <div>
        <div className="overline">{overline}</div>
        <h1>{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 10 }}>{actions}</div>}
    </div>
  );
}

export { formatPaise };
