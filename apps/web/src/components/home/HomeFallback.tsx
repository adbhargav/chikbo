/**
 * Hand-built "Atelier" home sections — the fallback surface.
 *
 * The storefront home is CMS-driven (`GET /catalog/home`). While that endpoint
 * is unavailable, returns nothing, or errors, these original sections render
 * instead so the page is never blank. Live catalog data drives the category
 * chip rail, the editorial grid and the arrivals rail.
 */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import type { CategoryDto } from '@chikbo/shared';
import { useCategories, useProducts } from '../../lib/queries';
import { useToast } from '../../lib/toast';
import { useSmoothScroll } from '../../lib/lenis';
import { EMAIL_RE } from '../../lib/format';
import { CountUp, EASE, Magnetic, MaskLines, Reveal, useMotionOK, useStaggerVariants } from '../../lib/motion';
import { ProductCard, ProductCardSkeleton } from '../ProductCard';
import { SilkArt, PaisleyMotif } from '../SilkArt';
import { EditorialImage } from '../EditorialImage';
import { EDITORIAL, categoryImage } from '../../lib/editorial';
import { Carousel } from '../Carousel';
import '../../styles/home.css';

/* ------------------------------------------------------------------- Hero */

function Hero() {
  const ok = useMotionOK();
  const heroRef = useRef<HTMLElement>(null);
  const { scrollTo } = useSmoothScroll();

  // Mouse parallax (±8px, spring).
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const px = useSpring(mx, { stiffness: 60, damping: 18 });
  const py = useSpring(my, { stiffness: 60, damping: 18 });

  // Scroll parallax — the art trails the scroll.
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const artY = useTransform(scrollYProgress, [0, 1], ['0%', ok ? '15%' : '0%']);
  const copyY = useTransform(scrollYProgress, [0, 1], ['0%', ok ? '30%' : '0%']);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, ok ? 0.2 : 1]);

  const onMove = (e: React.PointerEvent) => {
    if (!ok || e.pointerType !== 'mouse' || !heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    mx.set(((e.clientX - rect.left) / rect.width - 0.5) * 16);
    my.set(((e.clientY - rect.top) / rect.height - 0.5) * 16);
  };

  return (
    <section
      className="hero"
      ref={heroRef}
      onPointerMove={onMove}
      onPointerLeave={() => {
        mx.set(0);
        my.set(0);
      }}
    >
      <motion.div className="hero-art" style={{ y: artY, x: px, rotate: 0 }} aria-hidden="true">
        <motion.div className="hero-art-kenburns" style={{ y: py }}>
          <EditorialImage
            src={EDITORIAL.hero}
            alt="Handwoven silk sarees from the Chikbo collection"
            seed="chikbo-hero-sarees"
            category="sarees"
            className="hero-silk"
            loading="eager"
            fetchPriority="high"
            objectPosition="center"
          />
        </motion.div>
        <div className="hero-scrim" />
      </motion.div>

      <motion.div className="container hero-inner" style={{ y: copyY, opacity: fade }}>
        <div className="hero-copy">
          <motion.span
            className="overline overline--hero"
            initial={{ opacity: 0, y: ok ? 14 : 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
          >
            Since 1992 · Hyderabad
          </motion.span>
          <h1 className="hero-title">
            <MaskLines
              delay={0.25}
              lines={[
                <>Woven with trust,</>,
                <>
                  worn with <em>pride.</em>
                </>,
              ]}
            />
          </h1>
          <motion.p
            className="hero-sub"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.75 }}
          >
            Three decades of textiles, now at your doorstep. Handpicked sarees, dresses and antique
            jewellery — quality checked, budget friendly.
          </motion.p>
          <motion.div
            className="hero-ctas"
            initial={{ opacity: 0, y: ok ? 16 : 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.9, ease: EASE }}
          >
            <Magnetic>
              <Link to="/c/sarees" className="btn btn-primary btn-lg">
                Shop Sarees
              </Link>
            </Magnetic>
            <Magnetic>
              <a
                href="#new-arrivals"
                className="btn btn-hero-ghost btn-lg"
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo('#new-arrivals', { offset: -90 });
                }}
              >
                New Arrivals
              </a>
            </Magnetic>
          </motion.div>
        </div>
      </motion.div>

      <div className="hero-cue" aria-hidden="true">
        <span className="hero-cue-line" />
        <span className="hero-cue-label">Scroll</span>
      </div>
    </section>
  );
}

/* ------------------------------------------------------- Heritage marquee */

const MARQUEE_WORDS = [
  'Pattu Silk',
  'Banarasi',
  'Kanjivaram',
  'Since 1992',
  'Handpicked',
  'Zari Work',
  'Chanderi',
  'Woven with pride',
];

function HeritageMarquee() {
  const row = (reverse: boolean, offset: number) => (
    <div className={`ghost-marquee-row${reverse ? ' ghost-marquee-row--reverse' : ''}`}>
      <div className="ghost-marquee-track">
        {[0, 1].map((copy) => (
          <span key={copy} className="ghost-marquee-copy" aria-hidden={copy === 1}>
            {MARQUEE_WORDS.slice(offset)
              .concat(MARQUEE_WORDS.slice(0, offset))
              .map((word, i) => (
                <span key={i} className="ghost-word">
                  {word}
                  <span className="ghost-sep" aria-hidden="true">
                    —
                  </span>
                </span>
              ))}
          </span>
        ))}
      </div>
    </div>
  );
  return (
    <section className="ghost-marquee" aria-label="Chikbo heritage crafts">
      {row(false, 0)}
      {row(true, 3)}
    </section>
  );
}

/* ---------------------------------------------------------- Category grid */

function CategoryGrid({ categories }: { categories: CategoryDto[] }) {
  const { parent, child } = useStaggerVariants(0.09, 30);
  return (
    <section className="home-section" aria-labelledby="shop-by-category">
      <div className="container">
        <Reveal>
          <div className="section-head">
            <div>
              <span className="overline">The Collection</span>
              <h2 id="shop-by-category">Shop by category</h2>
            </div>
          </div>
        </Reveal>
        <motion.div
          className="edit-grid"
          variants={parent}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px 0px' }}
        >
          {categories.length > 0
            ? categories.slice(0, 5).map((cat, i) => (
                <motion.div key={cat.id} className={`edit-cell edit-cell--${i + 1}`} variants={child}>
                  <Link to={`/c/${cat.slug}`} className="edit-tile">
                    {categoryImage(cat.slug) ? (
                      <EditorialImage
                        src={categoryImage(cat.slug) as string}
                        alt={`${cat.name} at Chikbo`}
                        seed={cat.slug}
                        category={cat.slug}
                        className="edit-tile-art"
                      />
                    ) : (
                      <SilkArt seed={cat.slug} category={cat.slug} className="edit-tile-art" showLabel={false} />
                    )}
                    <span className="card-sheen" aria-hidden="true" />
                    <span className="edit-tile-index" aria-hidden="true">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="edit-tile-name">{cat.name}</span>
                    <span className="edit-tile-arrow" aria-hidden="true">
                      →
                    </span>
                  </Link>
                </motion.div>
              ))
            : Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`edit-cell edit-cell--${i + 1}`} aria-hidden="true">
                  <div className="edit-tile skeleton" />
                </div>
              ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Stats strip */

const STATS = [
  { value: 34, suffix: '+', label: 'Years of textiles' },
  { value: 5000, suffix: '+', label: 'Happy drapes' },
  { value: 25, suffix: '+', label: 'Cities served' },
  { value: 4.9, decimals: 1, suffix: '', label: 'Average rating' },
];

function StatsStrip() {
  const { parent, child } = useStaggerVariants(0.1, 20);
  return (
    <section className="stats-strip" aria-label="Chikbo in numbers">
      <PaisleyMotif className="stats-paisley stats-paisley--a" />
      <PaisleyMotif className="stats-paisley stats-paisley--b" flip />
      <motion.div
        className="container stats-grid"
        variants={parent}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px 0px' }}
      >
        {STATS.map((stat) => (
          <motion.div className="stat" key={stat.label} variants={child}>
            <span className="stat-number">
              <CountUp to={stat.value} decimals={stat.decimals ?? 0} suffix={stat.suffix} />
            </span>
            <span className="stat-label">{stat.label}</span>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

/* --------------------------------------------------------- Arrivals rail */

function ArrivalsRail() {
  const newArrivals = useProducts({ sort: 'newest', pageSize: 8, page: 1 });
  const ok = useMotionOK();
  const railRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const tiltRaw = useMotionValue(0);
  const tilt = useSpring(tiltRaw, { stiffness: 120, damping: 18 });
  const dragState = useRef<{ down: boolean; startX: number; startLeft: number; moved: boolean }>({
    down: false,
    startX: 0,
    startLeft: 0,
    moved: false,
  });

  const onScroll = () => {
    const el = railRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setProgress(max > 0 ? el.scrollLeft / max : 0);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || !railRef.current) return;
    dragState.current = {
      down: true,
      startX: e.clientX,
      startLeft: railRef.current.scrollLeft,
      moved: false,
    };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const st = dragState.current;
    const el = railRef.current;
    if (!st.down || !el) return;
    const dx = e.clientX - st.startX;
    if (Math.abs(dx) > 6) {
      st.moved = true;
      el.setPointerCapture?.(e.pointerId);
    }
    el.scrollLeft = st.startLeft - dx;
    if (ok) tiltRaw.set(Math.max(-2, Math.min(2, -dx * 0.03)));
  };
  const endDrag = () => {
    dragState.current.down = false;
    tiltRaw.set(0);
  };
  const suppressClick = (e: React.MouseEvent) => {
    if (dragState.current.moved) {
      e.preventDefault();
      dragState.current.moved = false;
    }
  };

  return (
    <section className="home-section" id="new-arrivals" aria-labelledby="new-arrivals-title">
      <div className="container">
        <Reveal>
          <div className="section-head">
            <div>
              <span className="overline">Just In</span>
              <h2 id="new-arrivals-title">New Arrivals</h2>
            </div>
            <Link to="/search?sort=newest&q=" className="section-link">
              View all →
            </Link>
          </div>
        </Reveal>
        <div
          className="rail"
          role="list"
          ref={railRef}
          onScroll={onScroll}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          onClickCapture={suppressClick}
        >
          {newArrivals.isPending &&
            Array.from({ length: 4 }).map((_, i) => (
              <div className="rail-item" key={i}>
                <ProductCardSkeleton />
              </div>
            ))}
          {newArrivals.data?.items.map((product) => (
            <motion.div className="rail-item" role="listitem" key={product.id} style={{ rotate: tilt }}>
              <ProductCard product={product} />
            </motion.div>
          ))}
          {newArrivals.isError && <p className="muted">New arrivals are resting. Please check back soon.</p>}
        </div>
        <div className="rail-progress" aria-hidden="true">
          <div className="rail-progress-fill" style={{ transform: `scaleX(${Math.max(0.06, progress)})` }} />
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------- Split editorial */

function SplitEditorial() {
  const ok = useMotionOK();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] });
  const yA = useTransform(scrollYProgress, [0, 1], [ok ? 60 : 0, ok ? -60 : 0]);
  const yB = useTransform(scrollYProgress, [0, 1], [ok ? 120 : 0, ok ? -40 : 0]);

  return (
    <section className="editorial" ref={sectionRef} aria-labelledby="editorial-title">
      <div className="container editorial-inner">
        <div className="editorial-copy">
          <div className="editorial-sticky">
            <Reveal>
              <span className="overline">The Chikbo story</span>
            </Reveal>
            <h2 id="editorial-title" className="editorial-title">
              <MaskLines lines={[<>Three decades,</>, <>one promise.</>]} />
            </h2>
            <motion.span
              className="editorial-rule"
              aria-hidden="true"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, margin: '-80px 0px' }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.2 }}
            />
            <Reveal delay={0.25}>
              <p>
                It began in 1992 with a single counter of hand-picked pattu in Rikab Gunj, Hyderabad.
                Today the same three rules choose every weave that carries our name — trust in the
                maker, quality in the thread, a price that respects your budget.
              </p>
              <p>
                From everyday cottons to occasion-ready silks, each piece is inspected by hand before
                it travels to your doorstep, anywhere in India.
              </p>
              <Link to="/c/sarees" className="btn btn-secondary editorial-cta">
                Explore the Saree Edit
              </Link>
            </Reveal>
          </div>
        </div>
        <div className="editorial-panels" aria-hidden="true">
          <motion.div className="editorial-panel" style={{ y: yA }}>
            <EditorialImage
              src={EDITORIAL.story1}
              alt="Chikbo silk saree detail — zari border"
              seed="editorial-silk-a"
              category="sarees"
              className="editorial-panel-art"
            />
          </motion.div>
          <motion.div className="editorial-panel editorial-panel--offset" style={{ y: yB }}>
            <EditorialImage
              src={EDITORIAL.story2}
              alt="Chikbo antique imitation jewellery"
              seed="editorial-silk-b"
              category="jewellery"
              className="editorial-panel-art"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Testimonials */

const TESTIMONIALS = [
  {
    quote: 'The pattu saree looked richer in person than in the pictures. My mother thought I paid three times the price.',
    name: 'Lakshmi R., Chennai',
  },
  {
    quote: 'Ordered on Tuesday, draped by Saturday. The quality check slip inside the box is such a lovely old-school touch.',
    name: 'Ananya S., Pune',
  },
  {
    quote: 'Their jewellery photographs do it no justice — the antique finish is stunning. Third order this year.',
    name: 'Meera K., Hyderabad',
  },
  {
    quote: 'A shop that still feels like family runs it. They called to confirm my blouse colour before dispatch.',
    name: 'Farida B., Lucknow',
  },
];

function Testimonials() {
  const ok = useMotionOK();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!ok) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % TESTIMONIALS.length), 6000);
    return () => window.clearInterval(id);
  }, [ok]);

  const active = TESTIMONIALS[index];

  return (
    <section className="testimonials home-section" aria-label="What customers say">
      <div className="container testimonials-inner">
        <Reveal>
          <span className="overline">Word of mouth</span>
        </Reveal>
        <div className="testimonial-stage" aria-live="polite">
          <AnimatePresence mode="wait">
            <motion.figure
              key={index}
              initial={{ opacity: 0, y: ok ? 14 : 0 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: ok ? -10 : 0 }}
              transition={{ duration: 0.6, ease: EASE }}
              className="testimonial"
            >
              <span className="testimonial-stars" aria-hidden="true">
                ★★★★★
              </span>
              <blockquote>“{active.quote}”</blockquote>
              <figcaption>{active.name}</figcaption>
            </motion.figure>
          </AnimatePresence>
        </div>
        <div className="testimonial-dots" role="tablist" aria-label="Choose testimonial">
          {TESTIMONIALS.map((t, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Testimonial from ${t.name}`}
              className={`testimonial-dot${i === index ? ' testimonial-dot--active' : ''}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- Newsletter */

function Newsletter() {
  const toast = useToast();
  const [email, setEmail] = useState('');

  const subscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      toast.show('Please enter a valid email address.', 'error');
      return;
    }
    setEmail('');
    toast.show("You're on the list. Welcome to Chikbo.", 'success');
  };

  return (
    <section className="newsletter home-section" aria-labelledby="newsletter-title">
      <div className="container newsletter-inner">
        <Reveal>
          <span className="overline">Stay in the loop</span>
          <h2 id="newsletter-title">First to know, first to wear</h2>
          <p className="muted newsletter-sub">
            New drops, restocks and member-only offers. No noise, we promise.
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <form className="newsletter-form" onSubmit={subscribe}>
            <label htmlFor="newsletter-email" className="visually-hidden">
              Email address
            </label>
            <span className="newsletter-field">
              <input
                id="newsletter-email"
                type="email"
                className="newsletter-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <span className="newsletter-underline" aria-hidden="true" />
            </span>
            <Magnetic>
              <button type="submit" className="btn btn-primary btn-lg">
                Subscribe
              </button>
            </Magnetic>
          </form>
        </Reveal>
      </div>
    </section>
  );
}



/* ----------------------------------------------------- Category chip rail */

/** Circular category chips — the marketplace rail, driven by live categories. */
function CategoryChips({ categories }: { categories: CategoryDto[] }) {
  const chips = categories
    .flatMap((cat) => [cat, ...(cat.children ?? [])])
    .slice(0, 12);
  if (chips.length === 0) return null;
  return (
    <section className="home-band home-band--tight" aria-label="Shop by category">
      <div className="container">
        <Carousel ariaLabel="Shop by category" trackClassName="crsl-track--chips">
          {chips.map((cat) => (
            <div className="crsl-item crsl-item--chip" key={cat.id}>
              <Link to={`/c/${cat.slug}`} className="cat-chip">
                <span className="cat-chip-ring">
                  <SilkArt seed={cat.slug} category={cat.slug} showLabel={false} className="cat-chip-art" />
                </span>
                <span className="cat-chip-label">{cat.name}</span>
              </Link>
            </div>
          ))}
        </Carousel>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Shop the edit */

/**
 * Offer tiles. Deliberately factual — every label is a real, working query, not
 * an invented discount. Staff replace these with authored BANNER_GRID sections.
 */
const EDIT_TILES = [
  { deal: 'Under ₹999', title: 'Everyday budget picks', href: '/search?maxPrice=999', seed: 'edit-budget', category: 'tops' },
  { deal: 'Just in', title: 'This week’s new arrivals', href: '/search?sort=newest', seed: 'edit-new', category: 'dresses' },
  { deal: 'Festive edit', title: 'Silks & pattu sarees', href: '/c/sarees', seed: 'edit-festive', category: 'sarees' },
];

function ShopTheEdit() {
  return (
    <section className="home-band" aria-labelledby="shop-the-edit">
      <div className="container">
        <div className="band-head">
          <div>
            <span className="overline">Handpicked</span>
            <h2 className="band-title" id="shop-the-edit">
              Shop the edit
            </h2>
          </div>
        </div>
        <div className="banner-grid" style={{ '--banner-cols': '3' } as CSSProperties}>
          {EDIT_TILES.map((tile) => (
            <Link to={tile.href} className="banner-tile" key={tile.seed}>
              <SilkArt seed={tile.seed} category={tile.category} showLabel={false} className="banner-art" />
              <span className="banner-scrim" aria-hidden="true" />
              <span className="banner-copy">
                <span className="banner-deal">{tile.deal}</span>
                <span className="banner-title">{tile.title}</span>
                <span className="banner-cta">
                  Shop now <span aria-hidden="true">→</span>
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------- Fallback home surface */

export function HomeFallback() {
  const { data: categories } = useCategories();
  const topCategories = (categories ?? []).filter((c) => !c.parentId).slice(0, 5);

  return (
    <>
      <Hero />
      <HeritageMarquee />
      <CategoryChips categories={categories ?? []} />
      <CategoryGrid categories={topCategories} />
      <ArrivalsRail />
      <ShopTheEdit />
      <StatsStrip />
      <SplitEditorial />
      <Testimonials />
      <Newsletter />
    </>
  );
}
