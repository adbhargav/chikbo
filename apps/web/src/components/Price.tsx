import { formatPaise } from '@chikbo/shared';
import { percentOff } from '../lib/format';

interface Props {
  priceInPaise: number;
  mrpInPaise?: number | null;
  /** Card price rows are `sm`; wider surfaces use `md`. */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Marketplace price row — `₹1,499  ₹1,899  21% off` with the MRP struck
 * through and the saving in brand orange. Shared by the product card, the
 * cart and every rail so pricing hierarchy reads the same everywhere.
 */
export function PriceRow({ priceInPaise, mrpInPaise, size = 'sm', className }: Props) {
  const hasDiscount =
    mrpInPaise !== null && mrpInPaise !== undefined && mrpInPaise > priceInPaise;
  const off = hasDiscount ? percentOff(mrpInPaise, priceInPaise) : 0;
  return (
    <p className={`price-row price-row--${size}${className ? ` ${className}` : ''}`}>
      <span className="price-now">{formatPaise(priceInPaise)}</span>
      {hasDiscount && (
        <>
          <span className="price-was">{formatPaise(mrpInPaise)}</span>
          {off > 0 && <span className="price-cut">{off}% off</span>}
        </>
      )}
    </p>
  );
}

/** "You save ₹400" — rendered under the price row when a discount applies. */
export function offerNote(priceInPaise: number, mrpInPaise?: number | null): string | null {
  if (mrpInPaise === null || mrpInPaise === undefined || mrpInPaise <= priceInPaise) return null;
  return `You save ${formatPaise(mrpInPaise - priceInPaise)}`;
}
