import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { ProductListItemDto } from '@chikbo/shared';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { useWishlist, useWishlistMutations } from '../lib/queries';
import { useMotionOK } from '../lib/motion';
import { humanizeSlug, listMrp, listPrice, productBadge } from '../lib/catalog';
import { ProductImage } from './ProductImage';
import { RatingStars } from './RatingStars';
import { PriceRow, offerNote } from './Price';
import { HeartIcon } from './icons';

/** Six tiny gold particles bursting from the heart when a product is saved. */
export function HeartBurst({ burstKey }: { burstKey: number }) {
  const ok = useMotionOK();
  if (!ok || burstKey === 0) return null;
  return (
    <AnimatePresence>
      <motion.span key={burstKey} className="heart-burst" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => {
          const angle = (i / 6) * Math.PI * 2;
          return (
            <motion.span
              key={i}
              className="heart-burst-dot"
              initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
              animate={{
                x: Math.cos(angle) * 22,
                y: Math.sin(angle) * 22,
                scale: 0,
                opacity: 0,
              }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
            />
          );
        })}
      </motion.span>
    </AnimatePresence>
  );
}

/**
 * The one product card used by the PLP grid, home carousels, wishlist and
 * "Similar products" — image on a light plate, wishlist heart top-right,
 * merchandising badge bottom-left, then category → name → price → offer note.
 */
export function ProductCard({ product }: { product: ProductListItemDto }) {
  const price = listPrice(product);
  const mrp = listMrp(product);
  const badge = productBadge(product);
  const note = offerNote(price, mrp);

  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: wishlist } = useWishlist();
  const wishlistMutations = useWishlistMutations();
  const [burstKey, setBurstKey] = useState(0);

  const inWishlist = (wishlist ?? []).some((p) => p.id === product.id);

  const toggleWishlist = () => {
    if (!user) {
      toast.show('Sign in to save to your wishlist.', 'info');
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    const mutation = inWishlist ? wishlistMutations.remove : wishlistMutations.add;
    if (!inWishlist) setBurstKey((k) => k + 1);
    mutation.mutate(product.id, {
      onSuccess: () =>
        toast.show(inWishlist ? 'Removed from wishlist.' : 'Saved to your wishlist.', 'success'),
      onError: (err) =>
        toast.show(err instanceof ApiError ? err.message : 'Could not update wishlist.', 'error'),
    });
  };

  return (
    <article className="product-card">
      <Link to={`/p/${product.slug}`} className="product-card-link">
        <div className="product-card-media">
          <ProductImage
            src={product.thumbnailUrl}
            alt={product.name}
            name={product.name}
            className="product-card-img"
            art
            category={product.categorySlug}
            seed={product.slug}
            showLabel={false}
            decorative
          />
          <span className="card-sheen" aria-hidden="true" />
          {badge && <span className="product-card-badge">{badge}</span>}
          {!product.inStock && <span className="product-card-oos">Out of stock</span>}
        </div>
        <div className="product-card-body">
          <span className="product-card-cat">{humanizeSlug(product.categorySlug)}</span>
          <h3 className="product-card-name">{product.name}</h3>
          <PriceRow priceInPaise={price} mrpInPaise={mrp} />
          {note && <span className="product-card-offer">{note}</span>}
          {product.ratingCount > 0 && (
            <span className="product-card-rating">
              <RatingStars rating={product.ratingAvg} count={product.ratingCount} size={12} />
            </span>
          )}
        </div>
      </Link>
      <button
        type="button"
        className={`card-heart${inWishlist ? ' card-heart--on' : ''}`}
        aria-label={
          inWishlist ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`
        }
        aria-pressed={inWishlist}
        onClick={toggleWishlist}
      >
        <HeartIcon size={16} filled={inWishlist} />
        <HeartBurst burstKey={burstKey} />
      </button>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="product-card" aria-hidden="true">
      <div className="product-card-media skeleton" />
      <div className="product-card-body">
        <div className="skeleton" style={{ height: 10, width: '40%' }} />
        <div className="skeleton" style={{ height: 14, width: '90%', marginTop: 8 }} />
        <div className="skeleton" style={{ height: 14, width: '55%', marginTop: 8 }} />
      </div>
    </div>
  );
}
