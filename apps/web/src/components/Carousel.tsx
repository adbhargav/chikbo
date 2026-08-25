/**
 * Horizontal snap carousel — the scroll primitive behind every marketplace
 * rail (category chips, category cards, product carousels).
 *
 * Accessibility: the track itself is a focusable `role="group"` region, so it
 * is scrollable with the arrow keys and never traps focus; the arrow buttons
 * are ordinary buttons that page the track and disable at the ends. They are
 * hidden entirely when the content fits.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useMotionOK } from '../lib/motion';

interface Props {
  children: ReactNode;
  /** Names the scroll region and its arrow buttons. */
  ariaLabel: string;
  /** Extra class on the scroll track (sets item sizing). */
  trackClassName?: string;
  className?: string;
}

export function Carousel({ children, ariaLabel, trackClassName, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const motionOK = useMotionOK();
  const [edges, setEdges] = useState({ overflow: false, atStart: true, atEnd: true });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const next = {
      overflow: max > 4,
      atStart: el.scrollLeft <= 4,
      atEnd: el.scrollLeft >= max - 4,
    };
    // Bail out when nothing moved — this runs after every render, and a fresh
    // object each time would loop against the ResizeObserver below.
    setEdges((prev) =>
      prev.overflow === next.overflow && prev.atStart === next.atStart && prev.atEnd === next.atEnd
        ? prev
        : next,
    );
  }, []);

  // Re-measure after every render so a rail that swaps skeletons for real
  // cards updates its arrows.
  useEffect(measure);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    window.addEventListener('resize', measure);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [measure]);

  const page = (direction: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({
      left: direction * Math.max(240, el.clientWidth * 0.82),
      behavior: motionOK ? 'smooth' : 'auto',
    });
  };

  return (
    <div className={className ? `crsl ${className}` : 'crsl'}>
      <div
        ref={ref}
        className={trackClassName ? `crsl-track ${trackClassName}` : 'crsl-track'}
        role="group"
        aria-label={ariaLabel}
        tabIndex={0}
        onScroll={measure}
      >
        {children}
      </div>
      {edges.overflow && (
        <>
          <button
            type="button"
            className="crsl-arrow crsl-arrow--prev"
            aria-label={`Scroll ${ariaLabel} backwards`}
            disabled={edges.atStart}
            onClick={() => page(-1)}
          >
            <ChevronLeft />
          </button>
          <button
            type="button"
            className="crsl-arrow crsl-arrow--next"
            aria-label={`Scroll ${ariaLabel} forwards`}
            disabled={edges.atEnd}
            onClick={() => page(1)}
          >
            <ChevronRight />
          </button>
        </>
      )}
    </div>
  );
}

export function ChevronLeft({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function ChevronRight({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}
