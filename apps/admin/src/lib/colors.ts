/**
 * Colour-name → swatch mapping for variant selectors.
 *
 * Variants store a human colour name ("Rani Pink", "Antique Gold") rather than
 * a hex value, so the storefront resolves the paint here. Metallics use a
 * gradient so they don't read as flat mud, and anything unrecognised falls
 * back to a neutral chip with the name still shown beside the swatches.
 */
export interface Swatch {
  /** CSS colour or gradient painted inside the bubble. */
  fill: string;
  /** True for very light colours that need a visible outline. */
  light?: boolean;
}

const SWATCHES: Record<string, Swatch> = {
  // Neutrals & lights
  ivory: { fill: '#F4EFE4', light: true },
  cream: { fill: '#F2E7D2', light: true },
  oatmeal: { fill: '#E0D5C2', light: true },
  champagne: { fill: 'linear-gradient(135deg,#F3E3C8,#D9BE92)', light: true },
  blush: { fill: '#F0C9C6', light: true },
  'powder blue': { fill: '#BCD3E6', light: true },
  sage: { fill: '#A8B79A' },

  // Brights & mids
  mustard: { fill: '#D8A32A' },
  olive: { fill: '#6E7343' },
  teal: { fill: '#1F6F72' },
  emerald: { fill: '#126B4A' },
  'rose pink': { fill: '#E48AA0' },
  'rani pink': { fill: '#D6156B' },
  crimson: { fill: '#B3122F' },
  maroon: { fill: '#6E1B2A' },
  wine: { fill: '#5C1B31' },

  // Blues & darks
  'mid blue': { fill: '#5A83B0' },
  indigo: { fill: '#33436E' },
  'royal blue': { fill: '#22409A' },
  navy: { fill: '#1E2A44' },
  charcoal: { fill: '#3A3A3C' },
  black: { fill: '#17171A' },

  // Metallics
  'antique gold': { fill: 'linear-gradient(135deg,#D8B45A,#8A6A22)' },
  'oxidised silver': { fill: 'linear-gradient(135deg,#C9CDD1,#6E7378)' },
};

/** Neutral chip used when a colour name can't be resolved at all. */
const FALLBACK: Swatch = { fill: 'linear-gradient(135deg,#E6E0D6,#C2B9AC)', light: true };

/**
 * Second chance for names the curated map doesn't cover.
 *
 * CSS understands 148 named colours — lavender, salmon, khaki, plum, coral,
 * turquoise and so on — so a colour the shop invents ("Lavender", "Light
 * Blue") resolves to the real hue instead of a grey chip. The browser
 * normalises valid names and ignores invalid ones, which is what makes the
 * sentinel test below work. Results are cached; this runs during render.
 */
const cssNameCache = new Map<string, string | null>();

function cssNamedColor(name: string): string | null {
  if (typeof document === 'undefined') return null; // SSR/tests
  const key = name.toLowerCase().replace(/[^a-z]/g, '');
  if (!key) return null;
  const cached = cssNameCache.get(key);
  if (cached !== undefined) return cached;

  const probe = document.createElement('span').style;
  probe.color = 'rgb(1, 2, 3)'; // sentinel the browser will keep if `key` is invalid
  probe.color = key;
  const resolved = probe.color && probe.color !== 'rgb(1, 2, 3)' ? probe.color : null;
  cssNameCache.set(key, resolved);
  return resolved;
}

/** Perceived brightness, so pale swatches get an outline and stay visible. */
function isLight(cssColor: string): boolean {
  const m = cssColor.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (!m) return false;
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
  // Rec. 601 luma — closer to how the eye weights each channel than a mean.
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.8;
}

/**
 * Resolve a colour name to a swatch:
 *   1. the curated map (brand-accurate: "Antique Gold" is a gradient, not tan)
 *   2. any CSS named colour
 *   3. a neutral chip, so an unrecognised name still renders as a swatch
 */
export function swatchFor(colorName: string): Swatch {
  const key = colorName.trim().toLowerCase();
  const curated = SWATCHES[key];
  if (curated) return curated;

  const css = cssNamedColor(key);
  if (css) return { fill: css, light: isLight(css) };

  return FALLBACK;
}

/** Colour names the storefront paints accurately — offered as suggestions in the admin. */
export const SUGGESTED_COLOURS = Object.keys(SWATCHES).map((k) => k.replace(/\b\w/g, (c) => c.toUpperCase()));
