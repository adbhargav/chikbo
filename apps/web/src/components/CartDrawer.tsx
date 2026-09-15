/**
 * Cart drawer — right slide-in panel (spring, 420px) with line items, qty
 * steppers, free-shipping progress and checkout CTA. Opened from the header
 * cart icon; peeks open automatically after any add-to-cart.
 * Focus is trapped while open (modal), Escape closes, focus is restored.
 */
import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { formatPaise } from '@chikbo/shared';
import { ApiError } from '../lib/api';
import { useCart, useCartMutations } from '../lib/queries';
import { useCartUi } from '../lib/cart-ui';
import { useToast } from '../lib/toast';
import { useSmoothScroll } from '../lib/lenis';
import { EASE, useMotionOK } from '../lib/motion';
import { ProductImage } from './ProductImage';
import { FreeShippingBar } from './FreeShippingBar';
import { QtyStepper } from './ui';
import { CloseIcon, TrashIcon } from './icons';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function CartDrawer() {
  const { drawer, closeDrawer, holdDrawer } = useCartUi();
  const { data: cart } = useCart();
  const { updateItem, removeItem } = useCartMutations();
  const toast = useToast();
  const navigate = useNavigate();
  const lenis = useSmoothScroll();
  const ok = useMotionOK();

  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const isOpen = drawer !== 'closed';

  // Scroll lock + focus management.
  useEffect(() => {
    if (!isOpen) return;
    lenis.stop();
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
      lenis.start();
    };
  }, [isOpen, lenis]);

  useEffect(() => {
    if (drawer === 'open') {
      restoreRef.current = (document.activeElement as HTMLElement) ?? null;
      // Wait for the panel to mount, then focus the close button.
      const id = window.setTimeout(() => {
        panelRef.current?.querySelector<HTMLElement>('.drawer-close')?.focus();
      }, 30);
      return () => window.clearTimeout(id);
    }
  }, [drawer]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeDrawer();
        restoreRef.current?.focus?.();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !panelRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [isOpen, closeDrawer]);

  const close = () => {
    closeDrawer();
    restoreRef.current?.focus?.();
  };

  const goTo = (path: string) => {
    closeDrawer();
    navigate(path);
  };

  const itemCount = cart?.items.reduce((sum, item) => sum + item.qty, 0) ?? 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="drawer-root" role="presentation">
          <motion.div
            className="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={close}
          />
          <motion.div
            ref={panelRef}
            className="drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Shopping cart"
            initial={ok ? { x: '104%' } : { opacity: 0 }}
            animate={ok ? { x: 0 } : { opacity: 1 }}
            exit={ok ? { x: '104%' } : { opacity: 0 }}
            transition={ok ? { type: 'spring', stiffness: 300, damping: 32 } : { duration: 0.2 }}
            onPointerEnter={holdDrawer}
            onFocusCapture={holdDrawer}
          >
            <header className="drawer-head">
              <h2 className="drawer-title">
                Your cart{itemCount > 0 && <span className="drawer-count"> · {itemCount}</span>}
              </h2>
              <button type="button" className="icon-btn drawer-close" aria-label="Close cart" onClick={close}>
                <CloseIcon />
              </button>
            </header>

            {!cart || cart.items.length === 0 ? (
              <div className="drawer-empty">
                <p className="drawer-empty-title">Nothing here yet</p>
                <p className="muted">Beautiful things are a click away — start with our sarees.</p>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => goTo('/c/sarees')}>
                  Shop Sarees
                </button>
              </div>
            ) : (
              <>
                <ul className="drawer-lines" data-lenis-prevent>
                  {cart.items.map((item, i) => (
                    <motion.li
                      key={item.id}
                      className="drawer-line"
                      initial={{ opacity: 0, x: ok ? 24 : 0 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.45, delay: 0.05 + i * 0.05, ease: EASE }}
                    >
                      <Link
                        to={`/p/${item.productSlug}`}
                        className="drawer-line-media"
                        onClick={closeDrawer}
                        tabIndex={-1}
                        aria-hidden="true"
                      >
                        <ProductImage
                          src={item.thumbnailUrl}
                          alt=""
                          name={item.productName}
                          className="drawer-line-img"
                        />
                      </Link>
                      <div className="drawer-line-info">
                        <Link to={`/p/${item.productSlug}`} className="drawer-line-name" onClick={closeDrawer}>
                          {item.productName}
                        </Link>
                        <p className="muted drawer-line-variant">
                          {[item.size, item.color].filter(Boolean).join(' · ') || 'Standard'}
                        </p>
                        <div className="drawer-line-row">
                          <QtyStepper
                            value={item.qty}
                            max={Math.min(10, item.stockQty)}
                            onChange={(qty) =>
                              updateItem.mutate(
                                { id: item.id, qty },
                                {
                                  onError: (err) =>
                                    toast.show(
                                      err instanceof ApiError ? err.message : 'Could not update quantity.',
                                      'error',
                                    ),
                                },
                              )
                            }
                            disabled={updateItem.isPending}
                            label={`Quantity for ${item.productName}`}
                          />
                          <span className="price drawer-line-price">{formatPaise(item.lineTotalInPaise)}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="icon-btn drawer-line-remove"
                        aria-label={`Remove ${item.productName} from cart`}
                        onClick={() =>
                          removeItem.mutate(item.id, {
                            onError: (err) =>
                              toast.show(
                                err instanceof ApiError ? err.message : 'Could not remove the item.',
                                'error',
                              ),
                          })
                        }
                      >
                        <TrashIcon size={16} />
                      </button>
                    </motion.li>
                  ))}
                </ul>

                <footer className="drawer-foot">
                  <FreeShippingBar cart={cart} />
                  <div className="drawer-subtotal">
                    <span>Subtotal</span>
                    <span className="price">{formatPaise(cart.subtotalInPaise)}</span>
                  </div>
                  <p className="muted drawer-note">Shipping and coupons are settled at checkout.</p>
                  <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => goTo('/checkout')}>
                    Checkout
                  </button>
                  <button type="button" className="btn btn-ghost btn-block drawer-view-cart" onClick={() => goTo('/cart')}>
                    View full cart
                  </button>
                </footer>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
