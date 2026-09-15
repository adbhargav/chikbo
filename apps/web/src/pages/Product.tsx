import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useMotionValue, useSpring } from 'framer-motion';
import type { CategoryDto, ProductDetailDto, VariantDto } from '@chikbo/shared';
import { formatPaise } from '@chikbo/shared';
import { api, ApiError } from '../lib/api';
import {
  useCategories,
  useProduct,
  useProducts,
  useReviews,
  useCartMutations,
  useWishlist,
  useWishlistMutations,
} from '../lib/queries';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { useCartUi } from '../lib/cart-ui';
import { swatchFor } from '../lib/colors';
import { usePageMeta } from '../lib/usePageMeta';
import { absoluteUrl, canonicalFor, clampText, productSchema } from '../lib/seo';
import { assetUrl, formatDate, percentOff } from '../lib/format';
import { humanizeSlug, productBadge } from '../lib/catalog';
import { EASE, Magnetic, Reveal, useMotionOK } from '../lib/motion';
import { ProductImage } from '../components/ProductImage';
import { HeartBurst } from '../components/ProductCard';
import { ProductCarousel } from '../components/ProductCarousel';
import { PincodeChecker } from '../components/PincodeChecker';
import { AccordionItem } from '../components/Accordion';
import { RatingStars } from '../components/RatingStars';
import { Breadcrumbs, ErrorState, JsonLd, Pagination, QtyStepper } from '../components/ui';
import { CheckIcon, HeartIcon, LockIcon, ShareIcon, ShieldIcon, TruckIcon } from '../components/icons';
import '../styles/product.css';

function uniq(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => v !== null))];
}

function variantPrice(v: VariantDto): number {
  return v.discountPriceInPaise ?? v.priceInPaise;
}

/** Attribute keys that belong under "Fabric & care" rather than "Product details". */
const CARE_KEY = /fabric|care|wash|material|weave|blouse|lining|thread|finish/i;

interface CategoryPath {
  parent: CategoryDto | null;
  category: CategoryDto | null;
}

/**
 * Locate a category and its parent in the (already-cached) category tree.
 * Drives the breadcrumb trail, the internal links and the "Similar products"
 * scope from one lookup — no extra network request.
 */
function categoryPath(categories: CategoryDto[] | undefined, slug: string): CategoryPath {
  for (const cat of categories ?? []) {
    if (cat.slug === slug) return { parent: null, category: cat };
    for (const child of cat.children ?? []) {
      if (child.slug === slug) return { parent: cat, category: child };
    }
  }
  return { parent: null, category: null };
}

/* ---------------------------------------------------- Similar products */

function SimilarProducts({ product, scope }: { product: ProductDetailDto; scope: string }) {
  // Leaf categories are often a single product deep, so the caller widens the
  // scope to the family (the parent, which the API resolves inclusive of its
  // children). Every card in the rail is a real <a href> — see ProductCard.
  const similar = useProducts({ category: scope, pageSize: 12, page: 1 });
  const items = (similar.data?.items ?? []).filter((p) => p.id !== product.id).slice(0, 10);
  if (!similar.isPending && items.length === 0) return null;
  return (
    <ProductCarousel
      title="Similar Products"
      subtitle="More from this edit"
      products={items}
      loading={similar.isPending}
      viewAllHref={`/c/${scope}`}
      headingId="similar-products"
    />
  );
}

/* ------------------------------------------------------------- Reviews */

function ReviewsSection({ product }: { product: ProductDetailDto }) {
  const [page, setPage] = useState(1);
  const reviews = useReviews(product.slug, page);
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api('/reviews', {
        method: 'POST',
        body: {
          productId: product.id,
          rating,
          title: title.trim() || undefined,
          body: body.trim() || undefined,
        },
      });
      toast.show('Thank you — your review is live.', 'success');
      setFormOpen(false);
      setTitle('');
      setBody('');
      await queryClient.invalidateQueries({ queryKey: ['reviews', product.slug] });
      await queryClient.invalidateQueries({ queryKey: ['product', product.slug] });
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : 'Could not submit your review.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="reviews" aria-labelledby="reviews-title">
      <Reveal>
        <div className="section-head">
          <div>
            <span className="overline">What customers say</span>
            <h2 id="reviews-title">Reviews</h2>
          </div>
          {user ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFormOpen((o) => !o)}>
              {formOpen ? 'Close' : 'Write a review'}
            </button>
          ) : (
            <Link to="/login" className="section-link">
              Sign in to review
            </Link>
          )}
        </div>
      </Reveal>

      {formOpen && user && (
        <form className="review-form card card-pad" onSubmit={submit}>
          <fieldset className="rating-input">
            <legend>Your rating</legend>
            <div>
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`rating-star${value <= rating ? ' rating-star--on' : ''}`}
                  aria-label={`${value} star${value === 1 ? '' : 's'}`}
                  aria-pressed={value === rating}
                  onClick={() => setRating(value)}
                >
                  ★
                </button>
              ))}
            </div>
          </fieldset>
          <div className="field">
            <label htmlFor="review-title">Title (optional)</label>
            <input
              id="review-title"
              className="input"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Loved the fabric"
            />
          </div>
          <div className="field">
            <label htmlFor="review-body">Review (optional)</label>
            <textarea
              id="review-body"
              className="textarea"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="How was the quality, fit and colour?"
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit review'}
          </button>
        </form>
      )}

      {reviews.isPending && (
        <div className="review-list">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton" style={{ height: 90 }} />
          ))}
        </div>
      )}
      {reviews.isError && <ErrorState onRetry={() => reviews.refetch()} />}
      {reviews.data && reviews.data.items.length === 0 && (
        <p className="muted">No reviews yet — be the first to share your thoughts.</p>
      )}
      {reviews.data && reviews.data.items.length > 0 && (
        <>
          <ul className="review-list">
            {reviews.data.items.map((review, i) => (
              <motion.li
                key={review.id}
                className="review-item"
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px 0px' }}
                transition={{ duration: 0.5, delay: i * 0.06, ease: EASE }}
              >
                <div className="review-item-head">
                  <RatingStars rating={review.rating} showCount={false} size={14} />
                  <span className="review-author">{review.authorName}</span>
                  {review.verifiedPurchase && <span className="pill pill--success">Verified purchase</span>}
                  <span className="muted review-date">{formatDate(review.createdAt)}</span>
                </div>
                {review.title && <h3>{review.title}</h3>}
                {review.body && <p>{review.body}</p>}
              </motion.li>
            ))}
          </ul>
          <Pagination page={page} totalPages={reviews.data.totalPages} onPage={setPage} />
        </>
      )}
    </section>
  );
}

/* -------------------------------------------------------------- Product */

export default function Product() {
  const { slug } = useParams();
  const { data: product, isPending, isError, refetch } = useProduct(slug);
  // Already in the query cache — Layout fetches it for the header nav.
  const { data: categories } = useCategories();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { addItem } = useCartMutations();
  const { data: wishlist } = useWishlist();
  const wishlistMutations = useWishlistMutations();
  const cartUi = useCartUi();
  const ok = useMotionOK();

  const [imageIndex, setImageIndex] = useState(0);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const addedTimer = useRef<number | null>(null);

  // Parallax-tilt on the gallery (≤3°, mouse only).
  const rxRaw = useMotionValue(0);
  const ryRaw = useMotionValue(0);
  const rx = useSpring(rxRaw, { stiffness: 160, damping: 18 });
  const ry = useSpring(ryRaw, { stiffness: 160, damping: 18 });

  const activeVariants = useMemo(
    () => (product?.variants ?? []).filter((v) => v.isActive),
    [product],
  );
  const sizes = useMemo(() => uniq(activeVariants.map((v) => v.size)), [activeVariants]);
  const colors = useMemo(() => uniq(activeVariants.map((v) => v.color)), [activeVariants]);

  // Default selection: first in-stock variant (else first variant).
  useEffect(() => {
    if (!product) return;
    const preferred = activeVariants.find((v) => v.inStock) ?? activeVariants[0];
    setSize(preferred?.size ?? null);
    setColor(preferred?.color ?? null);
    setQty(1);
    setImageIndex(0);
  }, [product, activeVariants]);

  useEffect(
    () => () => {
      if (addedTimer.current !== null) window.clearTimeout(addedTimer.current);
    },
    [],
  );

  const matches = (v: VariantDto, s: string | null, c: string | null) =>
    (sizes.length === 0 || v.size === s) && (colors.length === 0 || v.color === c);

  const selected = activeVariants.find((v) => matches(v, size, color)) ?? null;

  const sizeAvailable = (s: string) =>
    activeVariants.some((v) => v.size === s && (colors.length === 0 || color === null || v.color === color) && v.inStock);
  const colorAvailable = (c: string) =>
    activeVariants.some((v) => v.color === c && (sizes.length === 0 || size === null || v.size === size) && v.inStock);

  // Sorted here (not after the loading guards) so the social card image is
  // available to usePageMeta on the very first committed render.
  const sortedImages = useMemo(
    () => [...(product?.images ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [product],
  );

  usePageMeta(product?.name, product ? clampText(product.description, 155) : undefined, {
    ogImage: sortedImages[0]?.url ?? null,
    ogType: 'product',
  });

  useEffect(() => {
    if (selected) setQty((q) => Math.min(q, Math.max(1, Math.min(10, selected.stockQty))));
  }, [selected]);

  if (isPending) {
    return (
      <div className="container page product-page" aria-busy="true">
        <div className="product-layout">
          <div className="skeleton" style={{ aspectRatio: '3 / 4', borderRadius: 12 }} />
          <div>
            <div className="skeleton" style={{ height: 36, width: '75%' }} />
            <div className="skeleton" style={{ height: 22, width: '35%', marginTop: 16 }} />
            <div className="skeleton" style={{ height: 120, marginTop: 32 }} />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="container page">
        <ErrorState message="We could not find this product." onRetry={() => refetch()} />
      </div>
    );
  }

  const images = sortedImages;
  const mainImage = images[imageIndex] ?? images[0] ?? null;
  const price = selected ? variantPrice(selected) : (product.minDiscountPriceInPaise ?? product.minPriceInPaise);
  const mrp = selected
    ? selected.discountPriceInPaise !== null
      ? selected.priceInPaise
      : null
    : product.minDiscountPriceInPaise !== null
      ? product.minPriceInPaise
      : null;
  const off = mrp !== null ? percentOff(mrp, price) : 0;
  const maxQty = selected ? Math.max(1, Math.min(10, selected.stockQty)) : 1;
  const inWishlist = (wishlist ?? []).some((p) => p.id === product.id);
  const canBuy = !!selected && selected.inStock;
  const badge = productBadge(product);
  const attributes = product.attributes ?? {};
  const careEntries = Object.entries(attributes).filter(([key]) => CARE_KEY.test(key));
  const detailEntries = Object.entries(attributes).filter(([key]) => !CARE_KEY.test(key));

  /* ---------------------------------------------------------------- SEO */

  const { parent, category } = categoryPath(categories, product.categorySlug);
  const categoryName = category?.name ?? humanizeSlug(product.categorySlug);
  // "Similar products" widens to the family; the API resolves a parent
  // inclusive of its children.
  const similarScope = parent?.slug ?? product.categorySlug;

  // ONE array — the visible trail below and the BreadcrumbList emitted by
  // <Breadcrumbs> are the same data, so they cannot disagree.
  const crumbs = [
    { label: 'Home', to: '/' },
    ...(parent ? [{ label: parent.name, to: `/c/${parent.slug}` }] : []),
    { label: categoryName, to: `/c/${product.categorySlug}` },
    { label: product.name },
  ];

  // The variant the shopper is actually looking at drives sku and stock; with
  // no variant selected we fall back to the first active one. Availability is
  // never assumed — it reads real stock.
  const schemaVariant = selected ?? activeVariants[0] ?? null;
  const schemaInStock = schemaVariant ? schemaVariant.stockQty > 0 : product.inStock;
  const schemaImages = images.flatMap((img) => {
    const url = absoluteUrl(assetUrl(img.url) ?? img.url);
    return url ? [url] : [];
  });

  const requireAuth = (): boolean => {
    if (user) return true;
    toast.show('Sign in to continue.', 'info');
    navigate('/login', { state: { from: location.pathname } });
    return false;
  };

  const addToCart = () => {
    if (!selected) return;
    addItem.mutate(
      { variantId: selected.id, qty },
      {
        onSuccess: () => {
          toast.show(`Added to bag — ${product.name}`, 'success');
          cartUi.notifyAdded();
          setJustAdded(true);
          if (addedTimer.current !== null) window.clearTimeout(addedTimer.current);
          addedTimer.current = window.setTimeout(() => setJustAdded(false), 1800);
        },
        onError: (err) =>
          toast.show(err instanceof ApiError ? err.message : 'Could not add to bag.', 'error'),
      },
    );
  };

  const shareProduct = async () => {
    const url = canonicalFor(`/p/${product.slug}`);
    const priceVariant = selected ?? activeVariants[0] ?? null;
    const priceLine = priceVariant ? ` at ${formatPaise(variantPrice(priceVariant))}` : '';
    const text = `${product.name}${priceLine} — Chikbo`;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: product.name, text, url });
        return;
      } catch (err) {
        // User dismissed the sheet — nothing to report.
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.show('Link copied — share it with someone who would love this.', 'success');
    } catch {
      toast.show(url, 'info');
    }
  };

  const toggleWishlist = () => {
    if (!requireAuth()) return;
    const mutation = inWishlist ? wishlistMutations.remove : wishlistMutations.add;
    if (!inWishlist) setBurstKey((k) => k + 1);
    mutation.mutate(product.id, {
      onSuccess: () =>
        toast.show(inWishlist ? 'Removed from wishlist.' : 'Saved to your wishlist.', 'success'),
      onError: (err) =>
        toast.show(err instanceof ApiError ? err.message : 'Could not update wishlist.', 'error'),
    });
  };

  const onTilt = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!ok || e.pointerType !== 'mouse') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - rect.left) / rect.width - 0.5;
    const dy = (e.clientY - rect.top) / rect.height - 0.5;
    ryRaw.set(dx * 6);
    rxRaw.set(-dy * 6);
  };
  const resetTilt = () => {
    rxRaw.set(0);
    ryRaw.set(0);
  };

  return (
    <div className="container page product-page">
      <JsonLd
        data={productSchema({
          name: product.name,
          description: product.description,
          images: schemaImages,
          sku: schemaVariant?.sku ?? null,
          url: canonicalFor(`/p/${product.slug}`),
          priceInPaise: price,
          inStock: schemaInStock,
          ratingAvg: product.ratingAvg,
          ratingCount: product.ratingCount,
          category: categoryName,
        })}
      />

      <motion.div
        initial={{ opacity: 0, x: ok ? -14 : 0 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <Breadcrumbs items={crumbs} />
      </motion.div>

      <div className="product-layout">
        {/* ---- Gallery: vertical thumb strip beside the main image ---- */}
        <div className="gallery">
          {images.length > 1 && (
            <div className="gallery-thumbs" role="group" aria-label="Product images" data-lenis-prevent>
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  className={`gallery-thumb${i === imageIndex ? ' gallery-thumb--active' : ''}`}
                  aria-label={`View image ${i + 1} of ${images.length}`}
                  aria-pressed={i === imageIndex}
                  onClick={() => setImageIndex(i)}
                  onMouseEnter={() => setImageIndex(i)}
                >
                  <ProductImage
                    src={img.url}
                    alt={img.alt || `${product.name} — view ${i + 1}`}
                    name={product.name}
                    className="gallery-thumb-img"
                    /* Below the main image, and off-screen on mobile. */
                    loading="lazy"
                    art
                    category={product.categorySlug}
                    seed={`${product.slug}#${i}`}
                    showLabel={false}
                    decorative
                  />
                </button>
              ))}
            </div>
          )}
          <motion.div
            className="gallery-main"
            onPointerMove={onTilt}
            onPointerLeave={resetTilt}
            style={ok ? { rotateX: rx, rotateY: ry, transformPerspective: 900 } : undefined}
          >
            <AnimatePresence initial={false}>
              <motion.div
                key={imageIndex}
                className="gallery-slide"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              >
                <ProductImage
                  src={mainImage?.url ?? null}
                  alt={mainImage?.alt || `${product.name} — ${categoryName} from Chikbo`}
                  name={product.name}
                  className="gallery-main-img"
                  /* LCP element: fetch it ahead of everything else. */
                  loading="eager"
                  fetchPriority="high"
                  width={900}
                  height={1200}
                  art
                  category={product.categorySlug}
                  seed={`${product.slug}#${imageIndex}`}
                  showLabel={false}
                />
              </motion.div>
            </AnimatePresence>
            {badge && <span className="gallery-badge">{badge}</span>}
          </motion.div>
        </div>

        {/* ---- Buy box ---- */}
        <div className="buy-box">
          <div className="buy-head">
            <Link className="buy-cat" to={`/c/${product.categorySlug}`}>
              {categoryName}
            </Link>
            <button
              type="button"
              className="buy-share"
              onClick={shareProduct}
              aria-label={`Share ${product.name}`}
              title="Share this product"
            >
              <ShareIcon size={18} />
              <span>Share</span>
            </button>
          </div>
          <h1 className="buy-title">
            <span className="mask-line">
              <motion.span
                className="mask-line-inner"
                initial={{ y: ok ? '112%' : 0, opacity: ok ? 1 : 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
              >
                {product.name}
              </motion.span>
            </span>
          </h1>
          {product.ratingCount > 0 && (
            <div className="buy-rating">
              <RatingStars rating={product.ratingAvg} count={product.ratingCount} />
            </div>
          )}

          <div className="buy-price">
            <p className="pdp-price">
              <span className="pdp-price-now">{formatPaise(price)}</span>
              {off > 0 && <span className="pdp-price-off">{off}% Off</span>}
            </p>
            <p className="pdp-mrp">
              {mrp !== null && (
                <>
                  MRP <span className="pdp-mrp-value">{formatPaise(mrp)}</span>{' '}
                </>
              )}
              <span className="muted">Inclusive of all taxes</span>
            </p>
          </div>

          {selected && !selected.inStock && (
            <p className="alert alert-error">This variant is out of stock — try another combination.</p>
          )}
          {selected && selected.inStock && selected.stockQty <= 5 && (
            <p className="stock-note stock-note--urgent">Only {selected.stockQty} left</p>
          )}

          {sizes.length > 0 && (
            <fieldset className="variant-group">
              <legend>
                Size{size ? <span className="variant-selected"> — {size}</span> : null}
              </legend>
              <div className="filter-chips">
                {sizes.map((s) => (
                  <motion.button
                    key={s}
                    type="button"
                    className={`chip chip--brand${s === size ? ' chip--active' : ''}`}
                    aria-pressed={s === size}
                    disabled={!sizeAvailable(s)}
                    onClick={() => setSize(s)}
                    whileTap={ok ? { scale: 0.9 } : undefined}
                    animate={ok && s === size ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                  >
                    {s}
                  </motion.button>
                ))}
              </div>
            </fieldset>
          )}

          {colors.length > 0 && (
            <fieldset className="variant-group">
              <legend>
                Colour{color ? <span className="variant-selected"> — {color}</span> : null}
              </legend>
              <div className="swatches">
                {colors.map((c) => {
                  const swatch = swatchFor(c);
                  const available = colorAvailable(c);
                  return (
                    <motion.button
                      key={c}
                      type="button"
                      className={[
                        'swatch',
                        c === color ? 'swatch--active' : '',
                        swatch.light ? 'swatch--light' : '',
                        available ? '' : 'swatch--out',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      // The colour name is the accessible label — a fill alone
                      // is meaningless to a screen reader.
                      aria-label={available ? c : `${c} — out of stock`}
                      title={c}
                      aria-pressed={c === color}
                      disabled={!available}
                      onClick={() => setColor(c)}
                      whileTap={ok ? { scale: 0.9 } : undefined}
                      animate={ok && c === color ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                    >
                      <span className="swatch-fill" style={{ background: swatch.fill }} />
                    </motion.button>
                  );
                })}
              </div>
            </fieldset>
          )}

          <div className="buy-qty">
            <span className="buy-qty-label">Quantity</span>
            <QtyStepper value={qty} max={maxQty} onChange={setQty} disabled={!canBuy} />
          </div>

          <div className="buy-actions">
            <button
              type="button"
              className={`btn btn-secondary buy-wishlist${inWishlist ? ' buy-wishlist--on' : ''}`}
              aria-pressed={inWishlist}
              onClick={toggleWishlist}
            >
              <HeartIcon filled={inWishlist} size={18} />
              {inWishlist ? 'Wishlisted' : 'Add to Wishlist'}
              <HeartBurst burstKey={burstKey} />
            </button>
            <Magnetic className="buy-cta-wrap" range={12}>
              <button
                type="button"
                className={`btn btn-primary buy-cta${justAdded ? ' buy-cta--added' : ''}`}
                disabled={!canBuy || addItem.isPending}
                onClick={addToCart}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={justAdded ? 'added' : addItem.isPending ? 'adding' : 'idle'}
                    className="buy-cta-label"
                    initial={{ opacity: 0, y: ok ? 10 : 0 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: ok ? -10 : 0 }}
                    transition={{ duration: 0.2, ease: EASE }}
                  >
                    {justAdded ? (
                      <>
                        Added <CheckIcon size={16} />
                      </>
                    ) : addItem.isPending ? (
                      'Adding…'
                    ) : canBuy ? (
                      'Add to Bag'
                    ) : (
                      'Out of stock'
                    )}
                  </motion.span>
                </AnimatePresence>
              </button>
            </Magnetic>
          </div>

          <PincodeChecker />

          <ul className="trust-row">
            <li>
              <LockIcon size={20} />
              <span>Secure prepaid payment</span>
            </li>
            <li>
              <ShieldIcon size={20} />
              <span>7-day damage return</span>
            </li>
            <li>
              <TruckIcon size={20} />
              <span>Free delivery over {formatPaise(99_900)}</span>
            </li>
          </ul>

          <div className="accordion">
            <AccordionItem title="Product details" defaultOpen>
              <p style={{ whiteSpace: 'pre-line' }}>{product.description}</p>
              {detailEntries.length > 0 && (
                <table>
                  <tbody>
                    {detailEntries.map(([key, value]) => (
                      <tr key={key}>
                        <th scope="row">{key.replace(/[_-]/g, ' ')}</th>
                        <td>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </AccordionItem>
            {careEntries.length > 0 && (
              <AccordionItem title="Fabric & care">
                <table>
                  <tbody>
                    {careEntries.map(([key, value]) => (
                      <tr key={key}>
                        <th scope="row">{key.replace(/[_-]/g, ' ')}</th>
                        <td>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="muted">
                  Dry clean recommended for silks and zari. Wash darks separately, dry in shade.
                </p>
              </AccordionItem>
            )}
            <AccordionItem title="Return policy">
              <p>
                Dispatched in 1–2 business days. Free delivery on orders over ₹999, ₹79 otherwise.
                Returns accepted for genuine damage on delivered items within 7 days — raise a
                request with photos from your orders page and we collect it from your door.
              </p>
            </AccordionItem>
          </div>

          {/* Descriptive internal links up the category tree — crawlable
              context for this product, and a real way back for shoppers. */}
          <nav className="pdp-related" aria-label="Related collections">
            <span className="pdp-related-label">Browse more</span>
            <ul>
              <li>
                <Link to={`/c/${product.categorySlug}`}>Shop all {categoryName}</Link>
              </li>
              {parent && parent.slug !== product.categorySlug && (
                <li>
                  <Link to={`/c/${parent.slug}`}>Explore the full {parent.name} collection</Link>
                </li>
              )}
              <li>
                <Link to="/">Chikbo — premium Indian fashion since 1992</Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      <SimilarProducts product={product} scope={similarScope} />

      <ReviewsSection product={product} />
    </div>
  );
}
