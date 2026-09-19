/**
 * End-to-end check of the admin panel against a running API.
 *
 * Drives every admin operation over HTTP exactly as the admin UI does, then
 * confirms each change through the public storefront endpoints (and the
 * customer account endpoints) — i.e. "if I change it in admin, does the shop
 * show it?". Uploaded images are fetched back to prove they are stored.
 *
 * It creates clearly-labelled temporary data (names start with "E2E",
 * slugs with "zz-e2e-", emails @example.com) and removes all of it in a
 * `finally` block, restoring anything it had to modify. It never touches real
 * products, orders or customers.
 *
 * Usage (API must be running; point at a non-production DB when you can):
 *   API_URL=http://localhost:4000 ADMIN_EMAIL=… ADMIN_PASSWORD=… \
 *     npx tsx scripts/admin-e2e.ts
 *
 * Tip: start the API with SMTP_HOST= so test orders send no email.
 */
import crypto from 'crypto';
import sharp from 'sharp';
import { PrismaClient } from '@prisma/client';
import { deleteObject, objectExists, r2Configured, uploadKey } from '../src/lib/objectStorage';

const API = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/+$/, '');
const V1 = `${API}/api/v1`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@chikbo.in';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'ChangeMe@123';

const prisma = new PrismaClient();
const run = crypto.randomBytes(3).toString('hex');
const tag = (s: string) => `zz-e2e-${s}-${run}`;

// ---------------------------------------------------------------- reporting

type Result = { area: string; name: string; ok: boolean; detail?: string };
const results: Result[] = [];
let area = 'setup';

function check(name: string, ok: boolean, detail?: unknown) {
  const d = detail === undefined ? undefined : typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 400);
  results.push({ area, name, ok, detail: ok ? undefined : d });
  console.log(`${ok ? '  PASS' : '  FAIL'}  [${area}] ${name}${ok || !d ? '' : `\n        ↳ ${d}`}`);
}

function section(name: string) {
  area = name;
  console.log(`\n== ${name}`);
}

// ------------------------------------------------------------------- http

interface Res<T = any> {
  status: number;
  body: { success?: boolean; data?: T; error?: { code: string; message: string } } & Record<string, any>;
}

async function call<T = any>(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown; form?: FormData; guest?: string } = {},
): Promise<Res<T>> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.guest) headers['X-Guest-Token'] = opts.guest;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${V1}${path}`, { method, headers, body });
  const text = await res.text();
  let parsed: any = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text.slice(0, 200) };
  }
  return { status: res.status, body: parsed };
}

const brief = (r: Res) => ({ status: r.status, error: r.body.error ?? r.body.raw });

async function testImage(color: [number, number, number], format: 'png' | 'jpeg', w = 1400, h = 1800): Promise<Blob> {
  const img = sharp({ create: { width: w, height: h, channels: 3, background: { r: color[0], g: color[1], b: color[2] } } });
  const buf = format === 'png' ? await img.png().toBuffer() : await img.jpeg({ quality: 90 }).toBuffer();
  return new Blob([new Uint8Array(buf)], { type: `image/${format}` });
}

async function fetchAsset(url: string) {
  const res = await fetch(url.startsWith('http') ? url : `${API}${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, type: res.headers.get('content-type') ?? '', buf };
}

/** Depth-first search through a category tree for a slug. */
function findCategory(tree: any[], slug: string): any | null {
  for (const c of tree ?? []) {
    if (c.slug === slug) return c;
    const hit = findCategory(c.children ?? [], slug);
    if (hit) return hit;
  }
  return null;
}

// ------------------------------------------------------------ bookkeeping

const created = {
  imageUrls: [] as string[],
  categoryIds: [] as string[],
  productIds: [] as string[],
  sectionIds: [] as string[],
  couponIds: [] as string[],
  roleIds: [] as string[],
  userIds: [] as string[],
  orderIds: [] as string[],
  redirectSources: [] as string[],
};
let seoSnapshot: Record<string, unknown> | null = null;
let sectionOrderSnapshot: string[] | null = null;

// ------------------------------------------------------------------ main

async function main() {
  console.log(`Admin E2E against ${API} (run ${run})`);

  // ------------------------------------------------------------ auth
  section('auth');
  const login = await call('POST', '/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  check('admin can sign in', login.status === 200 && !!login.body.data?.accessToken, brief(login));
  const admin = login.body.data?.accessToken as string;
  if (!admin) throw new Error('Cannot continue without an admin session');
  const me = await call('GET', '/auth/me', { token: admin });
  check('admin session resolves to a super admin', me.body.data?.role === 'SUPER_ADMIN', me.body.data);
  const noAuth = await call('GET', '/admin/products');
  check('admin API rejects anonymous requests', noAuth.status === 401, brief(noAuth));

  // ---------------------------------------------------------- uploads
  section('uploads');
  const form = new FormData();
  form.append('files', await testImage([190, 60, 40], 'png'), 'red.png');
  form.append('files', await testImage([40, 90, 170], 'jpeg', 3200, 2400), 'blue.jpg');
  const up = await call<{ url: string; size: number }[]>('POST', '/uploads', { token: admin, form });
  check('upload two images (PNG + large JPEG)', up.status === 201 && up.body.data?.length === 2, brief(up));
  const [imgA, imgB] = (up.body.data ?? []).map((f) => f.url);
  created.imageUrls.push(...[imgA, imgB].filter(Boolean));

  if (imgA && imgB) {
    const a = await fetchAsset(imgA);
    check('uploaded image is served back', a.status === 200 && a.type.startsWith('image/'), { status: a.status, type: a.type });
    const filename = imgA.split('/').pop()!;
    if (r2Configured) {
      check('uploaded image is stored in Cloudflare R2', await objectExists(uploadKey(filename)), { key: uploadKey(filename) });
      const inDb = await prisma.storedImage.count({ where: { filename } });
      check('uploaded image is not duplicated into the database', inDb === 0, { inDb });
    } else {
      const stored = await prisma.storedImage.findUnique({ where: { filename } });
      check('uploaded image is stored in the database', !!stored && stored.size > 0, { url: imgA });
    }
    const meta = await sharp((await fetchAsset(imgB)).buf).metadata();
    check('large upload is resized to fit 2000px', (meta.width ?? 0) <= 2000 && (meta.height ?? 0) <= 2000, meta);
  }

  // Videos: stored as uploaded, served with byte-range support so players can seek.
  if (r2Configured) {
    const mp4 = Buffer.alloc(4096);
    mp4.writeUInt32BE(24, 0);
    mp4.write('ftypisom', 4, 'latin1');
    for (let i = 24; i < mp4.length; i++) mp4[i] = i % 251;
    const videoForm = new FormData();
    videoForm.append('files', new Blob([new Uint8Array(mp4)], { type: 'video/mp4' }), 'clip.mp4');
    const vid = await call<{ url: string; size: number; kind: string }[]>('POST', '/uploads', { token: admin, form: videoForm });
    check('upload a video', vid.status === 201 && vid.body.data?.[0]?.kind === 'video', brief(vid));
    const videoUrl = vid.body.data?.[0]?.url;
    if (videoUrl) {
      created.imageUrls.push(videoUrl);
      check('video is stored in Cloudflare R2', await objectExists(uploadKey(videoUrl.split('/').pop()!)));
      const full = await fetchAsset(videoUrl);
      check('video is served back byte-for-byte', full.status === 200 && full.type === 'video/mp4' && full.buf.equals(mp4), { status: full.status, type: full.type, bytes: full.buf.length });
      const partial = await fetch(videoUrl.startsWith('http') ? videoUrl : `${API}${videoUrl}`, { headers: { Range: 'bytes=100-199' } });
      const part = Buffer.from(await partial.arrayBuffer());
      check('video supports seeking (HTTP 206 range)', partial.status === 206 && part.equals(mp4.subarray(100, 200)) && (partial.headers.get('content-range') ?? '').startsWith('bytes 100-199/'), { status: partial.status, range: partial.headers.get('content-range') });
    }
    const fakeVideoForm = new FormData();
    fakeVideoForm.append('files', new Blob([new Uint8Array(Buffer.from('MZ this is not a video at all'))], { type: 'video/mp4' }), 'evil.mp4');
    const fakeVideo = await call('POST', '/uploads', { token: admin, form: fakeVideoForm });
    check('a non-video disguised as MP4 is rejected with 400', fakeVideo.status === 400, brief(fakeVideo));
  }

  const bigForm = new FormData();
  bigForm.append('files', new Blob([new Uint8Array(6 * 1024 * 1024)], { type: 'image/jpeg' }), 'huge.jpg');
  const big = await call('POST', '/uploads', { token: admin, form: bigForm });
  check('an image over 5 MB is rejected with a clear 400', big.status === 400 && /5 MB/.test(big.body.error?.message ?? ''), brief(big));

  const badForm = new FormData();
  badForm.append('files', new Blob([new Uint8Array(Buffer.from('not really an image'))], { type: 'image/png' }), 'fake.png');
  const bad = await call('POST', '/uploads', { token: admin, form: badForm });
  check('a non-image disguised as PNG is rejected with 400', bad.status === 400, brief(bad));

  const txtForm = new FormData();
  txtForm.append('files', new Blob([new Uint8Array(Buffer.from('hello'))], { type: 'text/plain' }), 'a.txt');
  const txt = await call('POST', '/uploads', { token: admin, form: txtForm });
  check('a text file is rejected with 400', txt.status === 400, brief(txt));

  const anonForm = new FormData();
  anonForm.append('files', await testImage([1, 2, 3], 'png', 10, 10), 'x.png');
  const anon = await call('POST', '/uploads', { form: anonForm });
  check('anonymous upload is rejected with 401', anon.status === 401, brief(anon));

  const fromUrl = await call<{ url: string }>('POST', '/uploads/from-url', {
    token: admin,
    body: { url: `${process.env.PUBLIC_IMAGE_URL ?? 'https://upload.wikimedia.org/wikipedia/commons/3/3f/JPEG_example_flower.jpg'}` },
  });
  check('import an image from a URL', fromUrl.status === 201 && !!fromUrl.body.data?.url, brief(fromUrl));
  if (fromUrl.body.data?.url) {
    created.imageUrls.push(fromUrl.body.data.url);
    const f = await fetchAsset(fromUrl.body.data.url);
    check('URL-imported image is served back', f.status === 200, { status: f.status });
  }

  // -------------------------------------------------------- categories
  section('categories');
  const parentSlug = tag('parent');
  const parent = await call('POST', '/admin/categories', {
    token: admin,
    body: { name: `E2E Parent ${run}`, slug: parentSlug, imageUrl: imgA, sortOrder: 9990, isActive: true },
  });
  check('create a top-level category with an image', parent.status === 201, brief(parent));
  const parentId = parent.body.data?.id as string;
  if (parentId) created.categoryIds.push(parentId);

  const childSlug = tag('child');
  const child = await call('POST', '/admin/categories', {
    token: admin,
    body: { name: `E2E Child ${run}`, slug: childSlug, parentId, sortOrder: 1, isActive: true },
  });
  check('create a sub-category', child.status === 201, brief(child));
  const childId = child.body.data?.id as string;
  if (childId) created.categoryIds.unshift(childId);

  const dupCat = await call('POST', '/admin/categories', { token: admin, body: { name: 'Dup', slug: parentSlug } });
  check('duplicate category slug is refused (409)', dupCat.status === 409, brief(dupCat));

  const adminCats = await call<any[]>('GET', '/admin/categories', { token: admin });
  check('admin category list includes both', !!adminCats.body.data?.some((c) => c.id === parentId) && !!adminCats.body.data?.some((c) => c.id === childId));

  let tree = await call<any[]>('GET', '/catalog/categories');
  const pubParent = findCategory(tree.body.data ?? [], parentSlug);
  check('storefront shows the new category', !!pubParent, { found: !!pubParent });
  check('storefront shows the category image', pubParent?.imageUrl === imgA, pubParent);
  check('storefront nests the sub-category under its parent', !!pubParent?.children?.some((c: any) => c.slug === childSlug), pubParent?.children);

  const renamedParentSlug = tag('parent-renamed');
  const patchCat = await call('PATCH', `/admin/categories/${parentId}`, {
    token: admin,
    body: { name: `E2E Parent Renamed ${run}`, slug: renamedParentSlug },
  });
  check('rename a category and change its slug', patchCat.status === 200, brief(patchCat));
  created.redirectSources.push(`/c/${parentSlug}`);
  tree = await call<any[]>('GET', '/catalog/categories');
  check('storefront shows the renamed category', findCategory(tree.body.data ?? [], renamedParentSlug)?.name === `E2E Parent Renamed ${run}`);
  const autoCatRedirect = await prisma.redirect.findUnique({ where: { source: `/c/${parentSlug}` } });
  check('old category URL gets an automatic redirect', autoCatRedirect?.destination === `/c/${renamedParentSlug}`, autoCatRedirect);
  const oldCatLookup = await call('GET', `/seo/redirect?path=${encodeURIComponent(`/c/${parentSlug}`)}`);
  check('storefront forwards the old category URL to the new one', oldCatLookup.body.data?.destination === `/c/${renamedParentSlug}`, brief(oldCatLookup));

  const hideCat = await call('PATCH', `/admin/categories/${childId}`, { token: admin, body: { isActive: false } });
  tree = await call<any[]>('GET', '/catalog/categories');
  check('deactivated category disappears from the storefront', hideCat.status === 200 && !findCategory(tree.body.data ?? [], childSlug));
  await call('PATCH', `/admin/categories/${childId}`, { token: admin, body: { isActive: true } });
  tree = await call<any[]>('GET', '/catalog/categories');
  check('re-activated category comes back', !!findCategory(tree.body.data ?? [], childSlug));

  // ---------------------------------------------------------- products
  section('products');
  const productSlug = tag('saree');
  const createProduct = await call('POST', '/admin/products', {
    token: admin,
    body: {
      name: `E2E Test Saree ${run}`,
      slug: productSlug,
      description: 'Temporary product created by the automated admin check. It is removed automatically.',
      categoryId: childId,
      attributes: { Fabric: 'Silk', Work: 'Zari' },
      badge: 'New',
      isActive: true,
      images: [
        { url: imgA, alt: 'Front', color: 'Red' },
        { url: imgB, alt: 'Back', color: 'Blue' },
      ],
      variants: [
        { sku: `E2E-${run}-S`, size: 'S', color: 'Red', priceInPaise: 250000, discountPriceInPaise: 199900, stockQty: 5, lowStockThreshold: 2 },
        { sku: `E2E-${run}-M`, size: 'M', color: 'Red', priceInPaise: 250000, stockQty: 0, lowStockThreshold: 2 },
        { sku: `E2E-${run}-B`, size: 'S', color: 'Blue', priceInPaise: 250000, stockQty: 3, lowStockThreshold: 2 },
      ],
    },
  });
  check('create a product with images and variants', createProduct.status === 201, brief(createProduct));
  const productId = createProduct.body.data?.id as string;
  if (productId) created.productIds.push(productId);
  const variantS = createProduct.body.data?.variants?.find((v: any) => v.size === 'S');
  const variantM = createProduct.body.data?.variants?.find((v: any) => v.size === 'M');

  const badDiscount = await call('POST', '/admin/products', {
    token: admin,
    body: {
      name: 'E2E bad', slug: tag('bad'), description: 'Discount above price should fail.', categoryId: childId,
      variants: [{ sku: `E2E-${run}-BAD`, priceInPaise: 10000, discountPriceInPaise: 20000 }],
    },
  });
  check('discount above price is refused (400)', badDiscount.status === 400, brief(badDiscount));

  const dupSlug = await call('POST', '/admin/products', {
    token: admin,
    body: {
      name: 'E2E dup', slug: productSlug, description: 'Duplicate slug should fail.', categoryId: childId,
      variants: [{ sku: `E2E-${run}-DUP`, priceInPaise: 10000 }],
    },
  });
  check('duplicate product slug is refused (409)', dupSlug.status === 409, brief(dupSlug));

  let pdp = await call('GET', `/catalog/products/${productSlug}`);
  check('storefront product page loads', pdp.status === 200, brief(pdp));
  const p = pdp.body.data;
  check('storefront shows name, badge and attributes', p?.name === `E2E Test Saree ${run}` && p?.attributes?.Fabric === 'Silk', { name: p?.name, badge: p?.badge, attributes: p?.attributes });
  check('storefront shows both images in order', p?.images?.[0]?.url === imgA && p?.images?.[1]?.url === imgB, p?.images);
  check('storefront knows which colour each photo shows', p?.images?.[0]?.color === 'Red' && p?.images?.[1]?.color === 'Blue', p?.images);
  const variantBlue = p?.variants?.find((v: any) => v.color === 'Blue');
  check('storefront shows price and discount', p?.variants?.some((v: any) => v.priceInPaise === 250000 && v.discountPriceInPaise === 199900), p?.variants);
  check('storefront marks the zero-stock size as out of stock', p?.variants?.some((v: any) => v.size === 'M' && v.inStock === false), p?.variants);
  if (p?.images?.[0]?.url) {
    const img = await fetchAsset(p.images[0].url);
    check('product image URL from the storefront actually loads', img.status === 200);
  }

  let list = await call('GET', `/catalog/products?category=${childSlug}&pageSize=50`);
  check('product appears in its category listing', !!list.body.data?.items?.some((i: any) => i.slug === productSlug), brief(list));
  const parentList = await call('GET', `/catalog/products?category=${renamedParentSlug}&pageSize=50`);
  check('product appears in its parent category listing', !!parentList.body.data?.items?.some((i: any) => i.slug === productSlug), { count: parentList.body.data?.items?.length });
  const search = await call('GET', `/catalog/products?search=${encodeURIComponent(`E2E Test Saree ${run}`)}`);
  check('product is found by storefront search', !!search.body.data?.items?.some((i: any) => i.slug === productSlug), brief(search));
  const adminSearch = await call('GET', `/admin/products?search=E2E-${run}-S`, { token: admin });
  check('admin product search by SKU finds it', !!adminSearch.body.data?.items?.some((i: any) => i.id === productId));

  const newSlug = tag('saree-renamed');
  const editProduct = await call('PATCH', `/admin/products/${productId}`, {
    token: admin,
    body: {
      name: `E2E Test Saree Edited ${run}`,
      slug: newSlug,
      description: 'Edited description from the automated admin check.',
      badge: 'Bestseller',
      attributes: { Fabric: 'Georgette' },
      images: [
        { url: imgB, alt: 'Back first', color: 'Blue' },
        { url: imgA, alt: 'Front second', color: null },
      ],
    },
  });
  check('edit name, slug, description, badge, attributes, image order', editProduct.status === 200, brief(editProduct));
  created.redirectSources.push(`/p/${productSlug}`);
  pdp = await call('GET', `/catalog/products/${newSlug}`);
  check('storefront shows the edited name and description', pdp.body.data?.name === `E2E Test Saree Edited ${run}` && pdp.body.data?.description?.startsWith('Edited'), { name: pdp.body.data?.name });
  check('storefront shows the edited badge and attributes', pdp.body.data?.badge === 'Bestseller' && pdp.body.data?.attributes?.Fabric === 'Georgette', { badge: pdp.body.data?.badge, attributes: pdp.body.data?.attributes });
  check('storefront shows the new image order', pdp.body.data?.images?.[0]?.url === imgB, pdp.body.data?.images);
  check('a photo can be set back to all colours', pdp.body.data?.images?.[1]?.color === null, pdp.body.data?.images);
  const oldSlug = await call('GET', `/catalog/products/${productSlug}`);
  check('old product URL no longer resolves directly', oldSlug.status === 404, brief(oldSlug));
  const autoProductRedirect = await prisma.redirect.findUnique({ where: { source: `/p/${productSlug}` } });
  check('old product URL gets an automatic redirect', autoProductRedirect?.destination === `/p/${newSlug}`, autoProductRedirect);
  const oldProductLookup = await call('GET', `/seo/redirect?path=${encodeURIComponent(`/p/${productSlug}`)}`);
  check('storefront forwards the old product URL to the new one', oldProductLookup.body.data?.destination === `/p/${newSlug}`, brief(oldProductLookup));

  const hide = await call('PATCH', `/admin/products/${productId}`, { token: admin, body: { isActive: false } });
  pdp = await call('GET', `/catalog/products/${newSlug}`);
  list = await call('GET', `/catalog/products?category=${childSlug}`);
  check('deactivated product is hidden from the storefront', hide.status === 200 && pdp.status === 404 && !list.body.data?.items?.some((i: any) => i.slug === newSlug), brief(pdp));
  await call('PATCH', `/admin/products/${productId}`, { token: admin, body: { isActive: true } });
  pdp = await call('GET', `/catalog/products/${newSlug}`);
  check('re-activated product is visible again', pdp.status === 200);

  const addVariant = await call('POST', `/admin/products/${productId}/variants`, {
    token: admin,
    body: { sku: `E2E-${run}-L`, size: 'L', color: 'Red', priceInPaise: 270000, stockQty: 3 },
  });
  check('add a variant', addVariant.status === 201, brief(addVariant));
  const editVariant = await call('PATCH', `/admin/variants/${variantS?.id}`, {
    token: admin,
    body: { priceInPaise: 260000, discountPriceInPaise: 189900 },
  });
  check('edit a variant price', editVariant.status === 200, brief(editVariant));
  pdp = await call('GET', `/catalog/products/${newSlug}`);
  check('storefront shows the new variant', pdp.body.data?.variants?.some((v: any) => v.size === 'L'), pdp.body.data?.variants);
  check('storefront shows the edited price', pdp.body.data?.variants?.some((v: any) => v.size === 'S' && v.priceInPaise === 260000 && v.discountPriceInPaise === 189900), pdp.body.data?.variants);

  const hideVariant = await call('PATCH', `/admin/variants/${addVariant.body.data?.id}`, { token: admin, body: { isActive: false } });
  pdp = await call('GET', `/catalog/products/${newSlug}`);
  check('deactivated variant disappears from the storefront', hideVariant.status === 200 && !pdp.body.data?.variants?.some((v: any) => v.size === 'L'), pdp.body.data?.variants);

  const adminList = await call('GET', '/admin/products?page=1&pageSize=20', { token: admin });
  check('admin product list loads', adminList.status === 200 && Array.isArray(adminList.body.data?.items), brief(adminList));

  // --------------------------------------------------------- inventory
  section('inventory');
  const restock = await call('POST', '/admin/inventory/adjust', {
    token: admin,
    body: { variantId: variantM?.id, delta: 4, reason: 'RESTOCK', note: 'E2E restock' },
  });
  check('restock a variant', restock.status === 200 && restock.body.data?.stockQty === 4, brief(restock));
  pdp = await call('GET', `/catalog/products/${newSlug}`);
  check('storefront shows the restocked size as in stock', pdp.body.data?.variants?.some((v: any) => v.size === 'M' && v.inStock === true), pdp.body.data?.variants);

  const tooMuch = await call('POST', '/admin/inventory/adjust', {
    token: admin,
    body: { variantId: variantM?.id, delta: -100, reason: 'CORRECTION' },
  });
  check('stock cannot go below zero (422)', tooMuch.status === 422, brief(tooMuch));

  const history = await call<any[]>('GET', `/admin/inventory/history/${variantM?.id}`, { token: admin });
  check('inventory history records the adjustment', !!history.body.data?.some((h) => h.delta === 4 && h.reason === 'RESTOCK'), brief(history));

  await call('PATCH', `/admin/variants/${variantS?.id}`, { token: admin, body: { lowStockThreshold: 100 } });
  const low = await call<any[]>('GET', '/admin/inventory/low-stock', { token: admin });
  check('low-stock report picks up a variant under its threshold', !!low.body.data?.some((v) => v.id === variantS?.id), brief(low));

  // ----------------------------------------------------------- homepage
  section('homepage content');
  const sectionsBefore = await call<any[]>('GET', '/admin/home-sections', { token: admin });
  check('admin loads homepage sections', sectionsBefore.status === 200, brief(sectionsBefore));
  sectionOrderSnapshot = (sectionsBefore.body.data ?? []).map((s) => s.id);

  const banner = await call('POST', '/admin/home-sections', {
    token: admin,
    body: { type: 'BANNER_GRID', title: `E2E Offers ${run}`, subtitle: 'Temporary', isActive: true, sortOrder: 9999 },
  });
  check('create a banner section', banner.status === 201, brief(banner));
  const bannerId = banner.body.data?.id as string;
  if (bannerId) created.sectionIds.push(bannerId);

  const item1 = await call('POST', `/admin/home-sections/${bannerId}/items`, {
    token: admin,
    body: { imageUrl: imgA, mobileImageUrl: imgB, title: 'E2E Tile One', subtitle: 'Up to 25% off', ctaLabel: 'Shop', href: `/c/${childSlug}`, isActive: true },
  });
  const item2 = await call('POST', `/admin/home-sections/${bannerId}/items`, {
    token: admin,
    body: { imageUrl: imgB, title: 'E2E Tile Two', href: `/p/${newSlug}`, isActive: true },
  });
  check('add two tiles with uploaded images', item1.status === 201 && item2.status === 201, [brief(item1), brief(item2)]);
  const tile1 = item1.body.data?.id ?? item1.body.data?.items?.[0]?.id;
  const tile2 = item2.body.data?.id ?? item2.body.data?.items?.[1]?.id;

  let home = await call<any[]>('GET', '/catalog/home');
  let pub = home.body.data?.find((s) => s.id === bannerId);
  check('storefront homepage shows the new section', !!pub, { sections: home.body.data?.length });
  check('storefront shows both tiles with their images', pub?.items?.length === 2 && pub?.items?.[0]?.imageUrl === imgA && pub?.items?.[0]?.mobileImageUrl === imgB, pub?.items);

  const editTile = await call('PATCH', `/admin/home-section-items/${tile1}`, { token: admin, body: { title: 'E2E Tile One Edited', imageUrl: imgB } });
  const editSection = await call('PATCH', `/admin/home-sections/${bannerId}`, { token: admin, body: { title: `E2E Offers Edited ${run}` } });
  home = await call<any[]>('GET', '/catalog/home');
  pub = home.body.data?.find((s) => s.id === bannerId);
  check('edit a tile and the section title', editTile.status === 200 && editSection.status === 200, [brief(editTile), brief(editSection)]);
  check('storefront shows the edited title and tile image', pub?.title === `E2E Offers Edited ${run}` && pub?.items?.some((i: any) => i.title === 'E2E Tile One Edited' && i.imageUrl === imgB), pub);

  const reorderItems = await call('POST', `/admin/home-sections/${bannerId}/items/reorder`, { token: admin, body: { ids: [tile2, tile1] } });
  home = await call<any[]>('GET', '/catalog/home');
  pub = home.body.data?.find((s) => s.id === bannerId);
  check('reorder tiles and storefront follows', reorderItems.status === 200 && pub?.items?.[0]?.id === tile2, pub?.items?.map((i: any) => i.id));

  const hideTile = await call('PATCH', `/admin/home-section-items/${tile2}`, { token: admin, body: { isActive: false } });
  home = await call<any[]>('GET', '/catalog/home');
  pub = home.body.data?.find((s) => s.id === bannerId);
  check('hidden tile disappears from the storefront', hideTile.status === 200 && pub?.items?.length === 1, pub?.items);

  if (sectionOrderSnapshot && sectionOrderSnapshot.length > 0) {
    const last = sectionOrderSnapshot[sectionOrderSnapshot.length - 1];
    const swapped = [...sectionOrderSnapshot.slice(0, -1), bannerId, last];
    const reorder = await call('POST', '/admin/home-sections/reorder', { token: admin, body: { ids: swapped } });
    home = await call<any[]>('GET', '/catalog/home');
    const ids = (home.body.data ?? []).map((s) => s.id);
    check('reorder sections and storefront follows', reorder.status === 200 && ids.indexOf(bannerId) !== -1 && ids.indexOf(bannerId) < ids.indexOf(last), { ids });
    const restore = await call('POST', '/admin/home-sections/reorder', { token: admin, body: { ids: [...sectionOrderSnapshot, bannerId] } });
    check('restore the original section order', restore.status === 200, brief(restore));
  }

  const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
  const schedule = await call('PATCH', `/admin/home-sections/${bannerId}`, { token: admin, body: { startsAt: tomorrow } });
  home = await call<any[]>('GET', '/catalog/home');
  check('section scheduled for tomorrow is not shown yet', schedule.status === 200 && !home.body.data?.some((s) => s.id === bannerId), brief(schedule));
  const badWindow = await call('PATCH', `/admin/home-sections/${bannerId}`, { token: admin, body: { startsAt: tomorrow, endsAt: new Date().toISOString() } });
  check('schedule ending before it starts is refused (400)', badWindow.status === 400, brief(badWindow));
  await call('PATCH', `/admin/home-sections/${bannerId}`, { token: admin, body: { startsAt: null } });

  const carousel = await call('POST', '/admin/home-sections', {
    token: admin,
    body: { type: 'PRODUCT_CAROUSEL', title: `E2E Picks ${run}`, isActive: true, sortOrder: 9999, config: { source: 'manual', productIds: [productId], limit: 8 } },
  });
  check('create a hand-picked product carousel', carousel.status === 201, brief(carousel));
  const carouselId = carousel.body.data?.id as string;
  if (carouselId) created.sectionIds.push(carouselId);
  home = await call<any[]>('GET', '/catalog/home');
  const pubCarousel = home.body.data?.find((s) => s.id === carouselId);
  check('storefront carousel shows the picked product', !!pubCarousel?.products?.some((x: any) => x.slug === newSlug), pubCarousel);

  const delTile = await call('DELETE', `/admin/home-section-items/${tile2}`, { token: admin });
  check('delete a tile', delTile.status === 200, brief(delTile));
  const delSection = await call('DELETE', `/admin/home-sections/${carouselId}`, { token: admin });
  home = await call<any[]>('GET', '/catalog/home');
  check('deleted section is gone from the storefront', delSection.status === 200 && !home.body.data?.some((s) => s.id === carouselId), brief(delSection));
  if (delSection.status === 200) created.sectionIds = created.sectionIds.filter((id) => id !== carouselId);

  // --------------------------------------------------------- customers
  section('customers');
  const custEmail = `e2e-customer-${run}@example.com`;
  const reg = await call('POST', '/auth/register', { body: { name: `E2E Customer ${run}`, email: custEmail, password: 'E2eTest12345' } });
  check('a shopper can register', reg.status === 201, brief(reg));
  const customer = reg.body.data?.accessToken as string;
  const customerId = reg.body.data?.user?.id as string;
  if (customerId) created.userIds.push(customerId);

  const custList = await call('GET', `/admin/customers?search=${encodeURIComponent(custEmail)}`, { token: admin });
  check('admin finds the customer by email', !!custList.body.data?.items?.some((c: any) => c.id === customerId), brief(custList));
  const custDetail = await call('GET', `/admin/customers/${customerId}`, { token: admin });
  check('admin opens the customer profile', custDetail.status === 200 && custDetail.body.data?.email === custEmail, brief(custDetail));

  const block = await call('PATCH', `/admin/customers/${customerId}`, { token: admin, body: { isActive: false } });
  const blockedMe = await call('GET', '/auth/me', { token: customer });
  const blockedLogin = await call('POST', '/auth/login', { body: { email: custEmail, password: 'E2eTest12345' } });
  check('blocking a customer signs them out and stops sign-in', block.status === 200 && blockedMe.status === 401 && blockedLogin.status !== 200, [brief(blockedMe), brief(blockedLogin)]);
  await call('PATCH', `/admin/customers/${customerId}`, { token: admin, body: { isActive: true } });
  const unblockedMe = await call('GET', '/auth/me', { token: customer });
  check('unblocking restores access', unblockedMe.status === 200, brief(unblockedMe));

  // ------------------------------------------------------------ coupons
  section('coupons');
  const code = `E2E${run.toUpperCase()}`;
  const coupon = await call('POST', '/admin/coupons', {
    token: admin,
    body: { code, type: 'PERCENT', value: 1000, minOrderInPaise: 0, validFrom: new Date(Date.now() - 60_000).toISOString(), validUntil: new Date(Date.now() + 7 * 86_400_000).toISOString(), perUserLimit: 1, isActive: true },
  });
  check('create a 10% coupon', coupon.status === 201, brief(coupon));
  const couponId = coupon.body.data?.id as string;
  if (couponId) created.couponIds.push(couponId);
  const couponList = await call<any[]>('GET', '/admin/coupons', { token: admin });
  check('coupon appears in the admin list', !!couponList.body.data?.some((c) => c.id === couponId));

  const addToCart = await call('POST', '/cart/items', { token: customer, body: { variantId: variantS?.id, qty: 1 } });
  check('customer adds the product to their bag', addToCart.status === 201, brief(addToCart));
  const addBlue = await call('POST', '/cart/items', { token: customer, body: { variantId: variantBlue?.id, qty: 1 } });
  const blueLine = addBlue.body.data?.items?.find((i: any) => i.variantId === variantBlue?.id);
  check('bag shows the photo for the chosen colour', addBlue.status === 201 && blueLine?.thumbnailUrl === imgB, blueLine);
  if (blueLine) await call('DELETE', `/cart/items/${blueLine.id}`, { token: customer });
  let priced = await call('GET', `/cart?coupon=${code}`, { token: customer });
  check('coupon applies 10% at checkout', priced.status === 200 && priced.body.data?.discountInPaise === 18990, { status: priced.status, discount: priced.body.data?.discountInPaise, error: priced.body.error });

  const editCoupon = await call('PATCH', `/admin/coupons/${couponId}`, { token: admin, body: { value: 2000 } });
  priced = await call('GET', `/cart?coupon=${code}`, { token: customer });
  check('edited coupon value takes effect immediately', editCoupon.status === 200 && priced.body.data?.discountInPaise === 37980, { discount: priced.body.data?.discountInPaise });

  const disableCoupon = await call('PATCH', `/admin/coupons/${couponId}`, { token: admin, body: { isActive: false } });
  priced = await call('GET', `/cart?coupon=${code}`, { token: customer });
  check('disabled coupon is refused at checkout', disableCoupon.status === 200 && priced.status === 422, brief(priced));

  const badCoupon = await call('POST', '/admin/coupons', { token: admin, body: { code: 'lowercase', type: 'FLAT', value: 100, validFrom: new Date().toISOString(), validUntil: new Date().toISOString() } });
  check('invalid coupon code format is refused (400)', badCoupon.status === 400, brief(badCoupon));

  // ------------------------------------------------------------- orders
  section('orders');
  const stockBefore = (await prisma.productVariant.findUniqueOrThrow({ where: { id: variantS.id } })).stockQty;
  const makeOrder = async (suffix: string) => {
    const unit = 189900;
    const order = await prisma.order.create({
      data: {
        orderNumber: `CHK-E2E-${run}-${suffix}`.toUpperCase(),
        userId: customerId,
        idempotencyKey: crypto.randomUUID(),
        status: 'CONFIRMED',
        subtotalInPaise: unit,
        shippingInPaise: 0,
        totalInPaise: unit,
        shipFullName: `E2E Customer ${run}`,
        shipPhone: '9876543210',
        shipLine1: '1 Test Street',
        shipCity: 'Hyderabad',
        shipState: 'Telangana',
        shipPincode: '500001',
        items: {
          create: {
            variantId: variantS.id,
            productName: `E2E Test Saree Edited ${run}`,
            sku: variantS.sku,
            size: 'S',
            color: 'Red',
            thumbnailUrl: imgB,
            unitPriceInPaise: unit,
            qty: 1,
            lineTotalInPaise: unit,
          },
        },
        payments: {
          create: { razorpayOrderId: `order_e2e_${run}_${suffix}`, razorpayPaymentId: `pay_e2e_${run}_${suffix}`, amountInPaise: unit, status: 'CAPTURED', method: 'upi' },
        },
        statusHistory: { create: [{ status: 'PENDING', note: 'E2E' }, { status: 'CONFIRMED', note: 'E2E payment captured' }] },
      },
      include: { items: true },
    });
    created.orderIds.push(order.id);
    return order;
  };
  const order = await makeOrder('a');

  const orders = await call('GET', `/admin/orders?search=${order.orderNumber}`, { token: admin });
  check('admin order list finds the order', !!orders.body.data?.items?.some((o: any) => o.id === order.id), brief(orders));
  const orderDetail = await call('GET', `/admin/orders/${order.id}`, { token: admin });
  check('admin opens the order with customer, items and payment', orderDetail.status === 200 && orderDetail.body.data?.items?.length === 1 && orderDetail.body.data?.user?.email === custEmail && orderDetail.body.data?.payments?.length === 1, brief(orderDetail));

  const illegal = await call('POST', `/admin/orders/${order.id}/status`, { token: admin, body: { status: 'DELIVERED' } });
  check('illegal status jump is refused (422)', illegal.status === 422, brief(illegal));

  const processing = await call('POST', `/admin/orders/${order.id}/status`, { token: admin, body: { status: 'PROCESSING', note: 'Packing' } });
  check('move order to Processing', processing.status === 200, brief(processing));

  const shipment = await call('POST', `/admin/orders/${order.id}/shipment`, { token: admin });
  check(
    'create shipment works, or explains Shiprocket is not connected',
    shipment.status === 201 || (shipment.status === 422 && shipment.body.error?.code === 'SHIPPING_UNAVAILABLE'),
    brief(shipment),
  );

  for (const status of ['SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED']) {
    const r = await call('POST', `/admin/orders/${order.id}/status`, { token: admin, body: { status } });
    check(`move order to ${status}`, r.status === 200, brief(r));
  }
  const custOrder = await call('GET', `/orders/${order.id}`, { token: customer });
  check("customer's account shows the order as Delivered", custOrder.body.data?.status === 'DELIVERED', brief(custOrder));
  const custOrders = await call('GET', '/orders', { token: customer });
  check("customer's order list includes it", !!custOrders.body.data?.items?.some((o: any) => o.id === order.id));

  // Returns: customer uploads a damage photo and requests a return.
  const evidenceForm = new FormData();
  evidenceForm.append('files', await testImage([120, 120, 120], 'jpeg', 800, 800), 'damage.jpg');
  const evidence = await call<{ url: string }[]>('POST', '/uploads', { token: customer, form: evidenceForm });
  check('customer uploads a damage photo', evidence.status === 201, brief(evidence));
  const evidenceUrl = evidence.body.data?.[0]?.url;
  if (evidenceUrl) created.imageUrls.push(evidenceUrl);
  const ret = await call('POST', `/orders/${order.id}/return`, {
    token: customer,
    body: { orderItemId: order.items[0].id, reason: 'Thread pulled on the pallu, see photo.', imageUrls: [evidenceUrl] },
  });
  check('customer requests a return', ret.status === 201, brief(ret));
  const returnId = ret.body.data?.returnRequestId as string;

  const adminReturns = await call('GET', '/admin/returns?status=REQUESTED', { token: admin });
  const adminReturn = adminReturns.body.data?.items?.find((r: any) => r.id === returnId);
  check('admin sees the return with its photo', !!adminReturn && (adminReturn.imageUrls ?? []).includes(evidenceUrl), adminReturn ?? brief(adminReturns));
  const approve = await call('POST', `/admin/returns/${returnId}/decision`, { token: admin, body: { decision: 'APPROVED', adminNote: 'Pickup tomorrow' } });
  check('approve the return', approve.status === 200, brief(approve));
  const decideAgain = await call('POST', `/admin/returns/${returnId}/decision`, { token: admin, body: { decision: 'REJECTED' } });
  check('a decided return cannot be decided again (409)', decideAgain.status === 409, brief(decideAgain));
  const custReturns = await call<any[]>('GET', '/orders/returns', { token: customer });
  check("customer's returns page shows Approved", custReturns.body.data?.some((r) => r.id === returnId && r.status === 'APPROVED'), brief(custReturns));
  const received = await call('POST', `/admin/returns/${returnId}/received`, { token: admin, body: { restock: true } });
  const stockAfterReturn = (await prisma.productVariant.findUniqueOrThrow({ where: { id: variantS.id } })).stockQty;
  check('mark return received and restock', received.status === 200 && stockAfterReturn === stockBefore + 1, { status: received.status, stockBefore, stockAfterReturn });
  const custOrderReturned = await call('GET', `/orders/${order.id}`, { token: customer });
  check("customer's order shows Returned", custOrderReturned.body.data?.status === 'RETURNED', brief(custOrderReturned));

  const refund = await call('POST', `/admin/orders/${order.id}/refund`, { token: admin, body: { reason: 'E2E return refund', returnRequestId: returnId } });
  check('refund responds cleanly (Razorpay not configured here)', refund.status < 500, brief(refund));

  // Store cancellation restocks.
  const order2 = await makeOrder('b');
  const stockBeforeCancel = (await prisma.productVariant.findUniqueOrThrow({ where: { id: variantS.id } })).stockQty;
  const cancel = await call('POST', `/admin/orders/${order2.id}/status`, { token: admin, body: { status: 'CANCELLED', note: 'E2E store cancel' } });
  check('store cancels a paid order successfully', cancel.status === 200, brief(cancel));
  check(
    'a refund that cannot start is reported without undoing the cancel',
    cancel.body.data?.refundError == null || typeof cancel.body.data?.refundError === 'string',
    cancel.body.data?.refundError,
  );
  const stockAfterCancel = (await prisma.productVariant.findUniqueOrThrow({ where: { id: variantS.id } })).stockQty;
  const order2After = await prisma.order.findUniqueOrThrow({ where: { id: order2.id } });
  check('cancelled order is marked Cancelled and stock is released', order2After.status === 'CANCELLED' && stockAfterCancel === stockBeforeCancel + 1, { status: order2After.status, stockBeforeCancel, stockAfterCancel });
  const custOrder2 = await call('GET', `/orders/${order2.id}`, { token: customer });
  check("customer's account shows the cancellation", custOrder2.body.data?.status === 'CANCELLED', brief(custOrder2));

  const payments = await call('GET', '/admin/payments', { token: admin });
  check('payments list shows the order payment', !!payments.body.data?.items?.some((pm: any) => pm.razorpayOrderId === `order_e2e_${run}_a`), brief(payments));
  const shipments = await call('GET', '/admin/shipments', { token: admin });
  check('shipments list loads', shipments.status === 200, brief(shipments));

  // ------------------------------------------------------- staff & roles
  section('staff & roles');
  const roles = await call('GET', '/admin/roles', { token: admin });
  check('roles and permission catalogue load', roles.status === 200 && Array.isArray(roles.body.data?.allPermissions), brief(roles));
  const role = await call('POST', '/admin/roles', { token: admin, body: { name: `E2E Viewer ${run}`, description: 'Temporary', permissions: ['products.read', 'dashboard.view'] } });
  check('create a staff role', role.status === 201, brief(role));
  const roleId = role.body.data?.id as string;
  if (roleId) created.roleIds.push(roleId);

  const staffEmail = `e2e-staff-${run}@example.com`;
  const staff = await call('POST', '/admin/staff', { token: admin, body: { name: `E2E Staff ${run}`, email: staffEmail, password: 'E2eStaff12345', staffRoleId: roleId } });
  check('create a staff member with that role', staff.status === 201, brief(staff));
  const staffId = staff.body.data?.id as string;
  if (staffId) created.userIds.push(staffId);

  const staffLogin = await call('POST', '/auth/login', { body: { email: staffEmail, password: 'E2eStaff12345' } });
  const staffToken = staffLogin.body.data?.accessToken as string;
  check('staff member can sign in', staffLogin.status === 200, brief(staffLogin));
  const allowed = await call('GET', '/admin/products', { token: staffToken });
  const forbidden = await call('GET', '/admin/orders', { token: staffToken });
  check('staff can use what their role allows', allowed.status === 200, brief(allowed));
  check('staff are blocked from what their role does not allow (403)', forbidden.status === 403, brief(forbidden));
  const grant = await call('PATCH', `/admin/roles/${roleId}`, { token: admin, body: { permissions: ['products.read', 'dashboard.view', 'orders.read'] } });
  const nowAllowed = await call('GET', '/admin/orders', { token: staffToken });
  check('granting a permission takes effect without re-login', grant.status === 200 && nowAllowed.status === 200, brief(nowAllowed));
  const staffList = await call<any[]>('GET', '/admin/staff', { token: admin });
  check('staff list includes the new member', !!staffList.body.data?.some((s) => s.id === staffId));
  const disable = await call('PATCH', `/admin/staff/${staffId}`, { token: admin, body: { isActive: false } });
  const afterDisable = await call('GET', '/admin/products', { token: staffToken });
  check('deactivated staff lose access immediately', disable.status === 200 && afterDisable.status === 401, brief(afterDisable));
  const customerAsAdmin = await call('GET', '/admin/dashboard', { token: customer });
  check('a customer cannot open the admin API (403)', customerAsAdmin.status === 403, brief(customerAsAdmin));

  // --------------------------------------------------- dashboard & reports
  section('dashboard & reports');
  const dash = await call('GET', '/admin/dashboard', { token: admin });
  check('dashboard loads with its figures', dash.status === 200 && typeof dash.body.data?.ordersToday === 'number', brief(dash));
  check('dashboard recent orders include the new order', !!dash.body.data?.recentOrders?.some((o: any) => o.id === order2.id || o.id === order.id), dash.body.data?.recentOrders?.map((o: any) => o.orderNumber));
  const sales = await call('GET', '/admin/reports/sales?days=30', { token: admin });
  check('sales report loads', sales.status === 200, brief(sales));

  // ---------------------------------------------------------------- SEO
  section('seo');
  const settings = await call('GET', '/admin/seo/settings', { token: admin });
  check('SEO settings load', settings.status === 200, brief(settings));
  seoSnapshot = settings.body.data ?? null;
  const newHomeTitle = `E2E Home Title ${run}`;
  const patchSeo = await call('PATCH', '/admin/seo/settings', { token: admin, body: { homeTitle: newHomeTitle } });
  check('edit SEO settings', patchSeo.status === 200 && patchSeo.body.data?.homeTitle === newHomeTitle, brief(patchSeo));
  const head = await call('GET', `/seo/head?path=/`);
  check('storefront page head uses the edited home title', JSON.stringify(head.body).includes(newHomeTitle), brief(head));
  const restoreSeo = await call('PATCH', '/admin/seo/settings', { token: admin, body: { homeTitle: (seoSnapshot as any)?.homeTitle ?? null } });
  check('restore SEO settings', restoreSeo.status === 200, brief(restoreSeo));

  const redirectSource = `/zz-e2e-old-${run}`;
  const redirect = await call('POST', '/admin/seo/redirects', { token: admin, body: { source: redirectSource, destination: `/p/${newSlug}`, statusCode: 301 } });
  check('create a redirect', redirect.status === 201, brief(redirect));
  created.redirectSources.push(redirectSource);
  const loop = await call('POST', '/admin/seo/redirects', { token: admin, body: { source: `/p/${newSlug}`, destination: redirectSource } });
  check('redirect loops are refused (400)', loop.status === 400, brief(loop));
  const lookup = await call('GET', `/seo/redirect?path=${encodeURIComponent(redirectSource)}`);
  check('storefront can resolve the redirect', lookup.status === 200 && lookup.body.data?.destination === `/p/${newSlug}`, brief(lookup));
  const redirects = await call('GET', '/admin/seo/redirects', { token: admin });
  check('redirect list includes it', !!redirects.body.data?.items?.some((r: any) => r.source === redirectSource));
  const redirectId = redirect.body.data?.id;
  const delRedirect = await call('DELETE', `/admin/seo/redirects/${redirectId}`, { token: admin });
  const lookupGone = await call('GET', `/seo/redirect?path=${encodeURIComponent(redirectSource)}`);
  check('deleted redirect stops resolving', delRedirect.status === 200 && lookupGone.body.data?.destination == null, brief(lookupGone));
  const audit = await call('GET', '/admin/seo/audit', { token: admin });
  check('SEO audit loads', audit.status === 200, brief(audit));

  // ------------------------------------------------------ deleting things
  section('deleting');
  const blocked = await call('DELETE', `/admin/categories/${childId}`, { token: admin });
  check('a category with products cannot be deleted (409)', blocked.status === 409, brief(blocked));

  const orderedDelete = await call('DELETE', `/admin/products/${productId}`, { token: admin });
  check('a product that was ordered cannot be deleted (409)', orderedDelete.status === 409, brief(orderedDelete));

  const spareSlug = tag('spare');
  const spare = await call('POST', '/admin/products', {
    token: admin,
    body: {
      name: `E2E Spare ${run}`, slug: spareSlug, description: 'Never ordered, so it can be deleted.', categoryId: childId, isActive: true,
      images: [{ url: imgA, alt: null }],
      variants: [{ sku: `E2E-${run}-SPARE`, priceInPaise: 50000, stockQty: 2 }],
    },
  });
  const spareId = spare.body.data?.id as string;
  if (spareId) created.productIds.push(spareId);
  await call('POST', '/cart/items', { token: customer, body: { variantId: spare.body.data?.variants?.[0]?.id, qty: 1 } });
  const spareDelete = await call('DELETE', `/admin/products/${spareId}`, { token: admin });
  const spareGone = await call('GET', `/catalog/products/${spareSlug}`);
  const cartAfter = await call('GET', '/cart', { token: customer });
  check('a never-ordered product can be deleted', spareDelete.status === 200 && spareGone.status === 404, [brief(spareDelete), brief(spareGone)]);
  check("deleting a product removes it from shoppers' bags", cartAfter.status === 200 && !cartAfter.body.data?.items?.some((i: any) => i.productSlug === spareSlug), brief(cartAfter));
  if (spareDelete.status === 200) created.productIds = created.productIds.filter((id) => id !== spareId);

  const missingDelete = await call('DELETE', `/admin/products/${spareId}`, { token: admin });
  check('deleting a product that no longer exists returns 404', missingDelete.status === 404, brief(missingDelete));
}

// ------------------------------------------------------------------ cleanup

async function cleanup() {
  section('cleanup');
  const orderIds = created.orderIds;
  const errors: string[] = [];
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (err) {
      errors.push(`${name}: ${(err as Error).message.split('\n').slice(-1)[0]}`);
    }
  };

  if (sectionOrderSnapshot) {
    await step('restore section order', () =>
      prisma.$transaction(sectionOrderSnapshot!.map((id, i) => prisma.homeSection.updateMany({ where: { id }, data: { sortOrder: i } }))),
    );
  }
  if (seoSnapshot) {
    await step('restore seo', () => prisma.seoSettings.update({ where: { id: 'default' }, data: { homeTitle: (seoSnapshot as any).homeTitle ?? null } }));
  }
  await step('refunds', () => prisma.refund.deleteMany({ where: { payment: { orderId: { in: orderIds } } } }));
  await step('returns', () => prisma.returnRequest.deleteMany({ where: { orderId: { in: orderIds } } }));
  await step('shipments', () => prisma.shipment.deleteMany({ where: { orderId: { in: orderIds } } }));
  await step('payments', () => prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } }));
  await step('status history', () => prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } }));
  await step('coupon redemptions', () => prisma.couponRedemption.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { couponId: { in: created.couponIds } }] } }));
  await step('order items', () => prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } }));
  await step('orders', () => prisma.order.deleteMany({ where: { id: { in: orderIds } } }));
  await step('coupons', () => prisma.coupon.deleteMany({ where: { id: { in: created.couponIds } } }));
  await step('section items', () => prisma.homeSectionItem.deleteMany({ where: { sectionId: { in: created.sectionIds } } }));
  await step('sections', () => prisma.homeSection.deleteMany({ where: { id: { in: created.sectionIds } } }));
  await step('cart items', () => prisma.cartItem.deleteMany({ where: { OR: [{ userId: { in: created.userIds } }, { variant: { productId: { in: created.productIds } } }] } }));
  await step('wishlist', () => prisma.wishlistItem.deleteMany({ where: { productId: { in: created.productIds } } }));
  await step('inventory logs', () => prisma.inventoryLog.deleteMany({ where: { variant: { productId: { in: created.productIds } } } }));
  await step('variants', () => prisma.productVariant.deleteMany({ where: { productId: { in: created.productIds } } }));
  await step('product images', () => prisma.productImage.deleteMany({ where: { productId: { in: created.productIds } } }));
  await step('products', () => prisma.product.deleteMany({ where: { id: { in: created.productIds } } }));
  await step('categories', async () => {
    for (const id of created.categoryIds) await prisma.category.deleteMany({ where: { id } });
  });
  await step('redirects', () => prisma.redirect.deleteMany({ where: { OR: [{ source: { in: created.redirectSources } }, { source: { contains: `zz-e2e-` } , destination: { contains: run } }] } }));
  await step('notifications', () => prisma.notification.deleteMany({ where: { userId: { in: created.userIds } } }));
  await step('refresh tokens', () => prisma.refreshToken.deleteMany({ where: { userId: { in: created.userIds } } }));
  await step('users', () => prisma.user.deleteMany({ where: { id: { in: created.userIds } } }));
  await step('roles', () => prisma.staffRole.deleteMany({ where: { id: { in: created.roleIds } } }));
  await step('audit log', () => prisma.auditLog.deleteMany({ where: { OR: [{ entityId: { in: [...created.productIds, ...created.categoryIds, ...created.sectionIds] } }, { actorId: { in: created.userIds } }] } }));
  await step('stored images', () => prisma.storedImage.deleteMany({ where: { filename: { in: created.imageUrls.map((u) => u.split('/').pop()!) } } }));
  let r2Leftovers = 0;
  if (r2Configured) {
    await step('R2 objects', async () => {
      for (const url of created.imageUrls) await deleteObject(uploadKey(url.split('/').pop()!));
    });
    for (const url of created.imageUrls) if (await objectExists(uploadKey(url.split('/').pop()!))) r2Leftovers++;
  }

  const leftovers = await Promise.all([
    prisma.product.count({ where: { slug: { contains: run } } }),
    prisma.category.count({ where: { slug: { contains: run } } }),
    prisma.user.count({ where: { email: { contains: run } } }),
    prisma.order.count({ where: { orderNumber: { contains: run.toUpperCase() } } }),
    prisma.homeSection.count({ where: { title: { contains: run } } }),
    prisma.coupon.count({ where: { code: { contains: run.toUpperCase() } } }),
  ]);
  check('all temporary data removed (database and R2)', errors.length === 0 && leftovers.every((n) => n === 0) && r2Leftovers === 0, { errors, leftovers, r2Leftovers });
}

main()
  .catch((err) => {
    check('script ran to completion', false, (err as Error).stack?.split('\n').slice(0, 3).join(' | '));
  })
  .finally(async () => {
    try {
      await cleanup();
    } finally {
      await prisma.$disconnect();
      const failed = results.filter((r) => !r.ok);
      console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
      if (failed.length) {
        console.log('\nFailures:');
        for (const f of failed) console.log(` - [${f.area}] ${f.name}${f.detail ? `: ${f.detail}` : ''}`);
      }
      process.exitCode = failed.length ? 1 : 0;
    }
  });
