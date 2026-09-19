import { Thumb } from '../ui';
import { useProductIndex } from '../../lib/productIndex';
import { ProductSearch } from './ProductSearch';

interface Props {
  id: string;
  /** Chosen product ids, in display order. */
  value: string[];
  onChange: (ids: string[]) => void;
  max?: number;
  disabled?: boolean;
}

/** Hand-pick products by name, then arrange them. Stores ids; shows names and photos. */
export function ProductListPicker({ id, value, onChange, max = 24, disabled }: Props) {
  const index = useProductIndex();
  const byId = new Map((index.data ?? []).map((p) => [p.id, p]));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div className="field">
      <label htmlFor={id}>Products to show</label>
      {value.length > 0 ? (
        <ol className="plist">
          {value.map((pid, i) => {
            const p = byId.get(pid);
            return (
              <li key={pid} className="plist-row">
                <span className="plist-n">{i + 1}</span>
                <Thumb url={p?.thumbnailUrl} name={p?.name ?? 'Product'} />
                <span className="plist-name">
                  {p ? p.name : index.isPending ? 'Loading…' : 'Removed product'}
                  {p && !p.isActive && <span className="psearch-tag">Hidden — won’t show</span>}
                </span>
                {!disabled && (
                  <span className="plist-actions">
                    <button type="button" className="btn btn-ghost btn-sm" aria-label="Move up" onClick={() => move(i, i - 1)} disabled={i === 0}>
                      ↑
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" aria-label="Move down" onClick={() => move(i, i + 1)} disabled={i === value.length - 1}>
                      ↓
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" aria-label={`Remove ${p?.name ?? 'product'}`} onClick={() => onChange(value.filter((x) => x !== pid))}>
                      Remove
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="muted" style={{ fontSize: 13, margin: '2px 0 8px' }}>
          No products chosen yet. Search below and click a product to add it.
        </p>
      )}
      {!disabled && value.length < max && (
        <ProductSearch
          id={id}
          products={index.data ?? []}
          loading={index.isPending}
          exclude={value}
          onPick={(p) => onChange([...value, p.id])}
          placeholder="Search to add a product…"
        />
      )}
      <span className="hint">They appear on the homepage in this order.</span>
    </div>
  );
}
