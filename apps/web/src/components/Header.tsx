/**
 * Site header — announcement marquee, main bar, hover mega menu and the
 * quick-link strip. Everything below the wordmark is driven by the live
 * category tree from `GET /catalog/categories`; no category is named in code.
 *
 * Desktop: centred nav that measures itself and folds whatever does not fit
 * into a "More" dropdown, a mega menu that opens after 150ms of hover and
 * survives a 250ms diagonal mouse path, and a quick-link strip that folds away
 * once the page is scrolled past ~200px.
 *
 * Mobile: hamburger → drawer, centred wordmark, cart, a full-width search
 * field and the scrollable quick-link strip. (Drawer, search overlay and the
 * bottom tab bar are rendered by Layout.)
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Logo } from './Logo';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { CategoryDto } from '@chikbo/shared';
import { useCategories, useCart } from '../lib/queries';
import { useAuth } from '../lib/auth';
import { useCartUi } from '../lib/cart-ui';
import { EASE, useMotionOK } from '../lib/motion';
import { NEW_ARRIVALS, categoryPath, childrenOf, topLevelCategories } from '../lib/nav';
import { DESKTOP_QUERY, useMediaQuery, useNavUi } from '../lib/nav-ui';
import { MegaMenu } from './nav/MegaMenu';
import type { MegaTarget } from './nav/MegaMenu';
import { QuickLinks } from './nav/QuickLinks';
import {
  BagIcon,
  ChevronDownIcon,
  HeartIcon,
  MenuIcon,
  SearchIcon,
  UserIcon,
} from './icons';
import '../styles/header.css';
import '../styles/nav.css';

const MARQUEE_ITEMS = [
  'Pan-India shipping',
  'Free delivery over ₹999',
  'Trusted since 1992',
  'Woven with pride',
];

/** Hover timings from the spec. */
const OPEN_DELAY = 150;
const CLOSE_GRACE = 250;
/** Scroll thresholds: condense the bar, then fold the quick-link strip. */
const CONDENSE_AT = 80;
const STRIP_HIDE_AT = 200;

const MEGA_ID = 'nav-mega-panel';
const MORE_KEY = '__more__';
/** Gap between nav items — mirrors `.main-nav { gap }`. */
const NAV_GAP = 4;

export function Header() {
  const { data: categories } = useCategories();
  const { user } = useAuth();
  const { data: cart } = useCart();
  const { openDrawer, badgePulse } = useCartUi();
  const { panel, openMenu, toggleSearch } = useNavUi();
  const { pathname } = useLocation();
  const ok = useMotionOK();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  const [scrolled, setScrolled] = useState(false);
  const [stripHidden, setStripHidden] = useState(false);
  const [megaKey, setMegaKey] = useState<string | null>(null);

  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const megaKeyRef = useRef<string | null>(null);
  const focusPanelOnOpen = useRef(false);
  megaKeyRef.current = megaKey;

  const topCategories = topLevelCategories(categories);
  const [visibleCount, setVisibleCount] = useState(topCategories.length);

  /* ------------------------------------------------------------- Scroll state */

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > CONDENSE_AT);
      setStripHidden(y > STRIP_HIDE_AT);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Publish the real header height so `calc(100svh - var(--header-h))` layouts
     (hero, auth pages) still fill exactly one screen now the bar is taller.
     Only measured in the resting state — never while condensed. */
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const apply = () => {
      if (window.scrollY > CONDENSE_AT) return;
      const h = Math.round(el.getBoundingClientRect().height);
      if (h > 0) document.documentElement.style.setProperty('--header-h', `${h}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty('--header-h');
    };
  }, []);

  /* ------------------------------------------- Nav row overflow → "More" menu */

  useLayoutEffect(() => {
    const nav = navRef.current;
    const ghost = ghostRef.current;
    if (!nav || !ghost) return;

    const measure = () => {
      const catEls = Array.from(ghost.querySelectorAll<HTMLElement>('[data-ghost="cat"]'));
      const moreEl = ghost.querySelector<HTMLElement>('[data-ghost="more"]');
      const evergreenEl = ghost.querySelector<HTMLElement>('[data-ghost="evergreen"]');
      if (catEls.length === 0) return;

      const navWidth = nav.clientWidth;
      // Hidden (mobile) or not laid out yet — assume everything fits.
      if (navWidth <= 0) {
        setVisibleCount(catEls.length);
        return;
      }

      const evergreenW = (evergreenEl?.getBoundingClientRect().width ?? 0) + NAV_GAP;
      const moreW = (moreEl?.getBoundingClientRect().width ?? 0) + NAV_GAP;
      const widths = catEls.map((el) => el.getBoundingClientRect().width + NAV_GAP);
      const total = widths.reduce((sum, w) => sum + w, 0);

      if (total <= navWidth - evergreenW) {
        setVisibleCount(catEls.length);
        return;
      }
      const budget = navWidth - evergreenW - moreW;
      let used = 0;
      let count = 0;
      for (const w of widths) {
        if (used + w > budget) break;
        used += w;
        count += 1;
      }
      setVisibleCount(count);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    ro.observe(ghost);
    return () => ro.disconnect();
  }, [topCategories.length]);

  /* ------------------------------------------------------- Mega menu plumbing */

  const clearTimers = useCallback(() => {
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  // Route change or an overlay opening dismisses the mega menu.
  useEffect(() => {
    clearTimers();
    setMegaKey(null);
  }, [pathname, clearTimers]);
  useEffect(() => {
    if (panel !== 'none') {
      clearTimers();
      setMegaKey(null);
    }
  }, [panel, clearTimers]);

  const openNow = useCallback(
    (key: string) => {
      clearTimers();
      setMegaKey(key);
    },
    [clearTimers],
  );

  /** Hover intent: 150ms before the first panel opens, instant when switching. */
  const requestOpen = useCallback(
    (key: string) => {
      if (!isDesktop) return;
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
      if (megaKeyRef.current !== null) {
        if (openTimer.current !== null) {
          window.clearTimeout(openTimer.current);
          openTimer.current = null;
        }
        setMegaKey(key);
        return;
      }
      if (openTimer.current !== null) window.clearTimeout(openTimer.current);
      openTimer.current = window.setTimeout(() => {
        openTimer.current = null;
        setMegaKey(key);
      }, OPEN_DELAY);
    },
    [isDesktop],
  );

  /** 250ms of grace so a diagonal path from item to panel never drops it. */
  const scheduleClose = useCallback(() => {
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setMegaKey(null);
    }, CLOSE_GRACE);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const closeMega = useCallback(
    (restoreFocus = false) => {
      const key = megaKeyRef.current;
      clearTimers();
      setMegaKey(null);
      if (restoreFocus && key) {
        navRef.current?.querySelector<HTMLElement>(`[data-nav-trigger="${key}"]`)?.focus();
      }
    },
    [clearTimers],
  );

  // Deferred "move into the panel" after a keyboard open.
  useEffect(() => {
    if (!megaKey || !focusPanelOnOpen.current) return;
    focusPanelOnOpen.current = false;
    const id = window.setTimeout(() => {
      document.getElementById(MEGA_ID)?.querySelector<HTMLElement>('a[href]')?.focus();
    }, 40);
    return () => window.clearTimeout(id);
  }, [megaKey]);

  const triggerKeys = [...topCategories.slice(0, visibleCount).map((c) => c.slug)];
  const overflow = topCategories.slice(visibleCount);
  if (overflow.length > 0) triggerKeys.push(MORE_KEY);

  const focusTrigger = (index: number) => {
    if (triggerKeys.length === 0) return;
    const wrapped = (index + triggerKeys.length) % triggerKeys.length;
    navRef.current
      ?.querySelector<HTMLElement>(`[data-nav-trigger="${triggerKeys[wrapped]}"]`)
      ?.focus();
  };

  const onTriggerKeyDown = (
    e: React.KeyboardEvent,
    key: string,
    index: number,
    hasPanel: boolean,
  ) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeMega(true);
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusTrigger(index + 1);
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusTrigger(index - 1);
      return;
    }
    if (!hasPanel) return;
    if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      focusPanelOnOpen.current = true;
      openNow(key);
    }
  };

  /** Focus leaving the header entirely closes the panel. */
  const onHeaderBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!megaKeyRef.current) return;
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    clearTimers();
    setMegaKey(null);
  };

  /* --------------------------------------------------------------- Rendering */

  const cartCount = cart?.items.reduce((sum, item) => sum + item.qty, 0) ?? 0;
  const visible = topCategories.slice(0, visibleCount);

  let megaTarget: MegaTarget | null = null;
  if (megaKey === MORE_KEY && overflow.length > 0) {
    megaTarget = { kind: 'group', label: 'More categories', categories: overflow };
  } else if (megaKey) {
    const found = topCategories.find((c) => c.slug === megaKey);
    if (found) megaTarget = { kind: 'category', category: found };
  }

  const overHero = pathname === '/' && !scrolled && !megaTarget && panel === 'none';
  const headerClass = [
    'site-header',
    scrolled ? 'site-header--scrolled' : '',
    overHero ? 'site-header--overlay' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <header className={headerClass} ref={headerRef}>
      {/* Announcement marquee */}
      <div className="utility-bar" aria-label="Announcements">
        <div className="marquee" aria-hidden={ok ? undefined : 'false'}>
          <div className="marquee-track">
            {[0, 1].map((copy) => (
              <span key={copy} className="marquee-copy" aria-hidden={copy === 1}>
                {MARQUEE_ITEMS.map((item, i) => (
                  <span key={i} className="marquee-item">
                    {item.includes('1992') ? <span className="utility-gold">{item}</span> : item}
                    <span className="marquee-dot" aria-hidden="true">
                      ·
                    </span>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="header-body" onPointerLeave={scheduleClose} onBlur={onHeaderBlur}>
        <div className="main-bar">
          <div className="container main-bar-inner">
            <button
              type="button"
              className="icon-btn nav-hamburger"
              aria-label="Open navigation"
              aria-haspopup="dialog"
              aria-expanded={panel === 'menu'}
              onClick={openMenu}
            >
              <MenuIcon />
            </button>

            <Logo size={32} className="header-logo" />

            <nav className="main-nav" aria-label="Categories" ref={navRef}>
              {visible.map((category, index) => (
                <NavItem
                  key={category.id}
                  category={category}
                  index={index}
                  expanded={megaKey === category.slug}
                  onPointerEnter={() => requestOpen(category.slug)}
                  onPointerLeave={scheduleClose}
                  onKeyDown={onTriggerKeyDown}
                  onCaretClick={() =>
                    megaKeyRef.current === category.slug ? closeMega(false) : openNow(category.slug)
                  }
                />
              ))}

              {overflow.length > 0 && (
                <div
                  className="main-nav-item"
                  onPointerEnter={() => requestOpen(MORE_KEY)}
                  onPointerLeave={scheduleClose}
                >
                  <button
                    type="button"
                    className={`main-nav-link main-nav-more${megaKey === MORE_KEY ? ' main-nav-link--open' : ''}`}
                    data-nav-trigger={MORE_KEY}
                    aria-haspopup="true"
                    aria-expanded={megaKey === MORE_KEY}
                    aria-controls={megaKey === MORE_KEY ? MEGA_ID : undefined}
                    onClick={() =>
                      megaKeyRef.current === MORE_KEY ? closeMega(false) : openNow(MORE_KEY)
                    }
                    onKeyDown={(e) => onTriggerKeyDown(e, MORE_KEY, triggerKeys.length - 1, true)}
                  >
                    More
                    <span className="main-nav-caret-icon" aria-hidden="true">
                      <ChevronDownIcon />
                    </span>
                  </button>
                </div>
              )}

              <NavLink
                to={NEW_ARRIVALS.to}
                className="main-nav-link main-nav-link--accent"
                onPointerEnter={scheduleClose}
              >
                {NEW_ARRIVALS.label}
              </NavLink>

              {/* Off-screen measuring row — never announced, never focusable.
                  The outer box clips it so it cannot widen the document. */}
              <div className="main-nav-ghost" aria-hidden="true">
                <div className="main-nav-ghost-row" ref={ghostRef}>
                  {topCategories.map((category) => (
                    <span className="main-nav-item" data-ghost="cat" key={category.id}>
                      <span className="main-nav-link">{category.name}</span>
                      {childrenOf(category).length > 0 && (
                        <span className="main-nav-caret">
                          <ChevronDownIcon />
                        </span>
                      )}
                    </span>
                  ))}
                  <span className="main-nav-item" data-ghost="more">
                    <span className="main-nav-link main-nav-more">
                      More
                      <span className="main-nav-caret-icon">
                        <ChevronDownIcon />
                      </span>
                    </span>
                  </span>
                  <span className="main-nav-item" data-ghost="evergreen">
                    <span className="main-nav-link">{NEW_ARRIVALS.label}</span>
                  </span>
                </div>
              </div>
            </nav>

            <div className="header-actions">
              <button
                type="button"
                className="icon-btn"
                aria-label={panel === 'search' ? 'Close search' : 'Open search'}
                aria-haspopup="dialog"
                aria-expanded={panel === 'search'}
                onClick={toggleSearch}
              >
                <SearchIcon />
              </button>
              <Link
                to={user ? '/account/wishlist' : '/login'}
                className="icon-btn header-action--desk"
                aria-label="Wishlist"
              >
                <HeartIcon />
              </Link>
              <Link
                to={user ? '/account' : '/login'}
                className="icon-btn header-action--desk"
                aria-label={user ? `Account — ${user.name}` : 'Sign in'}
              >
                <UserIcon />
              </Link>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Open cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
                aria-haspopup="dialog"
                onClick={openDrawer}
              >
                <BagIcon />
                {cartCount > 0 && (
                  <motion.span
                    key={badgePulse}
                    className="cart-badge"
                    aria-hidden="true"
                    initial={ok ? { scale: 1 } : false}
                    animate={ok ? { scale: [1, 1.4, 1] } : {}}
                    transition={{ duration: 0.45, ease: EASE }}
                  >
                    {cartCount > 9 ? '9+' : cartCount}
                  </motion.span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile: full-width search field under the header. */}
        <div className="mobile-search-row">
          <div className="container">
            <button
              type="button"
              className="mobile-search"
              aria-haspopup="dialog"
              aria-expanded={panel === 'search'}
              onClick={toggleSearch}
            >
              <SearchIcon size={18} />
              <span>Search sarees, dresses, jewellery…</span>
            </button>
          </div>
        </div>

        {/* The strip only folds away on desktop — on mobile it stays reachable. */}
        <QuickLinks categories={topCategories} hidden={stripHidden && isDesktop} />

        <AnimatePresence>
          {megaTarget && isDesktop && (
            <MegaMenu
              key={megaKey ?? 'mega'}
              id={MEGA_ID}
              target={megaTarget}
              onClose={() => closeMega(true)}
              onNavigate={() => closeMega(false)}
              onPointerEnter={cancelClose}
              onPointerLeave={scheduleClose}
            />
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------ Nav row item */

interface NavItemProps {
  category: CategoryDto;
  index: number;
  expanded: boolean;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onKeyDown: (e: React.KeyboardEvent, key: string, index: number, hasPanel: boolean) => void;
  onCaretClick: () => void;
}

/**
 * Link + disclosure caret. The link always navigates (Enter), the caret opens
 * the mega menu (Enter/Space), and ArrowDown from either walks into the panel.
 */
function NavItem({
  category,
  index,
  expanded,
  onPointerEnter,
  onPointerLeave,
  onKeyDown,
  onCaretClick,
}: NavItemProps) {
  const hasPanel = childrenOf(category).length > 0;
  return (
    <div className="main-nav-item" onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
      <NavLink
        to={categoryPath(category)}
        data-nav-trigger={category.slug}
        aria-haspopup={hasPanel || undefined}
        aria-expanded={hasPanel ? expanded : undefined}
        aria-controls={hasPanel && expanded ? MEGA_ID : undefined}
        className={({ isActive }) =>
          `main-nav-link${isActive ? ' main-nav-link--active' : ''}${expanded ? ' main-nav-link--open' : ''}`
        }
        onKeyDown={(e) => onKeyDown(e, category.slug, index, hasPanel)}
      >
        {category.name}
      </NavLink>
      {hasPanel && (
        <button
          type="button"
          className={`main-nav-caret${expanded ? ' is-open' : ''}`}
          aria-label={`${category.name} submenu`}
          aria-haspopup="true"
          aria-expanded={expanded}
          aria-controls={expanded ? MEGA_ID : undefined}
          onClick={onCaretClick}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Escape') {
              onKeyDown(e, category.slug, index, hasPanel);
            }
          }}
        >
          <ChevronDownIcon />
        </button>
      )}
    </div>
  );
}
