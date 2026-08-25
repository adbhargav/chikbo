/**
 * Mobile navigation drawer — slides in from the left under the hamburger.
 *
 * Search field → opens the shared search overlay. Every top-level category is
 * an accordion revealing its subcategories (categories with no children are a
 * plain link). Below: account links that follow the signed-in state, then the
 * policy links. Body scroll is locked, focus is trapped and Escape closes.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { CategoryDto } from '@chikbo/shared';
import { useAuth } from '../../lib/auth';
import { EASE, useMotionOK } from '../../lib/motion';
import { POLICY_LINKS, NEW_ARRIVALS, accountLinks, categoryPath, childrenOf } from '../../lib/nav';
import { useFocusTrap, useNavUi, useScrollLock } from '../../lib/nav-ui';
import { ChevronDownIcon, CloseIcon, SearchIcon } from '../icons';
import { Logo } from '../Logo';
import '../../styles/nav.css';

interface Props {
  categories: CategoryDto[];
}

export function MobileDrawer({ categories }: Props) {
  const { panel, closeNav, openSearch } = useNavUi();
  const { user } = useAuth();
  const ok = useMotionOK();
  const open = panel === 'menu';

  const panelRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setExpanded(null);
  }, [open]);

  useScrollLock(open);
  useFocusTrap(panelRef, open, closeNav, '.nav-drawer-close');

  return (
    <AnimatePresence>
      {open && (
        <div className="nav-drawer-root" role="presentation">
          <motion.div
            className="nav-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={closeNav}
          />
          <motion.div
            ref={panelRef}
            className="nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
            initial={ok ? { x: '-104%' } : { opacity: 0 }}
            animate={ok ? { x: 0 } : { opacity: 1 }}
            exit={ok ? { x: '-104%' } : { opacity: 0 }}
            transition={ok ? { type: 'spring', stiffness: 300, damping: 34 } : { duration: 0.16 }}
          >
            <header className="nav-drawer-head">
              <Link to="/" className="nav-drawer-logo" onClick={closeNav} aria-label="Chikbo home">
                <Logo to={null} size={30} />
              </Link>
              <button
                type="button"
                className="icon-btn nav-drawer-close"
                aria-label="Close navigation"
                onClick={closeNav}
              >
                <CloseIcon />
              </button>
            </header>

            {/* data-lenis-prevent: without it the stopped Lenis instance swallows
                wheel/touch events and this inner area cannot scroll. */}
            <div className="nav-drawer-scroll" data-lenis-prevent>
              <button type="button" className="nav-drawer-search" onClick={openSearch}>
                <SearchIcon size={18} />
                <span>Search sarees, dresses, jewellery…</span>
              </button>

              <nav aria-label="Categories">
                <ul className="nav-accordion">
                  {categories.map((category) => {
                    const children = childrenOf(category);
                    const isOpen = expanded === category.id;
                    const panelId = `nav-acc-${category.slug}`;

                    if (children.length === 0) {
                      return (
                        <li key={category.id} className="nav-accordion-item">
                          <NavLink
                            to={categoryPath(category)}
                            className={({ isActive }) =>
                              `nav-accordion-link${isActive ? ' nav-accordion-link--active' : ''}`
                            }
                            onClick={closeNav}
                          >
                            {category.name}
                          </NavLink>
                        </li>
                      );
                    }

                    return (
                      <li key={category.id} className="nav-accordion-item">
                        <button
                          type="button"
                          className="nav-accordion-trigger"
                          aria-expanded={isOpen}
                          aria-controls={panelId}
                          onClick={() => setExpanded(isOpen ? null : category.id)}
                        >
                          <span>{category.name}</span>
                          <span className={`nav-accordion-caret${isOpen ? ' is-open' : ''}`} aria-hidden="true">
                            <ChevronDownIcon size={16} />
                          </span>
                        </button>
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              id={panelId}
                              className="nav-accordion-panel"
                              initial={ok ? { height: 0, opacity: 0 } : { opacity: 0 }}
                              animate={ok ? { height: 'auto', opacity: 1 } : { opacity: 1 }}
                              exit={ok ? { height: 0, opacity: 0 } : { opacity: 0 }}
                              transition={{ duration: ok ? 0.28 : 0.12, ease: EASE }}
                            >
                              <ul className="nav-accordion-list">
                                <li>
                                  <Link
                                    to={categoryPath(category)}
                                    className="nav-accordion-sub nav-accordion-sub--all"
                                    onClick={closeNav}
                                  >
                                    All {category.name}
                                  </Link>
                                </li>
                                {children.map((child) => (
                                  <li key={child.id}>
                                    <Link
                                      to={categoryPath(child)}
                                      className="nav-accordion-sub"
                                      onClick={closeNav}
                                    >
                                      {child.name}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </li>
                    );
                  })}

                  <li className="nav-accordion-item">
                    <NavLink
                      to={NEW_ARRIVALS.to}
                      className="nav-accordion-link nav-accordion-link--accent"
                      onClick={closeNav}
                    >
                      {NEW_ARRIVALS.label}
                    </NavLink>
                  </li>
                </ul>
              </nav>

              <nav className="nav-drawer-block" aria-label="Your account">
                <p className="nav-drawer-label">{user ? user.name : 'Account'}</p>
                <ul className="nav-drawer-links">
                  {accountLinks(!!user).map((link) => (
                    <li key={link.to}>
                      <Link to={link.to} onClick={closeNav}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              <nav className="nav-drawer-block" aria-label="Help and policies">
                <p className="nav-drawer-label">Help</p>
                <ul className="nav-drawer-links">
                  {POLICY_LINKS.map((link) => (
                    <li key={link.to}>
                      <Link to={link.to} onClick={closeNav}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              <p className="nav-drawer-foot">Woven with trust since 1992</p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
