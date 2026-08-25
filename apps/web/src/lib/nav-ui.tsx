/**
 * Navigation UI state + the primitives every nav panel needs.
 *
 * One provider owns "which overlay is showing" so the mobile drawer, the
 * search overlay and the bottom tab bar can never fight each other: opening
 * one closes the other, and the tab bar hides while either is up.
 *
 * Also exports the shared behaviours the spec demands of every panel —
 * focus trap + restore, body scroll lock (Lenis-aware), media queries and the
 * recent-search store.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode, RefObject } from 'react';
import { useLocation } from 'react-router-dom';
import { useSmoothScroll } from './lenis';

/* --------------------------------------------------------------- Nav state */

export type NavPanel = 'none' | 'menu' | 'search';

interface NavUiContextValue {
  /** Which full-screen nav surface is currently open. */
  panel: NavPanel;
  /** True while any nav surface is open (drawer or search overlay). */
  navOpen: boolean;
  openMenu: () => void;
  openSearch: () => void;
  closeNav: () => void;
  toggleSearch: () => void;
}

const NavUiContext = createContext<NavUiContextValue | null>(null);

export function NavUiProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<NavPanel>('none');
  const { pathname, search } = useLocation();

  // Any navigation dismisses the nav surfaces.
  useEffect(() => {
    setPanel('none');
  }, [pathname, search]);

  const openMenu = useCallback(() => setPanel('menu'), []);
  const openSearch = useCallback(() => setPanel('search'), []);
  const closeNav = useCallback(() => setPanel('none'), []);
  const toggleSearch = useCallback(
    () => setPanel((p) => (p === 'search' ? 'none' : 'search')),
    [],
  );

  const value = useMemo(
    () => ({ panel, navOpen: panel !== 'none', openMenu, openSearch, closeNav, toggleSearch }),
    [panel, openMenu, openSearch, closeNav, toggleSearch],
  );

  return <NavUiContext.Provider value={value}>{children}</NavUiContext.Provider>;
}

export function useNavUi(): NavUiContextValue {
  const ctx = useContext(NavUiContext);
  if (!ctx) throw new Error('useNavUi must be used inside <NavUiProvider>');
  return ctx;
}

/* --------------------------------------------------------------- Media query */

/** Subscribe to a media query. SSR-safe-ish; returns false before mount. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** True on viewports where the hover mega menu is the right interaction. */
export const DESKTOP_QUERY = '(min-width: 901px)';

/* ---------------------------------------------------------------- Scroll lock */

/** Lock document scroll (and pause Lenis) while `active`. */
export function useScrollLock(active: boolean): void {
  const lenis = useSmoothScroll();
  const stop = lenis.stop;
  const start = lenis.start;
  useEffect(() => {
    if (!active) return;
    stop();
    const el = document.documentElement;
    const previous = el.style.overflow;
    el.style.overflow = 'hidden';
    return () => {
      el.style.overflow = previous;
      start();
    };
  }, [active, stop, start]);
}

/* ---------------------------------------------------------------- Focus trap */

export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

/**
 * Trap Tab inside `ref` while `active`, move focus in on open (optionally to
 * `initialSelector`), close on Escape and restore focus to whatever was
 * focused before the panel opened.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape: () => void,
  initialSelector?: string,
): void {
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;

  useEffect(() => {
    if (!active) return;
    const restoreTo = (document.activeElement as HTMLElement | null) ?? null;

    const focusIn = window.setTimeout(() => {
      const root = ref.current;
      if (!root) return;
      const initial = initialSelector ? root.querySelector<HTMLElement>(initialSelector) : null;
      (initial ?? focusableIn(root)[0] ?? root).focus();
    }, 30);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        escapeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = ref.current;
      if (!root) return;
      const nodes = focusableIn(root);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active_ = document.activeElement as HTMLElement | null;
      if (!active_ || !root.contains(active_)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active_ === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active_ === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey, true);
    return () => {
      window.clearTimeout(focusIn);
      document.removeEventListener('keydown', onKey, true);
      // Only pull focus back if it is still inside (or lost from) the panel.
      const current = document.activeElement;
      if (!current || current === document.body || ref.current?.contains(current)) {
        restoreTo?.focus?.();
      }
    };
    // `initialSelector` is a constant per call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ref]);
}

/* ------------------------------------------------------------ Recent searches */

const RECENT_KEY = 'chikbo.recentSearches';
export const RECENT_LIMIT = 5;

export function readRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string').slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

export function pushRecentSearch(term: string): string[] {
  const q = term.trim();
  if (!q) return readRecentSearches();
  const next = [q, ...readRecentSearches().filter((t) => t.toLowerCase() !== q.toLowerCase())].slice(
    0,
    RECENT_LIMIT,
  );
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota — recents are a nicety, never a blocker */
  }
  return next;
}

export function clearRecentSearches(): string[] {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    /* ignore */
  }
  return [];
}
