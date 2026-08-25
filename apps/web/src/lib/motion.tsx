/**
 * Atelier motion system — one place for easings, reveal primitives and the
 * reduced-motion contract. Every framer-motion effect in the app derives from
 * here so `prefers-reduced-motion` collapses everything to simple fades.
 */
import { useRef, useState, useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'framer-motion';
import type { Variants } from 'framer-motion';

/** Signature ease — luxurious decel curve used across the site. */
export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** True when it is OK to run expressive motion (parallax, tilt, magnetism…). */
export function useMotionOK(): boolean {
  const reduced = useReducedMotion();
  return !reduced;
}

/* ------------------------------------------------------------------ Reveal */

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Entrance delay in seconds. */
  delay?: number;
  /** Distance risen from, px. */
  y?: number;
  /** Re-trigger every time it enters the viewport (default: once). */
  once?: boolean;
  style?: CSSProperties;
}

/** Fade-rise on scroll into view. Collapses to a plain fade on reduced motion. */
export function Reveal({ children, className, delay = 0, y = 26, once = true, style }: RevealProps) {
  const ok = useMotionOK();
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y: ok ? y : 0 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-60px 0px' }}
      transition={{ duration: ok ? 0.8 : 0.3, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/* ----------------------------------------------------- Stagger containers */

export function useStaggerVariants(gap = 0.08, y = 24): { parent: Variants; child: Variants } {
  const ok = useMotionOK();
  return {
    parent: {
      hidden: {},
      show: { transition: { staggerChildren: ok ? gap : 0, delayChildren: 0.05 } },
    },
    child: {
      hidden: { opacity: 0, y: ok ? y : 0 },
      show: { opacity: 1, y: 0, transition: { duration: ok ? 0.7 : 0.3, ease: EASE } },
    },
  };
}

/* -------------------------------------------------------- Mask line reveal */

interface MaskLinesProps {
  /** Each entry renders as one masked line. */
  lines: ReactNode[];
  className?: string;
  /** Seconds between lines. */
  stagger?: number;
  delay?: number;
}

/**
 * Headline lines that slide up from behind `overflow:hidden` masks — the
 * signature editorial reveal. Reduced motion: simple fade.
 */
export function MaskLines({ lines, className, stagger = 0.12, delay = 0 }: MaskLinesProps) {
  const ok = useMotionOK();
  return (
    <motion.span
      className={className ? `mask-lines ${className}` : 'mask-lines'}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-40px 0px' }}
      transition={{ staggerChildren: ok ? stagger : 0, delayChildren: delay }}
    >
      {lines.map((line, i) => (
        <span className="mask-line" key={i}>
          <motion.span
            className="mask-line-inner"
            variants={{
              hidden: { y: ok ? '112%' : 0, opacity: ok ? 1 : 0 },
              show: {
                y: 0,
                opacity: 1,
                transition: { duration: ok ? 0.9 : 0.3, ease: EASE },
              },
            }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}

/* --------------------------------------------------------------- Magnetic */

interface MagneticProps {
  children: ReactNode;
  className?: string;
  /** Max translation towards the cursor, px. */
  range?: number;
}

/** Wrapper that nudges its child towards the cursor and springs back. */
export function Magnetic({ children, className, range = 20 }: MagneticProps) {
  const ok = useMotionOK();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 16, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 220, damping: 16, mass: 0.4 });

  const onMove = (e: React.PointerEvent) => {
    if (!ok || e.pointerType !== 'mouse' || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const clamp = (v: number) => Math.max(-range, Math.min(range, v * 0.35));
    x.set(clamp(dx));
    y.set(clamp(dy));
  };

  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className={className ? `magnetic ${className}` : 'magnetic'}
      style={{ x: sx, y: sy }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      {children}
    </motion.div>
  );
}

/* ---------------------------------------------------------------- CountUp */

interface CountUpProps {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Animation length, seconds. */
  duration?: number;
}

/** Number that counts up when scrolled into view. Reduced motion: static. */
export function CountUp({ to, decimals = 0, prefix = '', suffix = '', duration = 1.6 }: CountUpProps) {
  const ok = useMotionOK();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px 0px' });
  const [value, setValue] = useState(ok ? 0 : to);

  useEffect(() => {
    if (!ok) {
      setValue(to);
      return;
    }
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      // easeOutExpo-ish
      const eased = 1 - Math.pow(1 - t, 4);
      setValue(to * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, ok, to, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}
