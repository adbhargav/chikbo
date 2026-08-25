import { FREE_SHIPPING_THRESHOLD_PAISE, formatPaise } from '@chikbo/shared';
import type { CartDto } from '@chikbo/shared';

export function FreeShippingBar({ cart }: { cart: CartDto }) {
  const towards = cart.subtotalInPaise - cart.discountInPaise;
  const remaining = FREE_SHIPPING_THRESHOLD_PAISE - towards;
  const pct = Math.min(100, Math.round((towards / FREE_SHIPPING_THRESHOLD_PAISE) * 100));
  return (
    <div className="shipbar">
      <p className="shipbar-label">
        {remaining > 0 ? (
          <>
            Add <strong>{formatPaise(remaining)}</strong> more for free delivery
          </>
        ) : (
          <strong className="shipbar-free">You have free delivery 🎉</strong>
        )}
      </p>
      <div
        className="shipbar-track"
        role="progressbar"
        aria-label="Progress towards free delivery"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="shipbar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
