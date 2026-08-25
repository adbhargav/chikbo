/**
 * Mobile bottom tab bar — fixed to the bottom of the viewport with five
 * destinations: Home, Categories (opens the drawer), Search (the elevated
 * brand-orange circle, opens the overlay), Wishlist and Cart with a live count.
 *
 * It slides away whenever a drawer or overlay is up so it never sits on top of
 * a modal surface, and `.app-shell` carries matching bottom padding so page
 * content is never hidden underneath it.
 */
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../lib/auth';
import { useCart } from '../../lib/queries';
import { useCartUi } from '../../lib/cart-ui';
import { EASE, useMotionOK } from '../../lib/motion';
import { useNavUi } from '../../lib/nav-ui';
import { BagIcon, GridIcon, HeartIcon, HomeIcon, SearchIcon } from '../icons';
import '../../styles/nav.css';

export function BottomTabBar() {
  const { panel, openMenu, openSearch } = useNavUi();
  const { drawer, openDrawer } = useCartUi();
  const { user } = useAuth();
  const { data: cart } = useCart();
  const { pathname } = useLocation();
  const ok = useMotionOK();

  const hidden = panel !== 'none' || drawer !== 'closed';
  const cartCount = cart?.items.reduce((sum, item) => sum + item.qty, 0) ?? 0;
  const tabIndex = hidden ? -1 : undefined;
  const wishlistTo = user ? '/account/wishlist' : '/login';

  return (
    <motion.nav
      className="tabbar"
      aria-label="Primary"
      aria-hidden={hidden || undefined}
      data-hidden={hidden ? 'true' : undefined}
      animate={{ y: hidden ? (ok ? '130%' : 0) : 0, opacity: hidden ? 0 : 1 }}
      transition={{ duration: ok ? 0.28 : 0.12, ease: EASE }}
    >
      <NavLink to="/" end className={({ isActive }) => `tab${isActive ? ' tab--active' : ''}`} tabIndex={tabIndex}>
        <HomeIcon />
        <span className="tab-label">Home</span>
      </NavLink>

      <button
        type="button"
        className="tab"
        aria-haspopup="dialog"
        aria-expanded={panel === 'menu'}
        onClick={openMenu}
        tabIndex={tabIndex}
      >
        <GridIcon />
        <span className="tab-label">Categories</span>
      </button>

      <button
        type="button"
        className="tab tab--fab"
        aria-label="Search"
        aria-haspopup="dialog"
        aria-expanded={panel === 'search'}
        onClick={openSearch}
        tabIndex={tabIndex}
      >
        <span className="tab-fab">
          <SearchIcon size={22} />
        </span>
        <span className="tab-label">Search</span>
      </button>

      <NavLink
        to={wishlistTo}
        className={`tab${pathname === '/account/wishlist' ? ' tab--active' : ''}`}
        tabIndex={tabIndex}
      >
        <HeartIcon />
        <span className="tab-label">Wishlist</span>
      </NavLink>

      <button
        type="button"
        className="tab"
        aria-label={`Open cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
        aria-haspopup="dialog"
        onClick={openDrawer}
        tabIndex={tabIndex}
      >
        <span className="tab-icon">
          <BagIcon />
          {cartCount > 0 && (
            <span className="tab-badge" aria-hidden="true">
              {cartCount > 9 ? '9+' : cartCount}
            </span>
          )}
        </span>
        <span className="tab-label">Cart</span>
      </button>
    </motion.nav>
  );
}
