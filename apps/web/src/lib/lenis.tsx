/**
 * Lenis smooth-scroll provider. One instance for the app; anchor scrolls and
 * route scroll-restoration go through it. Disabled under reduced motion.
 */
import { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import Lenis from 'lenis';
import { useMotionOK } from './motion';

interface LenisContextValue {
  /** Scroll to a target (px offset or CSS selector). */
  scrollTo: (target: number | string, opts?: { immediate?: boolean; offset?: number }) => void;
  /** Pause / resume smooth scrolling (used by modal overlays). */
  stop: () => void;
  start: () => void;
}

const LenisContext = createContext<LenisContextValue>({
  scrollTo: (target) => {
    if (typeof target === 'number') window.scrollTo({ top: target });
    else document.querySelector(target)?.scrollIntoView();
  },
  stop: () => undefined,
  start: () => undefined,
});

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const ok = useMotionOK();
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (!ok) return;
    const lenis = new Lenis({ lerp: 0.1 });
    lenisRef.current = lenis;
    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [ok]);

  const scrollTo = useCallback<LenisContextValue['scrollTo']>((target, opts) => {
    const lenis = lenisRef.current;
    if (lenis) {
      lenis.scrollTo(target, { immediate: opts?.immediate, offset: opts?.offset ?? 0 });
    } else if (typeof target === 'number') {
      window.scrollTo({ top: target });
    } else {
      document.querySelector(target)?.scrollIntoView();
    }
  }, []);

  const stop = useCallback(() => lenisRef.current?.stop(), []);
  const start = useCallback(() => lenisRef.current?.start(), []);

  return <LenisContext.Provider value={{ scrollTo, stop, start }}>{children}</LenisContext.Provider>;
}

export function useSmoothScroll(): LenisContextValue {
  return useContext(LenisContext);
}
