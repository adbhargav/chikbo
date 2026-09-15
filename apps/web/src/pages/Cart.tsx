import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatPaise } from '@chikbo/shared';
import type { CartDto } from '@chikbo/shared';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useCart, useCartMutations } from '../lib/queries';
import { useToast } from '../lib/toast';
import { usePageMeta } from '../lib/usePageMeta';
import { ProductImage } from '../components/ProductImage';
import { FreeShippingBar } from '../components/FreeShippingBar';
import { EmptyState, ErrorState, QtyStepper } from '../components/ui';
import { TrashIcon } from '../components/icons';
import '../styles/cart.css';

export { FreeShippingBar };

export default function Cart() {
  usePageMeta('Cart', 'Your Chikbo shopping cart.');
  const { loading } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);

  const baseCart = useCart();
  const couponCart = useCart(appliedCoupon);
  const { updateItem, removeItem } = useCartMutations();

  if (loading || baseCart.isPending) {
    return (
      <div className="container page" aria-busy="true">
        <div className="skeleton" style={{ height: 36, width: 220, marginBottom: 28 }} />
        <div className="cart-layout">
          <div className="skeleton" style={{ height: 300 }} />
          <div className="skeleton" style={{ height: 260 }} />
        </div>
      </div>
    );
  }

  if (baseCart.isError) {
    return (
      <div className="container page">
        <ErrorState onRetry={() => baseCart.refetch()} />
      </div>
    );
  }

  const couponError =
    appliedCoupon && couponCart.isError && couponCart.error instanceof ApiError
      ? couponCart.error.message
      : null;
  const cart: CartDto = (appliedCoupon && couponCart.data) || baseCart.data;
  const couponActive = !!appliedCoupon && !!couponCart.data && cart.couponCode === appliedCoupon;

  if (cart.items.length === 0) {
    return (
      <div className="container page">
        <EmptyState
          title="Your cart is empty"
          body="Beautiful things are a click away — start with our sarees."
          cta={{ label: 'Shop Sarees', to: '/c/sarees' }}
        />
      </div>
    );
  }

  const applyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setAppliedCoupon(code);
  };

  const changeQty = (id: string, qty: number) => {
    updateItem.mutate(
      { id, qty },
      {
        onError: (err) =>
          toast.show(err instanceof ApiError ? err.message : 'Could not update quantity.', 'error'),
      },
    );
  };

  const remove = (id: string, name: string) => {
    removeItem.mutate(id, {
      onSuccess: () => toast.show(`Removed ${name} from your cart.`, 'info'),
      onError: (err) =>
        toast.show(err instanceof ApiError ? err.message : 'Could not remove the item.', 'error'),
    });
  };

  const checkoutHref = couponActive ? `/checkout?coupon=${encodeURIComponent(appliedCoupon)}` : '/checkout';

  return (
    <div className="container page">
      <span className="overline">Your selection</span>
      <h1 className="cart-title">Cart</h1>

      <div className="cart-layout">
        {/* ---- Lines ---- */}
        <ul className="cart-lines">
          {cart.items.map((item) => (
            <li key={item.id} className="cart-line">
              <Link to={`/p/${item.productSlug}`} className="cart-line-media">
                <ProductImage
                  src={item.thumbnailUrl}
                  alt={item.productName}
                  name={item.productName}
                  className="cart-line-img"
                />
              </Link>
              <div className="cart-line-info">
                <Link to={`/p/${item.productSlug}`} className="cart-line-name">
                  {item.productName}
                </Link>
                <p className="muted cart-line-variant">
                  {[item.size, item.color].filter(Boolean).join(' · ') || 'Standard'}
                </p>
                <p className="cart-line-unit muted">{formatPaise(item.unitPriceInPaise)} each</p>
                <div className="cart-line-controls">
                  <QtyStepper
                    value={item.qty}
                    max={Math.min(10, item.stockQty)}
                    onChange={(qty) => changeQty(item.id, qty)}
                    disabled={updateItem.isPending}
                    label={`Quantity for ${item.productName}`}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Remove ${item.productName} from cart`}
                    onClick={() => remove(item.id, item.productName)}
                  >
                    <TrashIcon />
                  </button>
                </div>
                {item.qty >= item.stockQty && (
                  <p className="stock-note">Only {item.stockQty} available</p>
                )}
              </div>
              <p className="cart-line-total price">{formatPaise(item.lineTotalInPaise)}</p>
            </li>
          ))}
        </ul>

        {/* ---- Totals ---- */}
        <aside className="cart-summary card card-pad" aria-label="Order summary">
          <h2>Summary</h2>

          <form className="coupon-form" onSubmit={applyCoupon}>
            <label htmlFor="coupon" className="visually-hidden">
              Coupon code
            </label>
            <input
              id="coupon"
              className="input"
              placeholder="Coupon code"
              value={couponInput}
              aria-invalid={!!couponError}
              aria-describedby={couponError ? 'coupon-error' : undefined}
              onChange={(e) => setCouponInput(e.target.value)}
            />
            <button
              type="submit"
              className="btn btn-secondary btn-sm"
              disabled={!!appliedCoupon && couponCart.isPending}
            >
              Apply
            </button>
          </form>
          {couponError && (
            <p className="field-error" id="coupon-error" role="alert">
              {couponError}
            </p>
          )}
          {couponActive && (
            <p className="coupon-applied">
              Coupon <strong>{cart.couponCode}</strong> applied
              <button
                type="button"
                className="coupon-remove"
                onClick={() => {
                  setAppliedCoupon(null);
                  setCouponInput('');
                }}
              >
                Remove
              </button>
            </p>
          )}

          <dl className="totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatPaise(cart.subtotalInPaise)}</dd>
            </div>
            {cart.discountInPaise > 0 && (
              <div className="totals-discount">
                <dt>Discount</dt>
                <dd>−{formatPaise(cart.discountInPaise)}</dd>
              </div>
            )}
            <div>
              <dt>Shipping</dt>
              <dd>{cart.shippingInPaise === 0 ? 'Free' : formatPaise(cart.shippingInPaise)}</dd>
            </div>
            <div className="totals-grand">
              <dt>Total</dt>
              <dd>{formatPaise(cart.totalInPaise)}</dd>
            </div>
          </dl>

          <FreeShippingBar cart={cart} />

          <button
            type="button"
            className="btn btn-primary btn-lg btn-block"
            onClick={() => navigate(checkoutHref)}
          >
            Proceed to Checkout
          </button>
          <Link to="/" className="btn btn-ghost btn-block" style={{ marginTop: 8 }}>
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}
