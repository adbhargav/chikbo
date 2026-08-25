import { describe, expect, it } from 'vitest';
import { computeDiscount, computeShipping, computeTotals, effectiveUnitPrice } from './pricing';
import { FLAT_SHIPPING_PAISE, FREE_SHIPPING_THRESHOLD_PAISE } from '@chikbo/shared';

describe('effectiveUnitPrice', () => {
  it('prefers the discount price when present', () => {
    expect(effectiveUnitPrice({ priceInPaise: 100_000, discountPriceInPaise: 80_000 })).toBe(80_000);
    expect(effectiveUnitPrice({ priceInPaise: 100_000, discountPriceInPaise: null })).toBe(100_000);
  });
});

describe('computeDiscount', () => {
  const percent10 = { type: 'PERCENT' as const, value: 1000, minOrderInPaise: 0, maxDiscountInPaise: null };

  it('applies percentage in basis points, rounding down', () => {
    expect(computeDiscount(99_999, percent10)).toBe(9_999); // floor(9999.9)
  });

  it('caps at maxDiscount', () => {
    expect(computeDiscount(1_000_000, { ...percent10, maxDiscountInPaise: 50_000 })).toBe(50_000);
  });

  it('returns 0 below the minimum order value', () => {
    expect(computeDiscount(49_900, { ...percent10, minOrderInPaise: 50_000 })).toBe(0);
  });

  it('flat discount never exceeds the subtotal', () => {
    expect(computeDiscount(30_000, { type: 'FLAT', value: 50_000, minOrderInPaise: 0, maxDiscountInPaise: null })).toBe(30_000);
  });

  it('no coupon means no discount', () => {
    expect(computeDiscount(100_000, null)).toBe(0);
  });
});

describe('computeShipping', () => {
  it('is free at or above the threshold', () => {
    expect(computeShipping(FREE_SHIPPING_THRESHOLD_PAISE)).toBe(0);
    expect(computeShipping(FREE_SHIPPING_THRESHOLD_PAISE + 1)).toBe(0);
  });
  it('charges the flat rate below the threshold', () => {
    expect(computeShipping(FREE_SHIPPING_THRESHOLD_PAISE - 1)).toBe(FLAT_SHIPPING_PAISE);
  });
});

describe('computeTotals', () => {
  it('computes subtotal, discount and shipping consistently', () => {
    const totals = computeTotals(
      [
        { variantId: 'a', qty: 2, unitPriceInPaise: 44_900 },
        { variantId: 'b', qty: 1, unitPriceInPaise: 59_900 },
      ],
      { type: 'PERCENT', value: 1000, minOrderInPaise: 99_900, maxDiscountInPaise: 50_000 },
    );
    expect(totals.subtotalInPaise).toBe(149_700);
    expect(totals.discountInPaise).toBe(14_970);
    // 149700 - 14970 = 134730 >= 99900 threshold -> free shipping
    expect(totals.shippingInPaise).toBe(0);
    expect(totals.totalInPaise).toBe(134_730);
  });

  it('discount can pull an order below the free-shipping threshold', () => {
    const totals = computeTotals([{ variantId: 'a', qty: 1, unitPriceInPaise: 100_000 }], {
      type: 'FLAT',
      value: 20_000,
      minOrderInPaise: 0,
      maxDiscountInPaise: null,
    });
    expect(totals.shippingInPaise).toBe(FLAT_SHIPPING_PAISE);
    expect(totals.totalInPaise).toBe(100_000 - 20_000 + FLAT_SHIPPING_PAISE);
  });

  it('rejects empty orders and invalid lines', () => {
    expect(() => computeTotals([], null)).toThrow();
    expect(() => computeTotals([{ variantId: 'a', qty: 0, unitPriceInPaise: 100 }], null)).toThrow();
    expect(() => computeTotals([{ variantId: 'a', qty: 1.5, unitPriceInPaise: 100 }], null)).toThrow();
    expect(() => computeTotals([{ variantId: 'a', qty: 1, unitPriceInPaise: -5 }], null)).toThrow();
  });
});
