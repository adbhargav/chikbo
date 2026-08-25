import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CategoryDto } from '@chikbo/shared';
import { useCategories } from '../lib/queries';
import { usePageMeta } from '../lib/usePageMeta';
import { absoluteUrl, canonicalFor, collectionPageSchema } from '../lib/seo';
import { ProductListing } from '../components/ProductListing';
import { Breadcrumbs, JsonLd } from '../components/ui';
import '../styles/listing.css';

interface Found {
  category: CategoryDto;
  parent: CategoryDto | null;
}

function findCategory(categories: CategoryDto[], slug: string): Found | null {
  for (const cat of categories) {
    if (cat.slug === slug) return { category: cat, parent: null };
    for (const child of cat.children ?? []) {
      if (child.slug === slug) return { category: child, parent: cat };
    }
  }
  return null;
}

export default function Category() {
  const { slug = '' } = useParams();
  const { data: categories } = useCategories();

  const found = useMemo(
    () => (categories ? findCategory(categories, slug) : null),
    [categories, slug],
  );

  const title = found?.category.name ?? 'Collection';
  const description = `Shop ${title} at Chikbo — premium quality, budget friendly, free delivery over ₹999.`;
  usePageMeta(title, description, {
    ogImage: found?.category.imageUrl ?? null,
  });

  const chips = found ? (found.parent ? (found.parent.children ?? []) : (found.category.children ?? [])) : [];
  const parentForChips = found?.parent ?? found?.category;

  // One array feeds both the visible trail and the BreadcrumbList schema.
  const crumbs = [
    { label: 'Home', to: '/' },
    ...(found?.parent ? [{ label: found.parent.name, to: `/c/${found.parent.slug}` }] : []),
    { label: title },
  ];

  const canonical = canonicalFor(`/c/${slug}`);
  const subCollections = (found?.category.children ?? []).flatMap((child) => {
    const url = absoluteUrl(`/c/${child.slug}`);
    return url ? [{ name: child.name, url }] : [];
  });

  return (
    <div className="container page">
      <JsonLd
        data={collectionPageSchema({ name: title, description, url: canonical, subCollections })}
      />
      <header className="listing-header">
        <Breadcrumbs items={crumbs} />
        {chips.length > 0 && parentForChips && (
          <nav className="subcat-chips" aria-label="Subcategories">
            <Link
              to={`/c/${parentForChips.slug}`}
              className={`chip chip--brand${slug === parentForChips.slug ? ' chip--active' : ''}`}
              title={`All ${parentForChips.name} at Chikbo`}
            >
              All {parentForChips.name}
            </Link>
            {chips.map((child) => (
              <Link
                key={child.id}
                to={`/c/${child.slug}`}
                className={`chip chip--brand${child.slug === slug ? ' chip--active' : ''}`}
                title={`Shop ${child.name}`}
              >
                {child.name}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <ProductListing
        category={slug}
        title={title}
        emptyTitle={`No ${title.toLowerCase()} match these filters`}
      />
    </div>
  );
}
