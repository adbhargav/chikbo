/**
 * Pure pricing logic — the only place order totals are computed.
 * Everything is integer paise. Client-provided prices are never trusted;
 * callers pass variant rows fetched from the DB inside the checkout
 * transaction.
 */
import { FLAT_SHIPPING_PAISE, FREE_SHIPPING_THRESHOLD_PAISE } from '@chikbo/shared';

export interface PricedLine {
  variantId: string;
  qty: number;
  /** Effective unit price: discountPriceInPaise ?? priceInPaise (from DB). */
  unitPriceInPaise: number;
}

export interface CouponRule {
  type: 'PERCENT' | 'FLAT';
  /** PERCENT: basis points (1000 = 10%). FLAT: paise. */
  value: number;
  minOrderInPaise: number;
  maxDiscountInPaise: number | null;
}

export interface OrderTotals {
  subtotalInPaise: number;
  discountInPaise: number;
  shippingInPaise: number;
  totalInPaise: number;
}

export const effectiveUnitPrice = (v: { priceInPaise: number; discountPriceInPaise: number | null }): number =>
  v.discountPriceInPaise ?? v.priceInPaise;

export function computeDiscount(subtotalInPaise: number, coupon: CouponRule | null): number {
  if (!coupon) return 0;
  if (subtotalInPaise < coupon.minOrderInPaise) return 0;
  let discount =
    coupon.type === 'PERCENT'
      ? Math.floor((subtotalInPaise * coupon.value) / 10_000)
      : coupon.value;
  if (coupon.maxDiscountInPaise != null) discount = Math.min(discount, coupon.maxDiscountInPaise);
  return Math.min(discount, subtotalInPaise);
}

export function computeShipping(subtotalAfterDiscountInPaise: number): number {
  return subtotalAfterDiscountInPaise >= FREE_SHIPPING_THRESHOLD_PAISE ? 0 : FLAT_SHIPPING_PAISE;
}

export function computeTotals(lines: PricedLine[], coupon: CouponRule | null): OrderTotals {
  if (lines.length === 0) throw new Error('Cannot price an empty order');
  for (const line of lines) {
    if (!Number.isInteger(line.qty) || line.qty <= 0) throw new Error('Invalid quantity');
    if (!Number.isInteger(line.unitPriceInPaise) || line.unitPriceInPaise < 0) throw new Error('Invalid unit price');
  }
  const subtotalInPaise = lines.reduce((sum, l) => sum + l.unitPriceInPaise * l.qty, 0);
  const discountInPaise = computeDiscount(subtotalInPaise, coupon);
  const shippingInPaise = computeShipping(subtotalInPaise - discountInPaise);
  return {
    subtotalInPaise,
    discountInPaise,
    shippingInPaise,
    totalInPaise: subtotalInPaise - discountInPaise + shippingInPaise,
  };
}
