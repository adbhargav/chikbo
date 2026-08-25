import { useSearchParams } from 'react-router-dom';
import { usePageMeta } from '../lib/usePageMeta';
import { ProductListing } from '../components/ProductListing';
import { Breadcrumbs } from '../components/ui';
import '../styles/listing.css';

export default function Search() {
  const [searchParams] = useSearchParams();
  const q = (searchParams.get('q') ?? '').trim();
  usePageMeta(q ? `Search “${q}”` : 'Search', `Search results for ${q} at Chikbo.`);

  return (
    <div className="container page">
      <header className="listing-header">
        {/* noindex route — breadcrumb markup would never be shown. */}
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Search' }]} schema={false} />
      </header>
      <ProductListing
        search={q || undefined}
        title={q ? `Results for “${q}”` : 'All products'}
        emptyTitle={q ? `Nothing found for “${q}”` : 'Nothing here just yet'}
      />
    </div>
  );
}
