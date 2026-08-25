/**
 * SEO audit — checks the live site the way a crawler would.
 *
 * Run against a running API:  npx tsx scripts/seo-audit.ts [baseUrl]
 * Exits non-zero if any check fails, so it can gate a deploy.
 */
const BASE = process.argv[2] ?? process.env.SEO_AUDIT_URL ?? 'http://localhost:4100';

interface Result { name: string; ok: boolean; detail?: string }
const results: Result[] = [];
const check = (name: string, ok: boolean, detail?: string) => results.push({ name, ok, detail });

async function json(path: string) {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, body: res.ok ? await res.json() : null };
}
async function text(path: string) {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, body: await res.text() };
}
async function head(path: string) {
  const res = await fetch(`${BASE}/api/v1/seo/head?path=${encodeURIComponent(path)}`);
  return { status: res.status, seo: res.ok ? (await res.json()).data.seo : null };
}

(async () => {
  // --- robots -------------------------------------------------------------
  const robots = await text('/robots.txt');
  check('robots.txt returns 200', robots.status === 200);
  check('robots.txt references the sitemap', robots.body.includes('Sitemap:'));
  check('robots.txt blocks /admin', robots.body.includes('Disallow: /admin'));
  check('robots.txt blocks /checkout', robots.body.includes('Disallow: /checkout'));

  // --- sitemap ------------------------------------------------------------
  const index = await text('/sitemap.xml');
  check('sitemap index returns 200', index.status === 200);
  const parts = [...index.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1] ?? '');
  check('sitemap index lists children', parts.length > 0, `${parts.length} parts`);

  let urls: string[] = [];
  for (const part of parts) {
    const child = await text(new URL(part).pathname);
    urls.push(...[...child.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1] ?? ''));
  }
  check('sitemap contains URLs', urls.length > 0, `${urls.length} URLs`);
  check('no localhost URLs in sitemap', !urls.some((u) => u.includes('localhost')) || BASE.includes('localhost'));
  check('no duplicate sitemap URLs', new Set(urls).size === urls.length);
  for (const bad of ['/cart', '/checkout', '/account', '/login', '/search']) {
    check(`sitemap excludes ${bad}`, !urls.some((u) => new URL(u).pathname.startsWith(bad)));
  }

  // --- per-page metadata --------------------------------------------------
  const home = await head('/');
  check('home has a title', Boolean(home.seo?.title));
  check('home has a description', Boolean(home.seo?.description));
  check('home is indexable', home.seo?.robots === 'index,follow');
  const graph = (home.seo?.jsonLd ?? []) as { '@type': string }[];
  check('home has Organization schema', graph.some((g) => g['@type'] === 'Organization'));
  check('home has WebSite schema', graph.some((g) => g['@type'] === 'WebSite'));

  const sample = urls.find((u) => new URL(u).pathname.startsWith('/p/'));
  if (sample) {
    const product = await head(new URL(sample).pathname);
    const pg = (product.seo?.jsonLd ?? []) as Record<string, unknown>[];
    const schema = pg.find((g) => g['@type'] === 'Product') as Record<string, unknown> | undefined;
    check('product has a title', Boolean(product.seo?.title));
    check('product has a description', Boolean(product.seo?.description));
    check('product has a canonical', Boolean(product.seo?.canonical));
    check('product canonical is not localhost', !product.seo?.canonical.includes('localhost') || BASE.includes('localhost'));
    check('product is indexable', product.seo?.robots === 'index,follow');
    check('product has Product schema', Boolean(schema));
    check('product has BreadcrumbList', pg.some((g) => g['@type'] === 'BreadcrumbList'));
    check('product has an OG image', Boolean(product.seo?.ogImage));
    check('product og:type is product', product.seo?.ogType === 'product');
    const offers = schema?.offers as Record<string, unknown> | undefined;
    check('offer has a price', Boolean(offers?.price));
    check('offer availability is a schema.org URL', String(offers?.availability ?? '').startsWith('https://schema.org/'));
    // Ratings must never be invented.
    const rating = schema?.aggregateRating as Record<string, unknown> | undefined;
    check('no fabricated rating', !rating || Number(rating.reviewCount ?? 0) > 0);
  } else {
    check('a product URL exists to audit', false);
  }

  const category = urls.find((u) => new URL(u).pathname.startsWith('/c/'));
  if (category) {
    const cat = await head(new URL(category).pathname);
    check('category has a title', Boolean(cat.seo?.title));
    check('category has a canonical', Boolean(cat.seo?.canonical));
    check('category is indexable', cat.seo?.robots === 'index,follow');
  }

  // --- noindex + 404 ------------------------------------------------------
  for (const path of ['/cart', '/checkout', '/account/orders', '/search']) {
    const page = await head(path);
    check(`${path} is noindex`, page.seo?.robots?.startsWith('noindex') === true);
  }
  const missing = await json('/api/v1/seo/head?path=/p/definitely-not-a-real-product');
  check('unknown product 404s', missing.status === 404);

  // --- report -------------------------------------------------------------
  const failed = results.filter((r) => !r.ok);
  for (const r of results) {
    console.log(`${r.ok ? '  PASS' : '  FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length === 0 ? 0 : 1);
})().catch((err) => {
  console.error('audit failed to run:', err);
  process.exit(1);
});
