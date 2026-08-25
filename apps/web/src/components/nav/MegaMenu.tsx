/**
 * Desktop mega menu — the panel that drops under the header on hover/focus of
 * a top-level nav item.
 *
 * Two shapes, both fed straight from the category tree:
 *  - `category`: one category, its subcategories flowed into up to four
 *    columns, plus an editorial SilkArt tile with a "Shop all" link.
 *  - `group`: the "More" overflow — every category that did not fit in the nav
 *    row, each as a column of its own with a heading and its subcategories.
 */
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { CategoryDto } from '@chikbo/shared';
import { EASE, useMotionOK } from '../../lib/motion';
import { categoryPath, childrenOf, columnsFor } from '../../lib/nav';
import { SilkArt } from '../SilkArt';

export type MegaTarget =
  | { kind: 'category'; category: CategoryDto }
  | { kind: 'group'; label: string; categories: CategoryDto[] };

interface Props {
  id: string;
  target: MegaTarget;
  /** Escape / focus-out: close and hand focus back to the trigger. */
  onClose: () => void;
  /** A link inside was activated. */
  onNavigate: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

export function MegaMenu({ id, target, onClose, onNavigate, onPointerEnter, onPointerLeave }: Props) {
  const ok = useMotionOK();
  const panelRef = useRef<HTMLDivElement>(null);

  const label = target.kind === 'category' ? target.category.name : target.label;

  /** Arrow keys walk the links inside the panel; Escape hands focus back. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const root = panelRef.current;
    if (!root) return;
    const links = Array.from(root.querySelectorAll<HTMLElement>('a[href]'));
    if (links.length === 0) return;
    const index = links.indexOf(document.activeElement as HTMLElement);
    e.preventDefault();
    const next =
      e.key === 'ArrowDown'
        ? links[(index + 1 + links.length) % links.length]
        : links[(index - 1 + links.length) % links.length];
    next?.focus();
  };

  return (
    <motion.div
      id={id}
      ref={panelRef}
      className="mega"
      role="region"
      aria-label={`${label} menu`}
      initial={{ opacity: 0, y: ok ? 6 : 0 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: ok ? 4 : 0 }}
      transition={{ duration: ok ? 0.25 : 0.14, ease: EASE }}
      onKeyDown={onKeyDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div className="container mega-inner">
        {target.kind === 'category' ? (
          <CategoryPanel category={target.category} onNavigate={onNavigate} />
        ) : (
          <GroupPanel categories={target.categories} onNavigate={onNavigate} />
        )}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------- One category, many columns */

function CategoryPanel({ category, onNavigate }: { category: CategoryDto; onNavigate: () => void }) {
  const ok = useMotionOK();
  const children = childrenOf(category);
  const columns = columnsFor(children);

  return (
    <>
      <div className="mega-body">
        <p className="mega-eyebrow">{category.name}</p>
        <div className="mega-cols" data-empty={columns.length === 0 ? 'true' : undefined}>
          {columns.length === 0 ? (
            <p className="mega-empty muted">Browse the full {category.name} collection.</p>
          ) : (
            columns.map((column, ci) => (
              <ul className="mega-col" key={ci}>
                {column.map((child, i) => (
                  <motion.li
                    key={child.id}
                    initial={{ opacity: 0, x: ok ? -12 : 0 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: ok ? 0.32 : 0.14,
                      delay: ok ? 0.05 + (ci * 0.04 + i * 0.035) : 0,
                      ease: EASE,
                    }}
                  >
                    <Link to={categoryPath(child)} className="mega-link" onClick={onNavigate}>
                      {child.name}
                    </Link>
                  </motion.li>
                ))}
              </ul>
            ))
          )}
        </div>
      </div>

      <Link to={categoryPath(category)} className="mega-tile" onClick={onNavigate}>
        <SilkArt seed={category.slug} category={category.slug} label={category.name} className="mega-art" />
        <span className="mega-shop">
          Shop all {category.name}
          <span className="mega-arrow" aria-hidden="true">
            →
          </span>
        </span>
      </Link>
    </>
  );
}

/* ------------------------------------------------ "More" — a column per group */

function GroupPanel({
  categories,
  onNavigate,
}: {
  categories: CategoryDto[];
  onNavigate: () => void;
}) {
  return (
    <div className="mega-body mega-body--wide">
      <div className="mega-groups">
        {categories.map((category) => {
          const children = childrenOf(category).slice(0, 5);
          return (
            <div className="mega-group" key={category.id}>
              <Link to={categoryPath(category)} className="mega-group-head" onClick={onNavigate}>
                {category.name}
              </Link>
              {children.length > 0 && (
                <ul className="mega-col mega-col--compact">
                  {children.map((child) => (
                    <li key={child.id}>
                      <Link to={categoryPath(child)} className="mega-link mega-link--sm" onClick={onNavigate}>
                        {child.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
