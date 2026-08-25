import { Link } from 'react-router-dom';
import type { ProductListItemDto } from '@chikbo/shared';
import { Carousel } from './Carousel';
import { ProductCard, ProductCardSkeleton } from './ProductCard';

interface Props {
  title?: string | null;
  subtitle?: string | null;
  products: ProductListItemDto[];
  /** "View all" destination — omitted when the rail has no wider collection. */
  viewAllHref?: string | null;
  loading?: boolean;
  /** Heading level — h2 on the home page, h2 under the PDP too. */
  headingId?: string;
}

/**
 * Horizontal rail of product cards with arrows and scroll snap. Used by the
 * CMS `PRODUCT_CAROUSEL` sections and by "Similar products" on the PDP.
 */
export function ProductCarousel({
  title,
  subtitle,
  products,
  viewAllHref,
  loading = false,
  headingId,
}: Props) {
  if (!loading && products.length === 0) return null;
  const label = title?.trim() || 'Products';

  return (
    <section className="home-band" aria-labelledby={title ? headingId : undefined} aria-label={title ? undefined : label}>
      <div className="container">
        {(title || subtitle || viewAllHref) && (
          <div className="band-head">
            <div>
              {title && (
                <h2 id={headingId} className="band-title">
                  {title}
                </h2>
              )}
              {subtitle && <p className="band-sub">{subtitle}</p>}
            </div>
            {viewAllHref && (
              <Link to={viewAllHref} className="section-link">
                View all →
              </Link>
            )}
          </div>
        )}
        <Carousel ariaLabel={label} trackClassName="crsl-track--products">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div className="crsl-item" key={i}>
                  <ProductCardSkeleton />
                </div>
              ))
            : products.map((product) => (
                <div className="crsl-item" key={product.id}>
                  <ProductCard product={product} />
                </div>
              ))}
        </Carousel>
      </div>
    </section>
  );
}
