import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { formatPaise } from '@chikbo/shared';
import type { AddressDto, CheckoutCreateRequest, CheckoutCreateResponse } from '@chikbo/shared';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useAddresses, useCart } from '../lib/queries';
import { useToast } from '../lib/toast';
import { usePageMeta } from '../lib/usePageMeta';
import { loadRazorpay } from '../lib/razorpay';
import { Magnetic, Reveal } from '../lib/motion';
import { EMAIL_RE } from '../lib/format';
import {
  AddressFields,
  AddressForm,
  emptyAddress,
  toAddressPayload,
  validateAddress,
  type AddressErrors,
  type AddressFormValues,
} from '../components/AddressForm';
import { EmptyState, ErrorState } from '../components/ui';
import { CheckIcon } from '../components/icons';
import '../styles/checkout.css';

type Phase = 'idle' | 'creating' | 'paying' | 'failed';

export default function Checkout() {
  usePageMeta('Checkout', 'Secure checkout at Chikbo.');
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const couponParam = searchParams.get('coupon');
  const { user, loading: authLoading } = useAuth();
  const isGuest = !authLoading && !user;

  // Keep one idempotency key for this checkout session so retries return the
  // same pending order from the server.
  const [idempotencyKey] = useState<string>(() => crypto.randomUUID());

  // Guest checkout: contact email + a one-off delivery address, nothing saved.
  const [guestEmail, setGuestEmail] = useState('');
  const [guestAddress, setGuestAddress] = useState<AddressFormValues>(emptyAddress);
  const [guestErrors, setGuestErrors] = useState<AddressErrors & { email?: string }>({});
  const guestEmailValid = EMAIL_RE.test(guestEmail.trim());

  const addresses = useAddresses();
  const couponCart = useCart(couponParam, isGuest && guestEmailValid ? guestEmail.trim() : null);
  const baseCart = useCart();
  const couponValid = !!couponParam && couponCart.isSuccess;
  const cart = couponValid ? couponCart.data : baseCart.data;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<'closed' | 'new' | AddressDto>('closed');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);

  const effectiveSelectedId = useMemo(() => {
    if (selectedId) return selectedId;
    const list = addresses.data ?? [];
    return (list.find((a) => a.isDefault) ?? list[0])?.id ?? null;
  }, [selectedId, addresses.data]);

  const busy = phase === 'creating' || phase === 'paying';
  const canPlace = isGuest ? true : !!effectiveSelectedId;

  /** Validates the guest form and returns the request body, or null when something is missing. */
  const guestRequest = (): Partial<CheckoutCreateRequest> | null => {
    const next: AddressErrors & { email?: string } = validateAddress(guestAddress);
    if (!guestEmailValid) next.email = 'Enter a valid email address for your order confirmation.';
    setGuestErrors(next);
    if (Object.keys(next).length > 0) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return null;
    }
    return { email: guestEmail.trim(), address: toAddressPayload(guestAddress) };
  };

  const placeOrder = async () => {
    let body: CheckoutCreateRequest;
    if (isGuest) {
      const guest = guestRequest();
      if (!guest) return;
      body = { ...guest, couponCode: couponValid ? couponParam : undefined, idempotencyKey };
    } else {
      if (!effectiveSelectedId) {
        toast.show('Please select a delivery address.', 'error');
        return;
      }
      body = { addressId: effectiveSelectedId, couponCode: couponValid ? couponParam : undefined, idempotencyKey };
    }
    setError(null);
    setPhase('creating');

    let checkout: CheckoutCreateResponse;
    try {
      checkout = await api<CheckoutCreateResponse>('/checkout', { method: 'POST', body });
    } catch (err) {
      setPhase('idle');
      if (err instanceof ApiError) {
        if (err.code === 'INSUFFICIENT_STOCK') {
          setError('Some items in your cart are no longer in stock. Please review your cart.');
        } else if (err.code === 'PAYMENTS_UNAVAILABLE') {
          setError('Payments are temporarily unavailable. Please try again in a few minutes.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Could not start checkout. Please try again.');
      }
      return;
    }

    const loaded = await loadRazorpay();
    if (!loaded || !window.Razorpay) {
      setPhase('failed');
      setError('Could not load the payment gateway. Check your connection and retry.');
      return;
    }

    setPhase('paying');
    const rzp = new window.Razorpay({
      key: checkout.razorpayKeyId,
      order_id: checkout.razorpayOrderId,
      amount: checkout.amountInPaise,
      currency: checkout.currency,
      name: 'Chikbo',
      description: `Order ${checkout.orderNumber}`,
      prefill: checkout.prefill,
      theme: { color: '#EA7A12' },
      handler: (response) => {
        void (async () => {
          try {
            await api('/payments/verify', { method: 'POST', body: response });
          } catch {
            // Non-fatal: the server also confirms via webhook.
          }
          await queryClient.invalidateQueries({ queryKey: ['cart'] });
          await queryClient.invalidateQueries({ queryKey: ['orders'] });
          navigate(`/order-success/${checkout.orderId}`, {
            replace: true,
            state: { orderNumber: checkout.orderNumber },
          });
        })();
      },
      modal: {
        ondismiss: () => {
          setPhase('failed');
          setError('Payment was not completed. You can retry — your order is saved.');
          void api('/payments/failed', {
            method: 'POST',
            body: { razorpay_order_id: checkout.razorpayOrderId },
          }).catch(() => undefined);
        },
      },
    });
    rzp.on('payment.failed', (response) => {
      setPhase('failed');
      setError(response.error.description ?? 'Payment failed. You can retry with another method.');
      void api('/payments/failed', {
        method: 'POST',
        body: {
          razorpay_order_id: checkout.razorpayOrderId,
          error_code: response.error.code,
          error_description: response.error.description,
        },
      }).catch(() => undefined);
    });
    rzp.open();
  };

  /* ---- Loading / guard states ---- */

  if (authLoading || baseCart.isPending || (!!user && addresses.isPending)) {
    return (
      <div className="container page" aria-busy="true">
        <div className="skeleton" style={{ height: 36, width: 240, marginBottom: 28 }} />
        <div className="checkout-layout">
          <div className="skeleton" style={{ height: 320 }} />
          <div className="skeleton" style={{ height: 280 }} />
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

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container page">
        <EmptyState
          title="Nothing to check out"
          body="Your cart is empty — add something beautiful first."
          cta={{ label: 'Start shopping', to: '/' }}
        />
      </div>
    );
  }

  const addressList = addresses.data ?? [];

  return (
    <div className="container page">
      <span className="overline">Almost there</span>
      <h1 className="checkout-title">Checkout</h1>

      {couponParam && !couponValid && !couponCart.isPending && (
        <p className="alert alert-info">
          The coupon {couponParam} could not be applied
          {couponCart.error instanceof ApiError ? ` — ${couponCart.error.message}` : ''}. Totals shown
          without it.
        </p>
      )}

      <div className="checkout-layout">
        <div className="checkout-main">
          {isGuest && (
            <p className="checkout-signin">
              <span>Checking out as a guest — no account needed.</span>
              <Link to="/login" state={{ from: location.pathname + location.search }}>
                Have an account? Sign in
              </Link>
            </p>
          )}

          {/* ---- Address ---- */}
          <Reveal y={18}>
          <section className="checkout-section card card-pad" aria-labelledby="delivery-title">
            <h2 id="delivery-title">{isGuest ? 'Contact & delivery' : 'Delivery address'}</h2>

            {isGuest && (
              <div className="checkout-contact">
                <div className="field">
                  <label htmlFor="guest-email">Email</label>
                  <input
                    id="guest-email"
                    className="input"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={guestEmail}
                    aria-invalid={!!guestErrors.email}
                    onChange={(e) => setGuestEmail(e.target.value)}
                  />
                  {guestErrors.email ? (
                    <span className="field-error">{guestErrors.email}</span>
                  ) : (
                    <span className="field-hint">Your order confirmation and updates go here.</span>
                  )}
                </div>
              </div>
            )}

            {isGuest && (
              <div className="address-form">
                <AddressFields
                  form={guestAddress}
                  errors={guestErrors}
                  onChange={setGuestAddress}
                  idPrefix="guest-addr"
                />
              </div>
            )}

            {!isGuest && addressList.length === 0 && formMode === 'closed' && (
              <p className="muted" style={{ marginBottom: 12 }}>
                Add an address to continue.
              </p>
            )}

            {!isGuest && (
            <>
            <div className="address-options" role="radiogroup" aria-label="Choose a delivery address">
              {addressList.map((address) => (
                <label
                  key={address.id}
                  className={`address-option${effectiveSelectedId === address.id ? ' address-option--active' : ''}`}
                >
                  <input
                    type="radio"
                    name="address"
                    checked={effectiveSelectedId === address.id}
                    onChange={() => setSelectedId(address.id)}
                  />
                  <span className="address-option-body">
                    <span className="address-option-name">
                      {address.fullName}
                      {address.isDefault && <span className="pill pill--neutral">Default</span>}
                    </span>
                    <span className="muted">
                      {address.line1}
                      {address.line2 ? `, ${address.line2}` : ''}, {address.city}, {address.state} —{' '}
                      {address.pincode}
                    </span>
                    <span className="muted">+91 {address.phone}</span>
                  </span>
                  <button
                    type="button"
                    className="address-edit"
                    onClick={(e) => {
                      e.preventDefault();
                      setFormMode(address);
                    }}
                  >
                    Edit
                  </button>
                </label>
              ))}
            </div>

            {formMode === 'closed' ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFormMode('new')}>
                + Add new address
              </button>
            ) : (
              <div className="address-form-wrap">
                <h3 className="address-form-title">
                  {formMode === 'new' ? 'New address' : 'Edit address'}
                </h3>
                <AddressForm
                  initial={formMode === 'new' ? undefined : formMode}
                  onDone={(saved) => {
                    setFormMode('closed');
                    if (saved) setSelectedId(saved.id);
                  }}
                  onCancel={() => setFormMode('closed')}
                />
              </div>
            )}
            </>
            )}
          </section>
          </Reveal>

          {/* ---- Payment ---- */}
          <Reveal y={18} delay={0.08}>
          <section className="checkout-section card card-pad" aria-labelledby="payment-title">
            <h2 id="payment-title">Payment</h2>
            <p className="muted" style={{ marginBottom: 16 }}>
              Pay securely via Razorpay — UPI, cards, netbanking and wallets.
            </p>

            {error && (
              <p className="alert alert-error" role="alert">
                {error}{' '}
                {error.includes('cart') && (
                  <Link to="/cart" style={{ textDecoration: 'underline' }}>
                    Review cart
                  </Link>
                )}
              </p>
            )}

            <Magnetic className="magnetic--block" range={10}>
              <button
                type="button"
                className="btn btn-primary btn-lg btn-block"
                disabled={busy || !canPlace}
                onClick={placeOrder}
              >
                {phase === 'creating'
                  ? 'Preparing your order…'
                  : phase === 'paying'
                    ? 'Waiting for payment…'
                    : phase === 'failed'
                      ? `Retry payment — ${formatPaise(cart.totalInPaise)}`
                      : `Pay ${formatPaise(cart.totalInPaise)}`}
              </button>
            </Magnetic>
          </section>
          </Reveal>
        </div>

        {/* ---- Summary ---- */}
        <aside className="checkout-summary card card-pad" aria-label="Order summary">
          <h2>Order summary</h2>
          <ul className="summary-items">
            {cart.items.map((item) => (
              <li key={item.id}>
                <span className="summary-item-name">
                  {item.productName}
                  <span className="muted">
                    {' '}
                    × {item.qty}
                    {item.size || item.color
                      ? ` (${[item.size, item.color].filter(Boolean).join(', ')})`
                      : ''}
                  </span>
                </span>
                <span className="price">{formatPaise(item.lineTotalInPaise)}</span>
              </li>
            ))}
          </ul>
          <dl className="totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatPaise(cart.subtotalInPaise)}</dd>
            </div>
            {cart.discountInPaise > 0 && (
              <div className="totals-discount">
                <dt>Discount{cart.couponCode ? ` (${cart.couponCode})` : ''}</dt>
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
          <p className="checkout-assurance">
            <CheckIcon size={15} /> Quality checked · Secure payments · Since 1992
          </p>
        </aside>
      </div>
    </div>
  );
}
