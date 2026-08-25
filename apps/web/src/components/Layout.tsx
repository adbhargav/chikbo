import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Header } from './Header';
import { Footer } from './Footer';
import { CartDrawer } from './CartDrawer';
import { FilmGrain, IntroReveal } from './Atmosphere';
import { BottomTabBar } from './nav/BottomTabBar';
import { MobileDrawer } from './nav/MobileDrawer';
import { SearchOverlay } from './nav/SearchOverlay';
import { useSmoothScroll } from '../lib/lenis';
import { EASE, useMotionOK } from '../lib/motion';
import { NavUiProvider } from '../lib/nav-ui';
import { topLevelCategories } from '../lib/nav';
import { useCategories } from '../lib/queries';

function RouteFallback() {
  return (
    <div className="container page" aria-busy="true" aria-label="Loading page">
      <div className="skeleton" style={{ height: 36, width: 300, marginBottom: 28 }} />
      <div className="skeleton" style={{ height: 380 }} />
    </div>
  );
}

export function Layout() {
  const { pathname } = useLocation();
  const { scrollTo } = useSmoothScroll();
  const ok = useMotionOK();
  const { data: categories } = useCategories();
  const topCategories = topLevelCategories(categories);

  useEffect(() => {
    scrollTo(0, { immediate: true });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname, scrollTo]);

  return (
    <NavUiProvider>
      <div className="app-shell">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <IntroReveal />
        <Header />
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            id="main-content"
            key={pathname}
            initial={{ opacity: 0, y: ok ? 12 : 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: ok ? 0.98 : 1 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </motion.main>
        </AnimatePresence>
        <Footer />
        <CartDrawer />
        <MobileDrawer categories={topCategories} />
        <SearchOverlay categories={topCategories} />
        <BottomTabBar />
        <FilmGrain />
      </div>
    </NavUiProvider>
  );
}
