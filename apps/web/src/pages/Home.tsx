/**
 * Home — a merchandising surface.
 *
 * The page renders whatever `GET /catalog/home` gives it: an ordered list of
 * CMS sections, one component per section type (docs/marketplace-redesign.md
 * §1). Unknown section types render nothing. While the request is in flight a
 * warm skeleton holds the layout, and if the endpoint is missing, errors, or
 * comes back empty, the hand-built Atelier sections render instead — the page
 * is never blank.
 */
import { usePageMeta } from '../lib/usePageMeta';
import { organizationSchema, webSiteSchema } from '../lib/seo';
import { useHomeSections } from '../lib/home';
import { HomeSection, HomeSkeleton } from '../components/home/HomeSections';
import { HomeFallback } from '../components/home/HomeFallback';
import { JsonLd } from '../components/ui';
import '../styles/home.css';

/**
 * Site-wide entity markup. It lives on the home page because that is the URL
 * Google treats as the site's root entity — repeating it on every route would
 * only add bytes.
 */
function HomeSchema() {
  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={webSiteSchema()} />
    </>
  );
}

export default function Home() {
  usePageMeta(
    undefined,
    'Premium sarees, dresses, tops, bottomwear and antique imitation jewellery. Free delivery over ₹999. Dealing in textiles since 1992.',
  );

  const { data, isPending, isError } = useHomeSections();
  const sections = Array.isArray(data) ? [...data].sort((a, b) => a.sortOrder - b.sortOrder) : [];

  if (isPending) {
    return (
      <div className="home">
        <HomeSchema />
        <HomeSkeleton />
      </div>
    );
  }

  if (isError || sections.length === 0) {
    return (
      <div className="home">
        <HomeSchema />
        <HomeFallback />
      </div>
    );
  }

  return (
    <div className="home home--cms">
      <HomeSchema />
      {sections.map((section) => (
        <HomeSection key={section.id} section={section} />
      ))}
    </div>
  );
}
