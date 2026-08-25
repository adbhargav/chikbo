import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE, useMotionOK } from '../../lib/motion';
import { configNumber, sortedItems } from '../../lib/home';
import type { HomeSectionDto, HomeSectionItemDto } from '../../lib/home';
import { CmsImage } from './CmsImage';
import { SmartLink } from '../SmartLink';
import { ChevronLeft, ChevronRight } from '../Carousel';

const DEFAULT_INTERVAL = 6000;

function SlideBody({ item, index }: { item: HomeSectionItemDto; index: number }) {
  return (
    <>
      <CmsImage
        url={item.imageUrl}
        mobileUrl={item.mobileImageUrl}
        alt={item.title ? `${item.title} — Chikbo` : 'Chikbo featured collection'}
        decorative
        seed={item.id || `hero-${index}`}
        category={item.title}
        className="hero-slide-art"
        loading={index === 0 ? 'eager' : 'lazy'}
        fetchPriority={index === 0 ? 'high' : undefined}
      />
      <span className="hero-slide-scrim" aria-hidden="true" />
      {(item.title || item.subtitle || item.ctaLabel) && (
        <span className="hero-slide-copy">
          {item.title && <span className="hero-slide-title">{item.title}</span>}
          {item.subtitle && <span className="hero-slide-sub">{item.subtitle}</span>}
          {item.ctaLabel && <span className="btn btn-primary hero-slide-cta">{item.ctaLabel}</span>}
        </span>
      )}
    </>
  );
}

/** Full-bleed promotional banner carousel — dots, arrows, pause on hover. */
export function HeroCarousel({ section }: { section: HomeSectionDto }) {
  const items = sortedItems(section);
  const ok = useMotionOK();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = items.length;
  const interval = configNumber(section.config, 'intervalMs') ?? DEFAULT_INTERVAL;

  const go = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (!ok || paused || count < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), Math.max(2500, interval));
    return () => window.clearInterval(id);
  }, [ok, paused, count, interval]);

  if (count === 0) return null;
  const active = items[Math.min(index, count - 1)];
  const label = section.title?.trim() || 'Featured offers';

  return (
    <section
      className="hero-carousel"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="hero-stage">
        <AnimatePresence initial={false} mode="sync">
          <motion.div
            key={active.id || index}
            className="hero-slide"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: ok ? 0.6 : 0.2, ease: EASE }}
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${count}${active.title ? ` — ${active.title}` : ''}`}
          >
            {active.href ? (
              <SmartLink href={active.href} className="hero-slide-link">
                <SlideBody item={active} index={index} />
              </SmartLink>
            ) : (
              <span className="hero-slide-link hero-slide-link--static">
                <SlideBody item={active} index={index} />
              </span>
            )}
          </motion.div>
        </AnimatePresence>

        {count > 1 && (
          <>
            <button
              type="button"
              className="hero-arrow hero-arrow--prev"
              aria-label="Previous banner"
              onClick={() => go(index - 1)}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              className="hero-arrow hero-arrow--next"
              aria-label="Next banner"
              onClick={() => go(index + 1)}
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="hero-dots" role="tablist" aria-label={`${label} slides`}>
          {items.map((item, i) => (
            <button
              key={item.id || i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={item.title ? `Show ${item.title}` : `Show banner ${i + 1}`}
              className={`hero-dot${i === index ? ' hero-dot--active' : ''}`}
              onClick={() => go(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
