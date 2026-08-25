/**
 * Cart drawer UI state — any "add to cart" anywhere can pop the header badge
 * and peek the drawer open via `notifyAdded()`. The /cart route keeps working
 * independently.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type DrawerMode = 'closed' | 'open' | 'peek';

interface CartUiContextValue {
  drawer: DrawerMode;
  /** Open the drawer as a modal (user clicked the cart icon). */
  openDrawer: () => void;
  closeDrawer: () => void;
  /** Convert a peek into a full interactive open (hover/focus on the panel). */
  holdDrawer: () => void;
  /** Badge pop + drawer peek — call after a successful add-to-cart. */
  notifyAdded: () => void;
  /** Increments on every add — key the badge animation off it. */
  badgePulse: number;
}

const CartUiContext = createContext<CartUiContextValue | null>(null);

const PEEK_MS = 2800;

export function CartUiProvider({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState<DrawerMode>('closed');
  const [badgePulse, setBadgePulse] = useState(0);
  const peekTimer = useRef<number | null>(null);

  const clearPeek = () => {
    if (peekTimer.current !== null) {
      window.clearTimeout(peekTimer.current);
      peekTimer.current = null;
    }
  };

  const openDrawer = useCallback(() => {
    clearPeek();
    setDrawer('open');
  }, []);

  const closeDrawer = useCallback(() => {
    clearPeek();
    setDrawer('closed');
  }, []);

  const holdDrawer = useCallback(() => {
    clearPeek();
    setDrawer((mode) => (mode === 'peek' ? 'open' : mode));
  }, []);

  const notifyAdded = useCallback(() => {
    setBadgePulse((n) => n + 1);
    setDrawer((mode) => (mode === 'open' ? mode : 'peek'));
    clearPeek();
    peekTimer.current = window.setTimeout(() => {
      setDrawer((mode) => (mode === 'peek' ? 'closed' : mode));
      peekTimer.current = null;
    }, PEEK_MS);
  }, []);

  const value = useMemo(
    () => ({ drawer, openDrawer, closeDrawer, holdDrawer, notifyAdded, badgePulse }),
    [drawer, openDrawer, closeDrawer, holdDrawer, notifyAdded, badgePulse],
  );

  return <CartUiContext.Provider value={value}>{children}</CartUiContext.Provider>;
}

export function useCartUi(): CartUiContextValue {
  const ctx = useContext(CartUiContext);
  if (!ctx) throw new Error('useCartUi must be used inside <CartUiProvider>');
  return ctx;
}
