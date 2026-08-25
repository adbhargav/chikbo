/**
 * Quick-link strip — the flagship destinations that sit directly under the
 * main bar, divided by hairline rules on desktop and horizontally scrollable
 * on mobile. Collapses out of the way once the page is scrolled past ~200px.
 *
 * Contents come from the category tree; "New Arrivals" is appended as the one
 * evergreen destination.
 */
import { NavLink } from 'react-router-dom';
import type { CategoryDto } from '@chikbo/shared';
import { NEW_ARRIVALS, categoryPath } from '../../lib/nav';

interface Props {
  categories: CategoryDto[];
  /** Scrolled past the fold — the strip folds away on desktop. */
  hidden: boolean;
  /** How many categories to show before the strip starts scrolling on mobile. */
  limit?: number;
}

export function QuickLinks({ categories, hidden, limit = 6 }: Props) {
  if (categories.length === 0) return null;
  const items = categories.slice(0, limit);

  return (
    <nav
      className="quick-strip"
      aria-label="Featured categories"
      data-hidden={hidden ? 'true' : undefined}
      // Folded strips must not be reachable by Tab.
      {...(hidden ? { 'aria-hidden': true } : {})}
    >
      <div className="container quick-strip-inner">
        {items.map((category) => (
          <NavLink
            key={category.id}
            to={categoryPath(category)}
            className={({ isActive }) => `quick-link${isActive ? ' quick-link--active' : ''}`}
            tabIndex={hidden ? -1 : undefined}
          >
            {category.name}
          </NavLink>
        ))}
        <NavLink
          to={NEW_ARRIVALS.to}
          className={({ isActive }) => `quick-link quick-link--accent${isActive ? ' quick-link--active' : ''}`}
          tabIndex={hidden ? -1 : undefined}
        >
          {NEW_ARRIVALS.label}
        </NavLink>
      </div>
    </nav>
  );
}
