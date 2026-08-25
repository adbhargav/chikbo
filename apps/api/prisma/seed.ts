/**
 * Seed: Chikbo category tree, sample products/variants, RBAC roles,
 * super-admin user and a launch coupon.
 *
 * Run: npm run prisma:seed  (idempotent — upserts by slug/sku/email)
 */
import { PrismaClient, CouponType, HomeSectionType, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

/**
 * Catalogue photography lives in the API's uploads dir as
 * <product-slug>-<n>.(jpg|png|webp|avif) and is served at /uploads/products/.
 * The seed discovers whatever files are present, so dropping another shot in
 * (e.g. `long-kurti-navy-chikankari-4.jpg`) adds it to that product's gallery
 * on the next seed — no code change. See docs/imagery.md.
 */
const PRODUCT_IMAGE_DIR = path.resolve(__dirname, '../uploads/products');

function imageFilesForSlug(slug: string): string[] {
  const pattern = new RegExp(`^${slug}-\\d+\\.(jpe?g|png|webp|avif)$`, 'i');
  try {
    return fs
      .readdirSync(PRODUCT_IMAGE_DIR)
      .filter((file) => pattern.test(file))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  } catch {
    return []; // no uploads dir yet — products fall back to generated SilkArt
  }
}

/**
 * Server-relative URL of a product photograph, e.g. `/uploads/products/x-1.jpg`.
 * Used by the seeded homepage so the storefront (which proxies /uploads to the
 * API) always has real imagery. Returns null when the file isn't there yet.
 */
function productImageUrl(slug: string, index = 1): string | null {
  const file = imageFilesForSlug(slug)[index - 1];
  return file ? `/uploads/products/${file}` : null;
}

const CATEGORIES: { name: string; slug: string; children: { name: string; slug: string }[] }[] = [
  {
    name: 'Sarees',
    slug: 'sarees',
    children: [
      { name: 'Pattu Silk', slug: 'pattu-silk' },
      { name: 'Cotton Saree', slug: 'cotton-saree' },
      { name: 'Banarasi', slug: 'banarasi' },
      { name: 'Georgette', slug: 'georgette-saree' },
      { name: 'Organza', slug: 'organza-saree' },
      { name: 'Linen', slug: 'linen-saree' },
    ],
  },
  {
    name: 'Kurtis & Suit Sets',
    slug: 'kurtis-suit-sets',
    children: [
      { name: 'Anarkali', slug: 'anarkali' },
      { name: 'Straight Kurti', slug: 'straight-kurti' },
      { name: 'Palazzo Set', slug: 'palazzo-set' },
      { name: 'Sharara Set', slug: 'sharara-set' },
    ],
  },
  {
    name: 'Lehengas',
    slug: 'lehengas',
    children: [
      { name: 'Bridal Lehenga', slug: 'bridal-lehenga' },
      { name: 'Festive Lehenga', slug: 'festive-lehenga' },
      { name: 'Half Saree', slug: 'half-saree' },
    ],
  },
  {
    name: 'Dresses',
    slug: 'dresses',
    children: [
      { name: 'Two-piece', slug: 'two-piece' },
      { name: 'Three-piece', slug: 'three-piece' },
      { name: 'Gowns', slug: 'gowns' },
      { name: 'Co-ord Sets', slug: 'co-ord-sets' },
    ],
  },
  {
    name: 'Tops',
    slug: 'tops',
    children: [
      { name: 'Crop Top', slug: 'crop-top' },
      { name: 'Western Top', slug: 'western-top' },
      { name: 'Short Kurti', slug: 'short-kurti' },
      { name: 'Long Kurti', slug: 'long-kurti' },
      { name: 'T-Shirts', slug: 't-shirts' },
    ],
  },
  {
    name: 'Bottomwear',
    slug: 'bottomwear',
    children: [
      { name: 'Jeans', slug: 'jeans' },
      { name: 'Korean Pants', slug: 'korean-pants' },
      { name: 'Cotton Pants', slug: 'cotton-pants' },
      { name: 'Track Pants', slug: 'track-pants' },
      { name: 'Palazzos', slug: 'palazzos' },
      { name: 'Leggings', slug: 'leggings' },
    ],
  },
  {
    name: 'Blouses',
    slug: 'blouses',
    children: [
      { name: 'Readymade Blouse', slug: 'readymade-blouse' },
      { name: 'Designer Blouse', slug: 'designer-blouse' },
      { name: 'Padded Blouse', slug: 'padded-blouse' },
    ],
  },
  {
    name: 'Dupattas & Stoles',
    slug: 'dupattas-stoles',
    children: [
      { name: 'Banarasi Dupatta', slug: 'banarasi-dupatta' },
      { name: 'Phulkari', slug: 'phulkari-dupatta' },
      { name: 'Stoles', slug: 'stoles' },
    ],
  },
  {
    name: 'Antique Imitation Jewellery',
    slug: 'antique-imitation-jewellery',
    children: [
      { name: 'Necklace Sets', slug: 'necklace-sets' },
      { name: 'Earrings', slug: 'earrings' },
      { name: 'Bangles & Kada', slug: 'bangles-kada' },
      { name: 'Maang Tikka', slug: 'maang-tikka' },
    ],
  },
  {
    name: 'Bags & Clutches',
    slug: 'bags-clutches',
    children: [
      { name: 'Potli Bags', slug: 'potli-bags' },
      { name: 'Clutches', slug: 'clutches' },
      { name: 'Tote Bags', slug: 'tote-bags' },
    ],
  },
  {
    name: 'Nightwear & Loungewear',
    slug: 'nightwear-loungewear',
    children: [
      { name: 'Night Suits', slug: 'night-suits' },
      { name: 'Nighties', slug: 'nighties' },
      { name: 'Loungewear Sets', slug: 'loungewear-sets' },
    ],
  },
  {
    name: 'Winter Wear',
    slug: 'winter-wear',
    children: [
      { name: 'Shawls', slug: 'shawls' },
      { name: 'Cardigans', slug: 'cardigans' },
      { name: 'Jackets', slug: 'jackets' },
    ],
  },
];

interface SeedProduct {
  name: string;
  slug: string;
  categorySlug: string;
  description: string;
  attributes?: Record<string, string>;
  /** Merchandising badge shown bottom-left on the product card. */
  badge?: string;
  images: { url: string; alt: string }[];
  variants: {
    sku: string;
    size?: string;
    color?: string;
    weightGrams?: number;
    priceInPaise: number;
    discountPriceInPaise?: number;
    stockQty: number;
  }[];
}

const SIZES = ['S', 'M', 'L', 'XL'];

const PRODUCTS: SeedProduct[] = [
  {
    name: 'Kanchipuram Pattu Silk Saree — Maroon Zari',
    slug: 'kanchipuram-pattu-silk-maroon-zari',
    badge: 'Bestseller',
    categorySlug: 'pattu-silk',
    description:
      'Handwoven Kanchipuram pattu silk saree in deep maroon with traditional gold zari border and rich pallu. Comes with unstitched blouse piece. A timeless heirloom drape for weddings and festive occasions.',
    attributes: { Fabric: 'Pure Kanchipuram Silk', Occasion: 'Wedding / Festive', 'Blouse Piece': 'Included', Care: 'Dry clean only' },
    images: [
      { url: '/images/products/pattu-maroon-1.jpg', alt: 'Maroon Kanchipuram pattu silk saree full drape' },
      { url: '/images/products/pattu-maroon-2.jpg', alt: 'Gold zari border detail' },
    ],
    variants: [
      { sku: 'CHK-SR-PS-001', color: 'Maroon', weightGrams: 800, priceInPaise: 1249900, discountPriceInPaise: 999900, stockQty: 12 },
      { sku: 'CHK-SR-PS-002', color: 'Royal Blue', weightGrams: 800, priceInPaise: 1249900, discountPriceInPaise: 999900, stockQty: 8 },
    ],
  },
  {
    name: 'Handloom Cotton Saree — Indigo Stripes',
    slug: 'handloom-cotton-saree-indigo-stripes',
    badge: 'Everyday Edit',
    categorySlug: 'cotton-saree',
    description:
      'Breathable everyday handloom cotton saree in indigo with fine woven stripes and contrast blouse piece. Soft-finish and easy to drape — perfect for work and daily wear.',
    attributes: { Fabric: '100% Handloom Cotton', Occasion: 'Daily / Office', 'Blouse Piece': 'Included', Care: 'Gentle machine wash' },
    images: [{ url: '/images/products/cotton-indigo-1.jpg', alt: 'Indigo striped handloom cotton saree' }],
    variants: [
      { sku: 'CHK-SR-CT-001', color: 'Indigo', weightGrams: 450, priceInPaise: 189900, discountPriceInPaise: 149900, stockQty: 30 },
      { sku: 'CHK-SR-CT-002', color: 'Mustard', weightGrams: 450, priceInPaise: 189900, discountPriceInPaise: 149900, stockQty: 24 },
    ],
  },
  {
    name: 'Banarasi Silk Saree — Emerald Meenakari',
    slug: 'banarasi-silk-saree-emerald-meenakari',
    badge: 'Festive Edit',
    categorySlug: 'banarasi',
    description:
      'Classic Banarasi silk saree in emerald green with intricate meenakari buttis and antique gold zari pallu. Woven in Varanasi by master weavers.',
    attributes: { Fabric: 'Banarasi Silk', Occasion: 'Wedding / Festive', 'Blouse Piece': 'Included', Care: 'Dry clean only' },
    images: [{ url: '/images/products/banarasi-emerald-1.jpg', alt: 'Emerald Banarasi silk saree with gold zari' }],
    variants: [
      { sku: 'CHK-SR-BN-001', color: 'Emerald', weightGrams: 700, priceInPaise: 849900, discountPriceInPaise: 699900, stockQty: 10 },
      { sku: 'CHK-SR-BN-002', color: 'Wine', weightGrams: 700, priceInPaise: 849900, stockQty: 6 },
    ],
  },
  {
    name: 'Festive Two-Piece Dress — Rose Pink Anarkali Set',
    slug: 'two-piece-rose-pink-anarkali-set',
    categorySlug: 'two-piece',
    description:
      'Elegant two-piece set with flowy Anarkali-style kurta and matching palazzo in rose pink. Lightweight georgette with subtle sequin detailing.',
    attributes: { Fabric: 'Georgette', Occasion: 'Festive / Party', Set: 'Kurta + Palazzo' },
    images: [{ url: '/images/products/twopiece-rose-1.jpg', alt: 'Rose pink two-piece Anarkali set' }],
    variants: SIZES.map((size, i) => ({
      sku: `CHK-DR-2P-00${i + 1}`,
      size,
      color: 'Rose Pink',
      priceInPaise: 299900,
      discountPriceInPaise: 239900,
      stockQty: 15,
    })),
  },
  {
    name: 'Three-Piece Suit Set — Teal Chanderi with Dupatta',
    slug: 'three-piece-teal-chanderi-dupatta',
    categorySlug: 'three-piece',
    description:
      'Graceful three-piece suit set: Chanderi silk kurta, cotton-lined bottom and organza dupatta in teal with gold accents.',
    attributes: { Fabric: 'Chanderi Silk', Occasion: 'Festive', Set: 'Kurta + Bottom + Dupatta' },
    images: [{ url: '/images/products/threepiece-teal-1.jpg', alt: 'Teal three-piece Chanderi suit set' }],
    variants: SIZES.map((size, i) => ({
      sku: `CHK-DR-3P-00${i + 1}`,
      size,
      color: 'Teal',
      priceInPaise: 379900,
      discountPriceInPaise: 319900,
      stockQty: 12,
    })),
  },
  {
    name: 'Ribbed Crop Top — Ivory',
    slug: 'ribbed-crop-top-ivory',
    badge: 'New',
    categorySlug: 'crop-top',
    description: 'Fitted ribbed-knit crop top in ivory with a square neckline. Pairs with high-waist jeans or Korean pants.',
    attributes: { Fabric: 'Cotton-Lycra Rib', Fit: 'Slim' },
    images: [{ url: '/images/products/croptop-ivory-1.jpg', alt: 'Ivory ribbed crop top' }],
    variants: SIZES.map((size, i) => ({
      sku: `CHK-TP-CR-00${i + 1}`,
      size,
      color: 'Ivory',
      priceInPaise: 79900,
      discountPriceInPaise: 59900,
      stockQty: 40,
    })),
  },
  {
    name: 'Satin Western Top — Black Cowl Neck',
    slug: 'satin-western-top-black-cowl',
    categorySlug: 'western-top',
    description: 'Luxe satin cowl-neck top in black with adjustable straps. Evening-ready with a soft drape.',
    attributes: { Fabric: 'Satin', Fit: 'Regular' },
    images: [{ url: '/images/products/western-black-1.jpg', alt: 'Black satin cowl neck top' }],
    variants: SIZES.map((size, i) => ({
      sku: `CHK-TP-WS-00${i + 1}`,
      size,
      color: 'Black',
      priceInPaise: 99900,
      discountPriceInPaise: 79900,
      stockQty: 35,
    })),
  },
  {
    name: 'Short Kurti — Blush Floral Block Print',
    slug: 'short-kurti-blush-floral',
    categorySlug: 'short-kurti',
    description: 'Hand block-printed short kurti in blush with floral motifs, three-quarter sleeves and side slits.',
    attributes: { Fabric: 'Cambric Cotton', Length: 'Short', Print: 'Hand Block' },
    images: [{ url: '/images/products/shortkurti-blush-1.jpg', alt: 'Blush floral block print short kurti' }],
    variants: SIZES.map((size, i) => ({
      sku: `CHK-TP-SK-00${i + 1}`,
      size,
      color: 'Blush',
      priceInPaise: 119900,
      discountPriceInPaise: 89900,
      stockQty: 28,
    })),
  },
  {
    name: 'Long Kurti — Navy Chikankari',
    slug: 'long-kurti-navy-chikankari',
    categorySlug: 'long-kurti',
    description: 'Straight-cut long kurti in navy with delicate chikankari embroidery on yoke and sleeves.',
    attributes: { Fabric: 'Rayon', Length: 'Calf-length', Work: 'Chikankari' },
    images: [{ url: '/images/products/longkurti-navy-1.jpg', alt: 'Navy chikankari long kurti' }],
    variants: SIZES.map((size, i) => ({
      sku: `CHK-TP-LK-00${i + 1}`,
      size,
      color: 'Navy',
      priceInPaise: 149900,
      discountPriceInPaise: 119900,
      stockQty: 25,
    })),
  },
  {
    name: 'Classic Cotton T-Shirt — Sage',
    slug: 'classic-cotton-tshirt-sage',
    categorySlug: 't-shirts',
    description: 'Everyday crew-neck t-shirt in sage green. Pre-shrunk combed cotton with a soft hand feel.',
    attributes: { Fabric: '100% Combed Cotton', Fit: 'Regular', GSM: '180' },
    images: [{ url: '/images/products/tshirt-sage-1.jpg', alt: 'Sage green cotton t-shirt' }],
    variants: SIZES.map((size, i) => ({
      sku: `CHK-TP-TS-00${i + 1}`,
      size,
      color: 'Sage',
      priceInPaise: 59900,
      discountPriceInPaise: 44900,
      stockQty: 50,
    })),
  },
  {
    name: 'High-Waist Slim Jeans — Mid Blue',
    slug: 'high-waist-slim-jeans-mid-blue',
    categorySlug: 'jeans',
    description: 'High-waist slim-fit jeans in mid blue with stretch denim for all-day comfort.',
    attributes: { Fabric: 'Stretch Denim', Rise: 'High', Fit: 'Slim' },
    images: [{ url: '/images/products/jeans-midblue-1.jpg', alt: 'Mid blue high waist slim jeans' }],
    variants: ['26', '28', '30', '32', '34'].map((size, i) => ({
      sku: `CHK-BW-JN-00${i + 1}`,
      size,
      color: 'Mid Blue',
      priceInPaise: 179900,
      discountPriceInPaise: 139900,
      stockQty: 20,
    })),
  },
  {
    name: 'Korean Wide-Leg Pants — Cream',
    slug: 'korean-wide-leg-pants-cream',
    badge: 'Trending',
    categorySlug: 'korean-pants',
    description: 'Trending Korean-style wide-leg trousers in cream with pressed pleats and elastic-back waist.',
    attributes: { Fabric: 'Poly-Viscose', Fit: 'Wide Leg' },
    images: [{ url: '/images/products/korean-cream-1.jpg', alt: 'Cream Korean wide leg pants' }],
    variants: SIZES.map((size, i) => ({
      sku: `CHK-BW-KP-00${i + 1}`,
      size,
      color: 'Cream',
      priceInPaise: 129900,
      discountPriceInPaise: 99900,
      stockQty: 30,
    })),
  },
  {
    name: 'Everyday Cotton Pants — Olive',
    slug: 'everyday-cotton-pants-olive',
    categorySlug: 'cotton-pants',
    description: 'Relaxed straight-fit cotton pants in olive with drawstring waist — breathable and durable.',
    attributes: { Fabric: '100% Cotton Twill', Fit: 'Straight' },
    images: [{ url: '/images/products/cottonpants-olive-1.jpg', alt: 'Olive cotton pants' }],
    variants: SIZES.map((size, i) => ({
      sku: `CHK-BW-CP-00${i + 1}`,
      size,
      color: 'Olive',
      priceInPaise: 109900,
      discountPriceInPaise: 84900,
      stockQty: 26,
    })),
  },
  {
    name: 'Performance Track Pants — Charcoal',
    slug: 'performance-track-pants-charcoal',
    categorySlug: 'track-pants',
    description: 'Quick-dry track pants in charcoal with zip pockets and tapered ankle.',
    attributes: { Fabric: 'Poly Dry-Fit', Fit: 'Tapered' },
    images: [{ url: '/images/products/trackpants-charcoal-1.jpg', alt: 'Charcoal track pants' }],
    variants: SIZES.map((size, i) => ({
      sku: `CHK-BW-TP-00${i + 1}`,
      size,
      color: 'Charcoal',
      priceInPaise: 89900,
      discountPriceInPaise: 69900,
      stockQty: 32,
    })),
  },
  {
    name: 'Antique Temple Necklace Set — Lakshmi Coin',
    slug: 'antique-temple-necklace-lakshmi-coin',
    badge: 'Handcrafted',
    categorySlug: 'antique-imitation-jewellery',
    description:
      'Antique-finish temple jewellery necklace set with Lakshmi coin motifs, matching jhumkas included. Skin-friendly copper alloy with matte gold plating.',
    attributes: { Material: 'Copper Alloy, Matte Gold Plating', Includes: 'Necklace + Jhumkas', Occasion: 'Festive / Bridal' },
    images: [{ url: '/images/products/jewel-lakshmi-1.jpg', alt: 'Antique temple necklace set with Lakshmi coins' }],
    variants: [
      { sku: 'CHK-JW-TN-001', color: 'Antique Gold', weightGrams: 120, priceInPaise: 159900, discountPriceInPaise: 129900, stockQty: 18 },
    ],
  },
  {
    name: 'Oxidised Silver Chandbali Earrings',
    slug: 'oxidised-silver-chandbali-earrings',
    categorySlug: 'antique-imitation-jewellery',
    description: 'Statement chandbali earrings in oxidised silver finish with pearl drops. Lightweight and hypoallergenic hooks.',
    attributes: { Material: 'German Silver', Finish: 'Oxidised', Occasion: 'Festive / Ethnic' },
    images: [{ url: '/images/products/jewel-chandbali-1.jpg', alt: 'Oxidised silver chandbali earrings' }],
    variants: [
      { sku: 'CHK-JW-CB-001', color: 'Oxidised Silver', weightGrams: 40, priceInPaise: 69900, discountPriceInPaise: 49900, stockQty: 40 },
    ],
  },

  // --- Kurtis & Suit Sets ---------------------------------------------------
  {
    name: 'Floral Anarkali Suit Set — Wine',
    slug: 'floral-anarkali-suit-set-wine',
    badge: 'New',
    categorySlug: 'anarkali',
    description:
      'Floor-length Anarkali in wine georgette with all-over floral print, matching churidar and a chiffon dupatta. Fully lined bodice with a flared silhouette that moves beautifully.',
    attributes: { Fabric: 'Georgette', Occasion: 'Festive / Party', Set: 'Kurta + Churidar + Dupatta', Care: 'Dry clean' },
    images: [{ url: '', alt: 'Wine floral Anarkali suit set' }],
    variants: SIZES.map((size, i) => ({
      sku: `CHK-KS-AN-00${i + 1}`,
      size,
      color: 'Wine',
      priceInPaise: 349900,
      discountPriceInPaise: 279900,
      stockQty: 14,
    })),
  },
  {
    name: 'Chikankari Palazzo Set — Powder Blue',
    slug: 'chikankari-palazzo-set-powder-blue',
    categorySlug: 'palazzo-set',
    description:
      'Hand-embroidered chikankari kurta in powder blue with wide-leg palazzos and a matching dupatta. Breathable cotton for long festive days.',
    attributes: { Fabric: 'Cotton', Work: 'Chikankari', Set: 'Kurta + Palazzo + Dupatta' },
    images: [{ url: '', alt: 'Powder blue chikankari palazzo set' }],
    variants: SIZES.map((size, i) => ({
      sku: `CHK-KS-PZ-00${i + 1}`,
      size,
      color: 'Powder Blue',
      priceInPaise: 269900,
      discountPriceInPaise: 219900,
      stockQty: 18,
    })),
  },

  // --- Lehengas -------------------------------------------------------------
  {
    name: 'Bridal Lehenga — Crimson Zardozi',
    slug: 'bridal-lehenga-crimson-zardozi',
    badge: 'Bridal Edit',
    categorySlug: 'bridal-lehenga',
    description:
      'Heirloom bridal lehenga in crimson raw silk with hand-done zardozi and sequin work, a matching blouse piece and a net dupatta with scalloped edging.',
    attributes: { Fabric: 'Raw Silk', Work: 'Zardozi Hand Embroidery', Occasion: 'Wedding', Set: 'Lehenga + Blouse + Dupatta' },
    images: [{ url: '', alt: 'Crimson bridal lehenga with zardozi work' }],
    variants: SIZES.map((size, i) => ({
      sku: `CHK-LH-BR-00${i + 1}`,
      size,
      color: 'Crimson',
      weightGrams: 2200,
      priceInPaise: 2499900,
      discountPriceInPaise: 1999900,
      stockQty: 4,
    })),
  },
  {
    name: 'Festive Lehenga — Mustard Mirror Work',
    slug: 'festive-lehenga-mustard-mirror',
    categorySlug: 'festive-lehenga',
    description:
      'Lightweight festive lehenga in mustard with mirror and thread work, paired with a cropped blouse and organza dupatta. Made for dancing.',
    attributes: { Fabric: 'Cotton Silk', Work: 'Mirror & Thread', Occasion: 'Festive / Sangeet' },
    images: [{ url: '', alt: 'Mustard festive lehenga with mirror work' }],
    variants: SIZES.map((size, i) => ({
      sku: `CHK-LH-FS-00${i + 1}`,
      size,
      color: 'Mustard',
      weightGrams: 1400,
      priceInPaise: 649900,
      discountPriceInPaise: 499900,
      stockQty: 9,
    })),
  },

  // --- Blouses --------------------------------------------------------------
  {
    name: 'Designer Blouse — Gold Brocade',
    slug: 'designer-blouse-gold-brocade',
    categorySlug: 'designer-blouse',
    description:
      'Elbow-sleeve brocade blouse in antique gold with a deep back and potli-button fastening. Pairs with pattu and Banarasi drapes.',
    attributes: { Fabric: 'Brocade', Sleeve: 'Elbow', Lining: 'Cotton', Care: 'Dry clean' },
    images: [{ url: '', alt: 'Gold brocade designer blouse' }],
    variants: SIZES.map((size, i) => ({
      sku: `CHK-BL-DS-00${i + 1}`,
      size,
      color: 'Antique Gold',
      priceInPaise: 149900,
      discountPriceInPaise: 119900,
      stockQty: 20,
    })),
  },

  // --- Dupattas & Stoles ----------------------------------------------------
  {
    name: 'Banarasi Dupatta — Antique Gold',
    slug: 'banarasi-dupatta-antique-gold',
    categorySlug: 'banarasi-dupatta',
    description:
      'Handwoven Banarasi dupatta with antique gold zari buttis and a rich border. The quickest way to lift a plain kurta into festive wear.',
    attributes: { Fabric: 'Banarasi Silk', Length: '2.5 m', Work: 'Zari Weave' },
    images: [{ url: '', alt: 'Antique gold Banarasi dupatta' }],
    variants: [
      { sku: 'CHK-DP-BN-001', color: 'Antique Gold', weightGrams: 250, priceInPaise: 189900, discountPriceInPaise: 149900, stockQty: 16 },
      { sku: 'CHK-DP-BN-002', color: 'Rani Pink', weightGrams: 250, priceInPaise: 189900, discountPriceInPaise: 149900, stockQty: 12 },
    ],
  },

  // --- Bags & Clutches ------------------------------------------------------
  {
    name: 'Embroidered Potli Bag — Maroon Silk',
    slug: 'embroidered-potli-bag-maroon',
    categorySlug: 'potli-bags',
    description:
      'Drawstring potli in maroon silk with zari embroidery and beaded tassels. Roomy enough for a phone, cards and a lipstick.',
    attributes: { Material: 'Silk', Closure: 'Drawstring', Occasion: 'Wedding / Festive' },
    images: [{ url: '', alt: 'Maroon embroidered silk potli bag' }],
    variants: [
      { sku: 'CHK-BG-PT-001', color: 'Maroon', weightGrams: 180, priceInPaise: 99900, discountPriceInPaise: 74900, stockQty: 22 },
    ],
  },
  {
    name: 'Beaded Evening Clutch — Champagne',
    slug: 'beaded-evening-clutch-champagne',
    badge: 'New',
    categorySlug: 'clutches',
    description:
      'Hand-beaded box clutch in champagne with a detachable chain strap and a soft satin lining.',
    attributes: { Material: 'Beadwork on Satin', Strap: 'Detachable chain', Occasion: 'Party / Reception' },
    images: [{ url: '', alt: 'Champagne beaded evening clutch' }],
    variants: [
      { sku: 'CHK-BG-CL-001', color: 'Champagne', weightGrams: 320, priceInPaise: 139900, discountPriceInPaise: 109900, stockQty: 15 },
    ],
  },

  // --- Nightwear & Loungewear ----------------------------------------------
  {
    name: 'Cotton Night Suit — Blush Floral',
    slug: 'cotton-night-suit-blush-floral',
    categorySlug: 'night-suits',
    description:
      'Soft cotton night suit in blush with a ditsy floral print, button-down top and elasticated pyjama with pockets.',
    attributes: { Fabric: '100% Cotton', Set: 'Top + Pyjama', Care: 'Machine wash' },
    images: [{ url: '', alt: 'Blush floral cotton night suit' }],
    variants: SIZES.map((size, i) => ({
      sku: `CHK-NW-NS-00${i + 1}`,
      size,
      color: 'Blush',
      priceInPaise: 119900,
      discountPriceInPaise: 89900,
      stockQty: 26,
    })),
  },
  {
    name: 'Loungewear Co-ord — Oatmeal',
    slug: 'loungewear-coord-oatmeal',
    categorySlug: 'loungewear-sets',
    description:
      'Relaxed knit co-ord in oatmeal — a boxy tee and wide joggers that look put-together enough for the school run.',
    attributes: { Fabric: 'Cotton Knit', Set: 'Tee + Joggers', Fit: 'Relaxed' },
    images: [{ url: '', alt: 'Oatmeal loungewear co-ord set' }],
    variants: SIZES.map((size, i) => ({
      sku: `CHK-NW-LG-00${i + 1}`,
      size,
      color: 'Oatmeal',
      priceInPaise: 139900,
      discountPriceInPaise: 109900,
      stockQty: 20,
    })),
  },

  // --- Winter Wear ----------------------------------------------------------
  {
    name: 'Pashmina Shawl — Ivory Kani Weave',
    slug: 'pashmina-shawl-ivory-kani',
    badge: 'Handcrafted',
    categorySlug: 'shawls',
    description:
      'Feather-light pashmina shawl in ivory with a Kani-woven border. Warm without weight — folds down to nothing in a bag.',
    attributes: { Fabric: 'Pashmina Wool', Work: 'Kani Weave', Origin: 'Kashmir', Care: 'Dry clean' },
    images: [{ url: '', alt: 'Ivory pashmina shawl with Kani border' }],
    variants: [
      { sku: 'CHK-WW-SH-001', color: 'Ivory', weightGrams: 300, priceInPaise: 449900, discountPriceInPaise: 359900, stockQty: 11 },
    ],
  },

  // --- Sarees (new weaves) --------------------------------------------------
  {
    name: 'Georgette Saree — Blush Sequin',
    slug: 'georgette-saree-blush-sequin',
    categorySlug: 'georgette-saree',
    description:
      'Fluid georgette saree in blush with scattered sequin work and a satin edge. Drapes like water, weighs almost nothing.',
    attributes: { Fabric: 'Georgette', Work: 'Sequin', 'Blouse Piece': 'Included', Occasion: 'Cocktail / Reception' },
    images: [{ url: '', alt: 'Blush georgette saree with sequin work' }],
    variants: [
      { sku: 'CHK-SR-GG-001', color: 'Blush', weightGrams: 400, priceInPaise: 329900, discountPriceInPaise: 259900, stockQty: 13 },
      { sku: 'CHK-SR-GG-002', color: 'Sage', weightGrams: 400, priceInPaise: 329900, discountPriceInPaise: 259900, stockQty: 10 },
    ],
  },
];

async function main() {
  // --- RBAC roles -----------------------------------------------------------
  const opsManager = await prisma.staffRole.upsert({
    where: { name: 'Operations Manager' },
    update: {},
    create: {
      name: 'Operations Manager',
      description: 'Orders, shipments, returns, inventory',
      permissions: [
        'dashboard.view',
        'products.read',
        'inventory.read',
        'inventory.write',
        'orders.read',
        'orders.write',
        'returns.read',
        'returns.write',
        'shipments.read',
        'shipments.write',
        'customers.read',
        'payments.read',
      ],
    },
  });
  const catalogManagerPermissions = [
    'dashboard.view',
    'products.read',
    'products.write',
    'categories.write',
    'inventory.read',
    'inventory.write',
    'content.read',
    'content.write',
  ];
  await prisma.staffRole.upsert({
    where: { name: 'Catalog Manager' },
    // Merchandising moved into the admin, so this role is re-synced each run.
    update: { permissions: catalogManagerPermissions },
    create: {
      name: 'Catalog Manager',
      description: 'Products, categories, inventory, homepage content',
      permissions: catalogManagerPermissions,
    },
  });
  await prisma.staffRole.upsert({
    where: { name: 'Support Executive' },
    update: {},
    create: {
      name: 'Support Executive',
      description: 'Read-only orders & customers, manage returns',
      permissions: ['dashboard.view', 'orders.read', 'customers.read', 'returns.read', 'returns.write'],
    },
  });

  // --- Super admin ----------------------------------------------------------
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@chikbo.in';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe@123';
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Chikbo Admin',
      phone: '9346060635',
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: UserRole.SUPER_ADMIN,
    },
  });

  // Demo staff account (Operations Manager)
  await prisma.user.upsert({
    where: { email: 'ops@chikbo.in' },
    update: {},
    create: {
      email: 'ops@chikbo.in',
      name: 'Chikbo Ops',
      passwordHash: await bcrypt.hash('ChangeMe@123', 12),
      role: UserRole.STAFF,
      staffRoleId: opsManager.id,
    },
  });

  // --- Categories -----------------------------------------------------------
  const slugToCategoryId = new Map<string, string>();
  for (const [i, cat] of CATEGORIES.entries()) {
    const parent = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, sortOrder: i },
      create: { name: cat.name, slug: cat.slug, sortOrder: i },
    });
    slugToCategoryId.set(cat.slug, parent.id);
    for (const [j, child] of cat.children.entries()) {
      const c = await prisma.category.upsert({
        where: { slug: child.slug },
        update: { name: child.name, parentId: parent.id, sortOrder: j },
        create: { name: child.name, slug: child.slug, parentId: parent.id, sortOrder: j },
      });
      slugToCategoryId.set(child.slug, c.id);
    }
  }

  // --- Products -------------------------------------------------------------
  for (const p of PRODUCTS) {
    const categoryId = slugToCategoryId.get(p.categorySlug);
    if (!categoryId) throw new Error(`Unknown category slug ${p.categorySlug}`);
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: { name: p.name, description: p.description, categoryId, attributes: p.attributes, badge: p.badge ?? null },
      create: {
        name: p.name,
        slug: p.slug,
        description: p.description,
        categoryId,
        attributes: p.attributes,
        badge: p.badge ?? null,
      },
    });

    // Gallery is rewritten on every seed, so re-running picks up newly added
    // or replaced photographs for products that already exist.
    const imageFiles = imageFilesForSlug(p.slug);
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    if (imageFiles.length > 0) {
      await prisma.productImage.createMany({
        data: imageFiles.map((file, i) => ({
          productId: product.id,
          url: `/uploads/products/${file}`,
          alt: i === 0 ? p.images[0]?.alt ?? p.name : `${p.name} — view ${i + 1}`,
          sortOrder: i,
        })),
      });
    }
    for (const v of p.variants) {
      await prisma.productVariant.upsert({
        where: { sku: v.sku },
        update: {
          priceInPaise: v.priceInPaise,
          discountPriceInPaise: v.discountPriceInPaise ?? null,
        },
        create: {
          productId: product.id,
          sku: v.sku,
          size: v.size ?? null,
          color: v.color ?? null,
          weightGrams: v.weightGrams ?? null,
          priceInPaise: v.priceInPaise,
          discountPriceInPaise: v.discountPriceInPaise ?? null,
          stockQty: v.stockQty,
        },
      });
    }
  }

  // --- Homepage CMS ---------------------------------------------------------
  // Rebuilt on every seed so the storefront always has a full homepage, and so
  // re-seeding never leaves duplicate sections behind.
  await prisma.homeSectionItem.deleteMany({});
  await prisma.homeSection.deleteMany({});

  interface SeedSectionItem {
    imageUrl?: string | null;
    mobileImageUrl?: string | null;
    title?: string;
    subtitle?: string;
    ctaLabel?: string;
    href?: string;
  }
  interface SeedSection {
    type: HomeSectionType;
    title?: string;
    subtitle?: string;
    config?: Record<string, unknown>;
    items?: SeedSectionItem[];
  }

  const HOME_SECTIONS: SeedSection[] = [
    {
      type: HomeSectionType.HERO_CAROUSEL,
      items: [
        {
          imageUrl: productImageUrl('kanchipuram-pattu-silk-maroon-zari', 1),
          mobileImageUrl: productImageUrl('kanchipuram-pattu-silk-maroon-zari', 2),
          title: 'The Wedding Edit',
          subtitle: 'Handwoven pattu silks, straight from the loom',
          ctaLabel: 'Shop sarees',
          href: '/c/sarees',
        },
        {
          imageUrl: productImageUrl('two-piece-rose-pink-anarkali-set', 1),
          mobileImageUrl: productImageUrl('two-piece-rose-pink-anarkali-set', 2),
          title: 'Festive Ready',
          subtitle: 'Anarkali sets and chanderi three-pieces',
          ctaLabel: 'Shop dresses',
          href: '/c/dresses',
        },
        {
          imageUrl: productImageUrl('korean-wide-leg-pants-cream', 1),
          mobileImageUrl: productImageUrl('korean-wide-leg-pants-cream', 2),
          title: 'Everyday Ease',
          subtitle: 'Korean pants, crop tops and cotton kurtis',
          ctaLabel: 'Shop new in',
          href: '/c/bottomwear',
        },
      ],
    },
    {
      type: HomeSectionType.CATEGORY_RAIL,
      title: 'Shop by category',
      // Tiles intentionally carry no image: the API falls back to each
      // category's own image, edited under Catalog -> Categories.
      items: [
        { title: 'Sarees', href: '/c/sarees' },
        { title: 'Kurtis & Suits', href: '/c/kurtis-suit-sets' },
        { title: 'Lehengas', href: '/c/lehengas' },
        { title: 'Dresses', href: '/c/dresses' },
        { title: 'Tops', href: '/c/tops' },
        { title: 'Bottomwear', href: '/c/bottomwear' },
        { title: 'Blouses', href: '/c/blouses' },
        { title: 'Dupattas', href: '/c/dupattas-stoles' },
        {
          title: 'Jewellery',
          href: '/c/antique-imitation-jewellery',
        },
        { title: 'Bags', href: '/c/bags-clutches' },
        { title: 'Nightwear', href: '/c/nightwear-loungewear' },
        { title: 'Winter', href: '/c/winter-wear' },
      ],
    },
    {
      type: HomeSectionType.CATEGORY_CARDS,
      title: 'Hot & happening',
      subtitle: 'The edits our customers are reaching for this week',
      items: [
        {
          title: 'Pattu & Banarasi',
          subtitle: 'Heirloom silks',
          ctaLabel: 'Explore',
          href: '/c/sarees',
          imageUrl: productImageUrl('banarasi-silk-saree-emerald-meenakari', 1),
        },
        {
          title: 'Kurtis & Tops',
          subtitle: 'Block prints & chikankari',
          ctaLabel: 'Explore',
          href: '/c/tops',
          imageUrl: productImageUrl('long-kurti-navy-chikankari', 1),
        },
        {
          title: 'Denim & Pants',
          subtitle: 'Wear-everywhere fits',
          ctaLabel: 'Explore',
          href: '/c/bottomwear',
          imageUrl: productImageUrl('everyday-cotton-pants-olive', 1),
        },
        {
          title: 'Antique Jewellery',
          subtitle: 'Temple & oxidised',
          ctaLabel: 'Explore',
          href: '/c/antique-imitation-jewellery',
          imageUrl: productImageUrl('oxidised-silver-chandbali-earrings', 1),
        },
      ],
    },
    {
      type: HomeSectionType.BANNER_GRID,
      title: 'Offers on now',
      items: [
        {
          title: 'Silk Saree Festival',
          subtitle: 'Up to 25% off',
          ctaLabel: 'Grab the deal',
          href: '/c/sarees',
          imageUrl: productImageUrl('kanchipuram-pattu-silk-maroon-zari', 3),
        },
        {
          title: 'Everyday Basics',
          subtitle: 'Min 25% off',
          ctaLabel: 'Shop tops',
          href: '/c/tops',
          imageUrl: productImageUrl('classic-cotton-tshirt-sage', 1),
        },
        {
          title: 'First order? Take 10% off',
          subtitle: 'Use code WELCOME10',
          ctaLabel: 'Start shopping',
          href: '/c/dresses',
          imageUrl: productImageUrl('two-piece-rose-pink-anarkali-set', 3),
        },
      ],
    },
    {
      type: HomeSectionType.PRODUCT_CAROUSEL,
      title: 'In the spotlight',
      subtitle: 'Fresh off the loom',
      config: { source: 'newest', limit: 12 },
    },
    {
      type: HomeSectionType.PRODUCT_CAROUSEL,
      title: 'Hidden gems in sarees',
      subtitle: 'Handpicked drapes from our weavers',
      config: { source: 'category', categorySlug: 'sarees', limit: 12 },
    },
  ];

  for (const [i, section] of HOME_SECTIONS.entries()) {
    await prisma.homeSection.create({
      data: {
        type: section.type,
        title: section.title ?? null,
        subtitle: section.subtitle ?? null,
        sortOrder: i,
        config: section.config ?? undefined,
        items: {
          create: (section.items ?? []).map((item, j) => ({
            imageUrl: item.imageUrl ?? null,
            mobileImageUrl: item.mobileImageUrl ?? null,
            title: item.title ?? null,
            subtitle: item.subtitle ?? null,
            ctaLabel: item.ctaLabel ?? null,
            href: item.href ?? null,
            sortOrder: j,
          })),
        },
      },
    });
  }

  // --- Launch coupon --------------------------------------------------------
  await prisma.coupon.upsert({
    where: { code: 'WELCOME10' },
    update: {},
    create: {
      code: 'WELCOME10',
      type: CouponType.PERCENT,
      value: 1000, // 10%
      minOrderInPaise: 99900,
      maxDiscountInPaise: 50000,
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2027-12-31'),
      perUserLimit: 1,
    },
  });

  console.log(
    `Seed complete: categories, products, roles, admin (${adminEmail}), coupon WELCOME10, ` +
      `${HOME_SECTIONS.length} homepage sections`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
