import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { CategoryDto, ProductListItemDto } from '@chikbo/shared';
import { useCategories, useFilterFacets, useProducts } from '../lib/queries';
import { useStaggerVariants } from '../lib/motion';
import { percentOff } from '../lib/format';
import { swatchFor } from '../lib/colors';
import { AccordionItem } from './Accordion';
import { ProductCard, ProductCardSkeleton } from './ProductCard';
import { EmptyState, ErrorState, Pagination } from './ui';
import { CloseIcon } from './icons';
import '../styles/listing.css';

// Fallbacks while the facets request is in flight (or if the catalog is empty);
// once loaded, the sidebar shows the sizes/colours actually present in products.
const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'];
const DEFAULT_COLORS = [
  'Ivory', 'Beige', 'Red', 'Maroon', 'Pink', 'Orange', 'Yellow', 'Green',
  'Teal', 'Blue', 'Navy', 'Purple', 'Black', 'Gold', 'Silver',
];
const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
];
const PRICE_BANDS = [
  { label: 'Under ₹999', min: '', max: '999' },
  { label: '₹999 – ₹1,999', min: '999', max: '1999' },
  { label: '₹2,000 – ₹3,999', min: '2000', max: '3999' },
  { label: '₹4,000 & above', min: '4000', max: '' },
];
const DISCOUNTS = [10, 20, 30, 40, 50];

const PAGE_SIZE = 16;

interface Props {
  category?: string;
  search?: string;
  /** Page heading rendered above the grid, beside the item count. */
  title?: string;
  /** Empty-state copy when no products match. */
  emptyTitle?: string;
}

function toggleCsv(csv: string, value: string): string {
  const parts = csv ? csv.split(',') : [];
  const next = parts.includes(value) ? parts.filter((p) => p !== value) : [...parts, value];
  return next.join(',');
}

function removeCsv(csv: string, value: string): string {
  return (csv ? csv.split(',') : []).filter((p) => p !== value).join(',');
}

/** The family (parent + siblings) a category belongs to, for the sidebar. */
function familyFor(categories: CategoryDto[], slug: string | undefined) {
  if (!slug) return null;
  for (const cat of categories) {
    if (cat.slug === slug) return cat;
    if ((cat.children ?? []).some((c) => c.slug === slug)) return cat;
  }
  return null;
}

function productDiscount(product: ProductListItemDto): number {
  return product.minDiscountPriceInPaise !== null
    ? percentOff(product.minPriceInPaise, product.minDiscountPriceInPaise)
    : 0;
}

export function ProductListing({ category, search, title, emptyTitle }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const stagger = useStaggerVariants(0.05, 18);
  const { data: categories } = useCategories();
  const { data: facets } = useFilterFacets();

  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const sort = searchParams.get('sort') ?? 'newest';
  const sizes = searchParams.get('sizes') ?? '';
  const colors = searchParams.get('colors') ?? '';
  const inStock = searchParams.get('inStock') === 'true';
  const minPrice = searchParams.get('minPrice') ?? '';
  const maxPrice = searchParams.get('maxPrice') ?? '';
  const discount = searchParams.get('discount') ?? '';

  const [priceDraft, setPriceDraft] = useState({ min: minPrice, max: maxPrice });
  useEffect(() => {
    setPriceDraft({ min: minPrice, max: maxPrice });
  }, [minPrice, maxPrice]);

  const query = useProducts({
    page,
    pageSize: PAGE_SIZE,
    category,
    search,
    sort,
    sizes: sizes || undefined,
    colors: colors || undefined,
    inStock: inStock ? 'true' : undefined,
    minPrice: minPrice || undefined,
    maxPrice: maxPrice || undefined,
    // Forward-compatible: the API ignores it today, so the discount band is
    // also applied client-side below.
    minDiscount: discount || undefined,
  });

  const update = (patch: Record<string, string | null>, keepPage = false) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(patch)) {
          if (value === null || value === '') next.delete(key);
          else next.set(key, value);
        }
        if (!keepPage) next.delete('page');
        return next;
      },
      { preventScrollReset: false },
    );
  };

  const clearFilters = () =>
    update({
      sizes: null,
      colors: null,
      inStock: null,
      minPrice: null,
      maxPrice: null,
      discount: null,
    });

  const applyPrice = (e: React.FormEvent) => {
    e.preventDefault();
    update({ minPrice: priceDraft.min.trim() || null, maxPrice: priceDraft.max.trim() || null });
  };

  /** Applied-filter chips, in the order they read best. */
  const appliedChips: { key: string; label: string; clear: () => void }[] = [];
  {
    for (const size of sizes ? sizes.split(',') : []) {
      appliedChips.push({
        key: `size-${size}`,
        label: `Size ${size}`,
        clear: () => update({ sizes: removeCsv(sizes, size) || null }),
      });
    }
    for (const color of colors ? colors.split(',') : []) {
      appliedChips.push({
        key: `color-${color}`,
        label: color,
        clear: () => update({ colors: removeCsv(colors, color) || null }),
      });
    }
    if (minPrice || maxPrice) {
      appliedChips.push({
        key: 'price',
        label: `₹${minPrice || '0'} – ${maxPrice ? `₹${maxPrice}` : 'any'}`,
        clear: () => update({ minPrice: null, maxPrice: null }),
      });
    }
    if (discount) {
      appliedChips.push({
        key: 'discount',
        label: `${discount}% off or more`,
        clear: () => update({ discount: null }),
      });
    }
    if (inStock) {
      appliedChips.push({ key: 'instock', label: 'In stock', clear: () => update({ inStock: null }) });
    }
  }

  const activeFilterCount = appliedChips.length;

  // Prefer live facets; fall back to the defaults while loading or if empty.
  // Selected values missing from the options (e.g. a stale link) are appended
  // so their chips stay visible and can be toggled off.
  const withSelected = (options: string[], selectedCsv: string) => {
    const seen = new Set(options.map((o) => o.toLowerCase()));
    const extras = (selectedCsv ? selectedCsv.split(',') : []).filter((s) => {
      if (!s || seen.has(s.toLowerCase())) return false;
      seen.add(s.toLowerCase());
      return true;
    });
    return [...options, ...extras];
  };
  const sizeOptions = withSelected(facets?.sizes.length ? facets.sizes : DEFAULT_SIZES, sizes);
  const colorOptions = withSelected(facets?.colors.length ? facets.colors : DEFAULT_COLORS, colors);

  const family = familyFor(categories ?? [], category);
  const categoryLinks: CategoryDto[] = family
    ? [family, ...(family.children ?? [])]
    : (categories ?? []).filter((c) => !c.parentId);

  // Client-side discount refinement (see the query note above).
  const rawItems = query.data?.items ?? [];
  const items = discount
    ? rawItems.filter((p) => productDiscount(p) >= Number(discount))
    : rawItems;
  const trimmed = items.length !== rawItems.length;
  const total = query.data ? (trimmed ? items.length : query.data.total) : 0;

  const filters = (
    <div className="filters" id="listing-filters">
      <div className="filters-head">
        <h2>Filters</h2>
        <button
          type="button"
          className="filters-clear"
          onClick={clearFilters}
          disabled={activeFilterCount === 0}
        >
          Reset
        </button>
      </div>

      {categoryLinks.length > 0 && (
        <AccordionItem title="Category" className="acc-item--filter" defaultOpen>
          <ul className="filter-links">
            {categoryLinks.map((cat) => (
              <li key={cat.id}>
                <Link
                  to={`/c/${cat.slug}`}
                  className={`filter-link${cat.slug === category ? ' filter-link--active' : ''}`}
                  aria-current={cat.slug === category ? 'page' : undefined}
                >
                  {cat.name}
                </Link>
              </li>
            ))}
          </ul>
        </AccordionItem>
      )}

      <AccordionItem
        title="Size"
        className="acc-item--filter"
        defaultOpen
        hint={sizes ? `${sizes.split(',').length}` : null}
      >
        <div className="filter-chips">
          {sizeOptions.map((size) => {
            const active = sizes.split(',').includes(size);
            return (
              <button
                key={size}
                type="button"
                className={`chip${active ? ' chip--active' : ''}`}
                aria-pressed={active}
                onClick={() => update({ sizes: toggleCsv(sizes, size) || null })}
              >
                {size}
              </button>
            );
          })}
        </div>
      </AccordionItem>

      <AccordionItem
        title="Colour"
        className="acc-item--filter"
        defaultOpen={!!colors}
        hint={colors ? `${colors.split(',').length}` : null}
      >
        <div className="filter-chips">
          {colorOptions.map((color) => {
            const active = colors.split(',').includes(color);
            const swatch = swatchFor(color);
            return (
              <button
                key={color}
                type="button"
                className={`chip chip--swatch${active ? ' chip--active' : ''}`}
                aria-pressed={active}
                onClick={() => update({ colors: toggleCsv(colors, color) || null })}
              >
                <span
                  className={`chip-dot${swatch.light ? ' chip-dot--light' : ''}`}
                  style={{ background: swatch.fill }}
                  aria-hidden="true"
                />
                {color}
              </button>
            );
          })}
        </div>
      </AccordionItem>

      <AccordionItem title="Price" className="acc-item--filter" defaultOpen>
        <ul className="filter-options">
          {PRICE_BANDS.map((band) => {
            const active = minPrice === band.min && maxPrice === band.max;
            return (
              <li key={band.label}>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() =>
                      update(
                        active
                          ? { minPrice: null, maxPrice: null }
                          : { minPrice: band.min || null, maxPrice: band.max || null },
                      )
                    }
                  />
                  {band.label}
                </label>
              </li>
            );
          })}
        </ul>
        <form className="price-form" onSubmit={applyPrice}>
          <label className="visually-hidden" htmlFor="min-price">
            Minimum price in rupees
          </label>
          <input
            id="min-price"
            className="input"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="Min"
            value={priceDraft.min}
            onChange={(e) => setPriceDraft((d) => ({ ...d, min: e.target.value }))}
          />
          <span aria-hidden="true">–</span>
          <label className="visually-hidden" htmlFor="max-price">
            Maximum price in rupees
          </label>
          <input
            id="max-price"
            className="input"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="Max"
            value={priceDraft.max}
            onChange={(e) => setPriceDraft((d) => ({ ...d, max: e.target.value }))}
          />
          <button type="submit" className="btn btn-secondary btn-sm">
            Go
          </button>
        </form>
      </AccordionItem>

      <AccordionItem title="Discount" className="acc-item--filter" defaultOpen={!!discount}>
        <ul className="filter-options">
          {DISCOUNTS.map((value) => (
            <li key={value}>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={discount === String(value)}
                  onChange={(e) => update({ discount: e.target.checked ? String(value) : null })}
                />
                {value}% off or more
              </label>
            </li>
          ))}
        </ul>
      </AccordionItem>

      <AccordionItem title="Availability" className="acc-item--filter" defaultOpen>
        <label className="check-row">
          <input
            type="checkbox"
            checked={inStock}
            onChange={(e) => update({ inStock: e.target.checked ? 'true' : null })}
          />
          In stock only
        </label>
      </AccordionItem>
    </div>
  );

  return (
    <div className="listing">
      <div className="plp-head">
        <div className="plp-headline">
          {title && <h1 className="plp-title">{title}</h1>}
          <p className="plp-count muted" aria-live="polite">
            {query.data ? `${total} ${total === 1 ? 'item' : 'items'}` : ' '}
          </p>
        </div>
        <div className="plp-tools">
          <button
            type="button"
            className="btn btn-secondary btn-sm listing-filter-toggle"
            aria-expanded={filtersOpen}
            aria-controls="listing-filters"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
          <label className="sort-label">
            <span className="muted">Sort by</span>
            <select
              className="select"
              value={sort}
              onChange={(e) => update({ sort: e.target.value === 'newest' ? null : e.target.value })}
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {appliedChips.length > 0 && (
        <div className="applied-chips" aria-label="Applied filters">
          {appliedChips.map((chip) => (
            <motion.button
              key={chip.key}
              type="button"
              className="applied-chip"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              onClick={chip.clear}
              aria-label={`Remove filter ${chip.label}`}
            >
              {chip.label}
              <CloseIcon size={13} />
            </motion.button>
          ))}
          <button type="button" className="applied-clear" onClick={clearFilters}>
            Clear all
          </button>
        </div>
      )}

      <div className="listing-body">
        <aside className={`listing-side${filtersOpen ? ' listing-side--open' : ''}`} data-lenis-prevent>
          {filters}
        </aside>

        <div className="listing-main">
          {query.isPending && (
            <div className="product-grid product-grid--dense" aria-busy="true" aria-label="Loading products">
              {Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          )}

          {query.isError && <ErrorState onRetry={() => query.refetch()} />}

          {query.data && items.length === 0 && (
            <EmptyState
              title={emptyTitle ?? 'Nothing here just yet'}
              body="Try adjusting your filters, or explore the full collection."
            >
              {activeFilterCount > 0 && (
                <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </EmptyState>
          )}

          {query.data && items.length > 0 && (
            <>
              <motion.div
                className="product-grid product-grid--dense"
                key={`${page}-${sort}-${sizes}-${colors}-${minPrice}-${maxPrice}-${inStock}-${discount}`}
                variants={stagger.parent}
                initial="hidden"
                animate="show"
              >
                {items.map((product) => (
                  <motion.div key={product.id} variants={stagger.child} className="product-grid-cell">
                    <ProductCard product={product} />
                  </motion.div>
                ))}
              </motion.div>
              <Pagination
                page={page}
                totalPages={query.data.totalPages}
                onPage={(p) => {
                  update({ page: p === 1 ? null : String(p) }, true);
                  window.scrollTo({ top: 0 });
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
