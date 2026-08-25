/**
 * Search overlay — a full-width panel that drops from the top of the viewport
 * over a blurred backdrop.
 *
 * Live suggestions are debounced 250ms against
 * `/catalog/products?search=<q>&pageSize=6`; recent searches persist in
 * localStorage (5 max, clearable) and the category chips come from the live
 * tree. Enter submits to /search?q=, Escape or a backdrop click closes, focus
 * is trapped while open and restored to the trigger on close.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { formatPaise } from '@chikbo/shared';
import type { CategoryDto, Paginated, ProductListItemDto } from '@chikbo/shared';
import { api } from '../../lib/api';
import { EASE, useMotionOK } from '../../lib/motion';
import { categoryPath } from '../../lib/nav';
import {
  clearRecentSearches,
  pushRecentSearch,
  readRecentSearches,
  useFocusTrap,
  useNavUi,
  useScrollLock,
} from '../../lib/nav-ui';
import { ProductImage } from '../ProductImage';
import { ClockIcon, CloseIcon, SearchIcon } from '../icons';
import '../../styles/nav.css';

const DEBOUNCE_MS = 250;
const MIN_QUERY = 2;

interface Props {
  categories: CategoryDto[];
}

export function SearchOverlay({ categories }: Props) {
  const { panel, closeNav } = useNavUi();
  const open = panel === 'search';
  const ok = useMotionOK();
  const navigate = useNavigate();

  const panelRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [recent, setRecent] = useState<string[]>([]);

  // Fresh slate every time the overlay opens.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setDebounced('');
    setRecent(readRecentSearches());
  }, [open]);

  // 250ms debounce before we ask the API for suggestions.
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [query]);

  const term = debounced.trim();
  const enabled = open && term.length >= MIN_QUERY;
  const { data, isFetching } = useQuery({
    queryKey: ['search-suggest', term],
    queryFn: () =>
      api<Paginated<ProductListItemDto>>('/catalog/products', {
        query: { search: term, pageSize: 6 },
      }),
    enabled,
    staleTime: 60 * 1000,
  });

  useScrollLock(open);
  useFocusTrap(panelRef, open, closeNav, '.search-overlay-input');

  const suggestions = enabled ? (data?.items ?? []) : [];

  const runSearch = (raw: string) => {
    const q = raw.trim();
    if (!q) return;
    setRecent(pushRecentSearch(q));
    closeNav();
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query);
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'ArrowDown') return;
    const first = panelRef.current?.querySelector<HTMLElement>('.search-result');
    if (first) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="search-overlay-root" role="presentation">
          <motion.div
            className="search-overlay-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={closeNav}
          />
          <motion.div
            ref={panelRef}
            className="search-overlay"
            data-lenis-prevent
            role="dialog"
            aria-modal="true"
            aria-label="Search products"
            initial={ok ? { y: '-100%', opacity: 0 } : { opacity: 0 }}
            animate={ok ? { y: 0, opacity: 1 } : { opacity: 1 }}
            exit={ok ? { y: '-100%', opacity: 0 } : { opacity: 0 }}
            transition={{ duration: ok ? 0.4 : 0.16, ease: EASE }}
          >
            <div className="container search-overlay-inner">
              <form className="search-bar" role="search" onSubmit={onSubmit}>
                <span className="search-bar-icon" aria-hidden="true">
                  <SearchIcon size={20} />
                </span>
                <input
                  className="search-overlay-input"
                  type="search"
                  autoComplete="off"
                  placeholder="Search for a weave, a colour, an occasion…"
                  aria-label="Search products"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onInputKeyDown}
                />
                <button type="submit" className="btn btn-primary btn-sm search-bar-submit">
                  Search
                </button>
                <button
                  type="button"
                  className="icon-btn search-bar-close"
                  aria-label="Close search"
                  onClick={closeNav}
                >
                  <CloseIcon />
                </button>
              </form>

              <div className="search-panes">
                <section className="search-pane search-pane--results" aria-label="Product suggestions">
                  <h2 className="search-pane-title">
                    {term.length >= MIN_QUERY ? 'Suggestions' : 'Start typing'}
                  </h2>
                  <div aria-live="polite" aria-busy={isFetching}>
                    {term.length < MIN_QUERY ? (
                      <p className="muted search-hint">
                        Type at least {MIN_QUERY} characters to see matching pieces.
                      </p>
                    ) : isFetching && suggestions.length === 0 ? (
                      <ul className="search-results">
                        {[0, 1, 2].map((i) => (
                          <li key={i} className="search-result-skeleton">
                            <span className="skeleton" style={{ width: 48, height: 60 }} />
                            <span className="skeleton" style={{ flex: 1, height: 16 }} />
                          </li>
                        ))}
                      </ul>
                    ) : suggestions.length === 0 ? (
                      <p className="muted search-hint">
                        Nothing matches “{term}” yet — try a different word.
                      </p>
                    ) : (
                      <ul className="search-results">
                        {suggestions.map((product) => (
                          <li key={product.id}>
                            <Link
                              to={`/p/${product.slug}`}
                              className="search-result"
                              onClick={() => {
                                setRecent(pushRecentSearch(term));
                                closeNav();
                              }}
                            >
                              <ProductImage
                                src={product.thumbnailUrl}
                                alt=""
                                name={product.name}
                                className="search-result-media"
                                art
                                showLabel={false}
                                decorative
                                category={product.categorySlug}
                                seed={product.slug}
                              />
                              <span className="search-result-body">
                                <span className="search-result-name">{product.name}</span>
                                <span className="price search-result-price">
                                  {formatPaise(product.minDiscountPriceInPaise ?? product.minPriceInPaise)}
                                </span>
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {term.length >= MIN_QUERY && suggestions.length > 0 && (
                    <button type="button" className="search-see-all" onClick={() => runSearch(term)}>
                      See all results for “{term}”
                      <span aria-hidden="true"> →</span>
                    </button>
                  )}
                </section>

                <aside className="search-pane search-pane--side">
                  {recent.length > 0 && (
                    <section aria-label="Recent searches" className="search-block">
                      <div className="search-block-head">
                        <h2 className="search-pane-title">Recent</h2>
                        <button
                          type="button"
                          className="search-clear"
                          onClick={() => setRecent(clearRecentSearches())}
                        >
                          Clear
                        </button>
                      </div>
                      <ul className="search-recents">
                        {recent.map((item) => (
                          <li key={item}>
                            <button type="button" className="search-recent" onClick={() => runSearch(item)}>
                              <ClockIcon size={15} />
                              <span>{item}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {categories.length > 0 && (
                    <section aria-label="Browse categories" className="search-block">
                      <h2 className="search-pane-title">Browse</h2>
                      <div className="search-chips">
                        {categories.slice(0, 10).map((category) => (
                          <Link
                            key={category.id}
                            to={categoryPath(category)}
                            className="chip search-chip"
                            onClick={closeNav}
                          >
                            {category.name}
                          </Link>
                        ))}
                      </div>
                    </section>
                  )}
                </aside>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
