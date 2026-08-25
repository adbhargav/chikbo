import type { HomeSectionDto } from '../../lib/home';
import { configString } from '../../lib/home';
import { ProductCarousel } from '../ProductCarousel';
import { HeroCarousel } from './HeroCarousel';
import { CategoryRail } from './CategoryRail';
import { CategoryCards } from './CategoryCards';
import { BannerGrid } from './BannerGrid';
import { EditorialStrip } from './EditorialStrip';

function ProductCarouselSection({ section }: { section: HomeSectionDto }) {
  const products = Array.isArray(section.products) ? section.products : [];
  const categorySlug = configString(section.config, 'categorySlug');
  const viewAllHref =
    configString(section.config, 'href') ?? (categorySlug ? `/c/${categorySlug}` : null);
  return (
    <ProductCarousel
      title={section.title}
      subtitle={section.subtitle}
      products={products}
      viewAllHref={viewAllHref}
      headingId={`home-${section.id}`}
    />
  );
}

/** Renders one CMS section. Unknown types render nothing. */
export function HomeSection({ section }: { section: HomeSectionDto }) {
  switch (section.type) {
    case 'HERO_CAROUSEL':
      return <HeroCarousel section={section} />;
    case 'CATEGORY_RAIL':
      return <CategoryRail section={section} />;
    case 'CATEGORY_CARDS':
      return <CategoryCards section={section} />;
    case 'BANNER_GRID':
      return <BannerGrid section={section} />;
    case 'PRODUCT_CAROUSEL':
      return <ProductCarouselSection section={section} />;
    case 'EDITORIAL':
      return <EditorialStrip section={section} />;
    default:
      return null;
  }
}

/** Warm skeleton shown while `GET /catalog/home` is in flight. */
export function HomeSkeleton() {
  return (
    <div className="home-skeleton" aria-busy="true" aria-label="Loading the storefront">
      <div className="skeleton home-skeleton-hero" />
      <div className="container">
        <div className="home-skeleton-chips">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="home-skeleton-chip">
              <div className="skeleton home-skeleton-circle" />
              <div className="skeleton" style={{ height: 10, width: 62, marginTop: 10 }} />
            </div>
          ))}
        </div>
        <div className="skeleton" style={{ height: 22, width: 220, margin: '48px 0 20px' }} />
        <div className="home-skeleton-row">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="skeleton" style={{ aspectRatio: '3 / 4', borderRadius: 12 }} />
              <div className="skeleton" style={{ height: 12, width: '70%', marginTop: 12 }} />
              <div className="skeleton" style={{ height: 12, width: '45%', marginTop: 8 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
