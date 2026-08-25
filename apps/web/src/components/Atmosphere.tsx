/**
 * Global atmosphere: film-grain overlay and the once-per-session intro
 * curtain reveal. Both are pure presentation — aria-hidden, pointer-safe,
 * and disabled/collapsed under reduced motion.
 */
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE, useMotionOK } from '../lib/motion';

/* --------------------------------------------------------------- Film grain */

/** Fixed full-screen SVG turbulence noise at ~3% — paper/textile feel. */
export function FilmGrain() {
  return (
    <svg className="film-grain" aria-hidden="true" focusable="false">
      <filter id="chikbo-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#chikbo-grain)" />
    </svg>
  );
}

/* ------------------------------------------------------------- Intro reveal */

const INTRO_KEY = 'chikbo.introSeen';
const LETTERS = ['C', 'H', 'I', 'K', 'B', 'O'];

function shouldShowIntro(): boolean {
  try {
    return sessionStorage.getItem(INTRO_KEY) === null;
  } catch {
    return false;
  }
}

/**
 * First visit per session (~1.2s): ivory curtain with the CHIKBO wordmark
 * letter-staggering in over a growing gold hairline, then the curtain lifts.
 * Skippable by click / key / scroll.
 */
export function IntroReveal() {
  const ok = useMotionOK();
  const [visible, setVisible] = useState(() => shouldShowIntro());

  useEffect(() => {
    try {
      sessionStorage.setItem(INTRO_KEY, '1');
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    if (!visible || !ok) return;
    const dismiss = () => setVisible(false);
    const timer = window.setTimeout(dismiss, 1250);
    window.addEventListener('wheel', dismiss, { passive: true });
    window.addEventListener('touchmove', dismiss, { passive: true });
    window.addEventListener('keydown', dismiss);
    window.addEventListener('pointerdown', dismiss);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('wheel', dismiss);
      window.removeEventListener('touchmove', dismiss);
      window.removeEventListener('keydown', dismiss);
      window.removeEventListener('pointerdown', dismiss);
    };
  }, [visible, ok]);

  if (!ok) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="intro-curtain"
          aria-hidden="true"
          initial={{ y: 0 }}
          exit={{ y: '-100%', transition: { duration: 0.55, ease: EASE } }}
        >
          <motion.span
            className="intro-line"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.5, ease: EASE }}
          />
          <span className="intro-wordmark">
            {LETTERS.map((letter, i) => (
              <motion.span
                key={i}
                className={letter === 'O' ? 'intro-letter intro-letter--o' : 'intro-letter'}
                initial={{ y: '110%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.55, delay: 0.12 + i * 0.06, ease: EASE }}
              >
                {letter}
              </motion.span>
            ))}
          </span>
          <motion.span
            className="intro-tagline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.55 }}
          >
            Woven with trust since 1992
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
