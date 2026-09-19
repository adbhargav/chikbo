import { useState } from 'react';
import { Thumb } from '../ui';
import { searchProducts, type ProductChoice } from '../../lib/productIndex';

interface Props {
  id: string;
  products: ProductChoice[];
  loading?: boolean;
  onPick: (product: ProductChoice) => void;
  /** Products already chosen, hidden from results. */
  exclude?: string[];
  placeholder?: string;
  disabled?: boolean;
}

/** Type a product name, click a result. */
export function ProductSearch({ id, products, loading, onPick, exclude = [], placeholder, disabled }: Props) {
  const [term, setTerm] = useState('');
  const results = searchProducts(products, term).filter((p) => !exclude.includes(p.id));

  return (
    <div className="psearch">
      <input
        id={id}
        type="search"
        value={term}
        placeholder={placeholder ?? 'Type a product name, e.g. Pattu saree'}
        onChange={(e) => setTerm(e.target.value)}
        disabled={disabled}
        autoComplete="off"
      />
      {term.trim() && (
        <ul className="psearch-results" role="listbox" aria-label="Matching products">
          {loading ? (
            <li className="psearch-empty">Loading products…</li>
          ) : results.length === 0 ? (
            <li className="psearch-empty">No product names match “{term.trim()}”.</li>
          ) : (
            results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="psearch-option"
                  onClick={() => {
                    onPick(p);
                    setTerm('');
                  }}
                >
                  <Thumb url={p.thumbnailUrl} name={p.name} />
                  <span className="psearch-name">{p.name}</span>
                  {!p.isActive && <span className="psearch-tag">Hidden</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
