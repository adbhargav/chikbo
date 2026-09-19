import { useEffect, useState } from 'react';
import { Thumb } from '../ui';
import { useProductIndex } from '../../lib/productIndex';
import { CategorySelect, type CategoryChoice } from './CategorySelect';
import { ProductSearch } from './ProductSearch';

type Kind = 'none' | 'category' | 'product' | 'home' | 'custom';

interface Props {
  id: string;
  /** Stored link: "/c/<category>", "/p/<product>", "/", any other path, a full URL, or "". */
  value: string;
  onChange: (href: string) => void;
  /** Category choices keyed by slug. */
  categories: CategoryChoice[];
  disabled?: boolean;
}

function kindOf(href: string): Kind {
  if (!href) return 'none';
  if (href === '/') return 'home';
  if (/^\/c\/[^/?#]+$/.test(href)) return 'category';
  if (/^\/p\/[^/?#]+$/.test(href)) return 'product';
  return 'custom';
}

/**
 * "Where should this go when tapped?" — pick a category or a product by name
 * instead of typing a web address. Other links are still possible via
 * "Another page or website".
 */
export function LinkPicker({ id, value, onChange, categories, disabled }: Props) {
  const [kind, setKind] = useState<Kind>(() => kindOf(value));
  // Follow the stored value when the row is reloaded from the server.
  useEffect(() => setKind(kindOf(value)), [value]);
  const index = useProductIndex(kind === 'product');

  const categorySlug = kind === 'category' ? value.slice(3) : '';
  const productSlug = kind === 'product' ? value.slice(3) : '';
  const chosenProduct = index.data?.find((p) => p.slug === productSlug);
  const unknownCategory = kind === 'category' && categorySlug && !categories.some((c) => c.value === categorySlug);

  const changeKind = (next: Kind) => {
    setKind(next);
    if (next === 'none') onChange('');
    else if (next === 'home') onChange('/');
    else if (next === 'custom') onChange(kind === 'custom' ? value : '');
    else onChange('');
  };

  return (
    <div className="field linkpick">
      <label htmlFor={`${id}-kind`}>When tapped, go to</label>
      <select id={`${id}-kind`} value={kind} onChange={(e) => changeKind(e.target.value as Kind)} disabled={disabled}>
        <option value="none">Nowhere (not clickable)</option>
        <option value="category">A category</option>
        <option value="product">A product</option>
        <option value="home">The homepage</option>
        <option value="custom">Another page or website</option>
      </select>

      {kind === 'category' && (
        <CategorySelect
          id={id}
          aria-label="Category"
          value={unknownCategory ? '' : categorySlug}
          onChange={(slug) => onChange(slug ? `/c/${slug}` : '')}
          options={categories}
          placeholder="Choose a category…"
          disabled={disabled}
        />
      )}
      {unknownCategory && (
        <span className="field-error">That category no longer exists or is hidden. Choose another one.</span>
      )}

      {kind === 'product' &&
        (productSlug ? (
          <div className="linkpick-chosen">
            {chosenProduct ? (
              <>
                <Thumb url={chosenProduct.thumbnailUrl} name={chosenProduct.name} />
                <span className="linkpick-chosen-name">{chosenProduct.name}</span>
              </>
            ) : (
              <span className="linkpick-chosen-name muted">{index.isPending ? 'Loading…' : 'This product was removed.'}</span>
            )}
            {!disabled && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange('')}>
                Change
              </button>
            )}
          </div>
        ) : (
          <ProductSearch
            id={id}
            products={index.data ?? []}
            loading={index.isPending}
            onPick={(p) => onChange(`/p/${p.slug}`)}
            disabled={disabled}
          />
        ))}

      {kind === 'custom' && (
        <>
          <input
            id={id}
            type="text"
            value={value}
            placeholder="https://… or a page on this store, e.g. /search?q=silk"
            onChange={(e) => onChange(e.target.value.trim())}
            disabled={disabled}
          />
          <span className="hint">A full link starting with https://, or a page on this store starting with /.</span>
        </>
      )}
    </div>
  );
}
