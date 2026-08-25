/**
 * SilkArt — deterministic "woven silk" generated art. Every product card,
 * category tile, hero panel and banner renders one of these instead of a flat
 * placeholder: a two-tone silk gradient (hue pair per category), a fine SVG
 * thread crosshatch, a slow moving sheen and an optional Fraunces-italic
 * caption. Seeded by slug so the same product always weaves the same silk.
 */
import { useId, useMemo } from 'react';
import type { CSSProperties } from 'react';

interface Palette {
  a: string;
  b: string;
  thread: string;
  caption: string;
}

/** Category hue pairs (design-uplift spec). */
const PALETTES: Record<string, Palette> = {
  sarees: { a: '#5a1f2b', b: '#b08d3e', thread: 'rgba(253, 244, 227, 0.6)', caption: '#f6e7c8' },
  dresses: { a: '#a44b5e', b: '#f0cfd0', thread: 'rgba(255, 251, 248, 0.65)', caption: '#fff6f4' },
  tops: { a: '#efe7d6', b: '#8a9b77', thread: 'rgba(63, 74, 52, 0.35)', caption: '#33402a' },
  bottomwear: { a: '#2e3a59', b: '#8c9bb3', thread: 'rgba(233, 238, 247, 0.5)', caption: '#e9eef7' },
  jewellery: { a: '#8a6d2f', b: '#1a1714', thread: 'rgba(240, 218, 158, 0.5)', caption: '#eddaa5' },
};

const FALLBACK_ORDER: Palette[] = [
  PALETTES.sarees,
  PALETTES.dresses,
  PALETTES.tops,
  PALETTES.bottomwear,
  PALETTES.jewellery,
];

/** FNV-1a — small deterministic hash for seeds. */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Sub-category slugs mapped to their family palette, so every piece in a
 * family weaves the same silk (a cotton pant must never come out rose).
 * Order matters: the first matching fragment wins.
 */
const FAMILY_MATCHERS: [fragments: string[], palette: keyof typeof PALETTES][] = [
  [['saree', 'pattu', 'silk', 'banarasi', 'kanjivaram', 'cotton-saree'], 'sarees'],
  [['dress', 'piece', 'anarkali', 'gown'], 'dresses'],
  [['top', 'kurti', 'shirt', 'tee', 'blouse'], 'tops'],
  [['bottom', 'jean', 'pant', 'trouser', 'track', 'korean'], 'bottomwear'],
  [['jewel', 'necklace', 'earring', 'antique', 'imitation'], 'jewellery'],
];

function paletteFor(category: string | null | undefined, hash: number): Palette {
  if (category) {
    const key = category.toLowerCase();
    for (const [fragments, name] of FAMILY_MATCHERS) {
      if (fragments.some((fragment) => key.includes(fragment))) return PALETTES[name];
    }
  }
  return FALLBACK_ORDER[hash % FALLBACK_ORDER.length];
}

export interface SilkArtProps {
  /** Deterministic seed — product or category slug. */
  seed: string;
  /** Category slug used to pick the hue pair. */
  category?: string | null;
  /** Caption set small in Fraunces italic at the bottom. */
  label?: string;
  className?: string;
  /** Hide the caption (small thumbs, decorative panels). */
  showLabel?: boolean;
  style?: CSSProperties;
}

export function SilkArt({ seed, category, label, className, showLabel = true, style }: SilkArtProps) {
  const patternId = useId();
  const { palette, angle, sheenX, sheenY, weaveSize, drift } = useMemo(() => {
    const hash = hashSeed(seed);
    return {
      palette: paletteFor(category, hash),
      angle: 115 + (hash % 50), // 115–164deg
      sheenX: 20 + ((hash >> 3) % 55), // 20–74%
      sheenY: 15 + ((hash >> 7) % 45), // 15–59%
      weaveSize: 12 + ((hash >> 11) % 5), // 12–16px
      drift: ((hash >> 5) % 2 === 0 ? 1 : -1) * (10 + ((hash >> 9) % 8)), // ±10–17%
    };
  }, [seed, category]);

  const vars = {
    '--silk-a': palette.a,
    '--silk-b': palette.b,
    '--silk-angle': `${angle}deg`,
    '--silk-sheen-x': `${sheenX}%`,
    '--silk-sheen-y': `${sheenY}%`,
    '--silk-drift': `${drift}%`,
    ...style,
  } as CSSProperties;

  return (
    <div className={className ? `silk ${className}` : 'silk'} style={vars} aria-hidden="true">
      <div className="silk-base" />
      <svg className="silk-weave" width="100%" height="100%" preserveAspectRatio="none">
        <defs>
          <pattern
            id={`${patternId}-w`}
            width={weaveSize}
            height={weaveSize}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <path d={`M0 0V${weaveSize}`} stroke={palette.thread} strokeWidth="0.7" />
          </pattern>
          <pattern
            id={`${patternId}-c`}
            width={weaveSize + 3}
            height={weaveSize + 3}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-45)"
          >
            <path d={`M0 0V${weaveSize + 3}`} stroke={palette.thread} strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId}-w)`} opacity="0.35" />
        <rect width="100%" height="100%" fill={`url(#${patternId}-c)`} opacity="0.22" />
      </svg>
      <div className="silk-sheen" />
      <div className="silk-vignette" />
      {label && showLabel && (
        <span className="silk-caption" style={{ color: palette.caption }}>
          {label}
        </span>
      )}
    </div>
  );
}

/** Gold paisley line-art motif for section backgrounds (stroke 1px, ~12% opacity). */
export function PaisleyMotif({ className, flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg
      className={className ? `paisley ${className}` : 'paisley'}
      viewBox="0 0 120 160"
      fill="none"
      aria-hidden="true"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path
        d="M60 8C96 26 108 62 100 96c-7 30-32 52-58 50C20 144 6 124 10 102c4-20 22-32 40-28 15 3 24 17 20 31-3 12-15 19-26 16"
        stroke="var(--gold-500)"
        strokeWidth="1"
      />
      <path
        d="M60 24c26 14 36 42 30 68-6 24-25 40-45 38"
        stroke="var(--gold-500)"
        strokeWidth="0.8"
      />
      <circle cx="52" cy="104" r="5" stroke="var(--gold-500)" strokeWidth="0.8" />
    </svg>
  );
}
