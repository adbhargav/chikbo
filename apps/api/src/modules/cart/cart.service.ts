import type { CartDto, CartItemDto } from '@chikbo/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../middleware/error';
import type { CartOwner } from '../../middleware/guest';
import { computeDiscount, computeShipping, effectiveUnitPrice, type CouponRule } from '../../utils/pricing';

export const MAX_QTY_PER_LINE = 10;

/** Who a coupon's per-customer limit is counted against. */
export type CouponIdentity = { userId: string; guestEmail?: undefined } | { guestEmail: string; userId?: undefined };

/** `where` clause selecting exactly this owner's cart rows. */
export function ownerWhere(owner: CartOwner): Prisma.CartItemWhereInput {
  return owner.userId !== undefined ? { userId: owner.userId } : { guestToken: owner.guestToken, userId: null };
}

function ownerUnique(owner: CartOwner, variantId: string): Prisma.CartItemWhereUniqueInput {
  return owner.userId !== undefined
    ? { userId_variantId: { userId: owner.userId, variantId } }
    : { guestToken_variantId: { guestToken: owner.guestToken, variantId } };
}

export async function getValidCoupon(code: string, identity: CouponIdentity, subtotalInPaise: number) {
  const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
  if (!coupon || !coupon.isActive) throw ApiError.unprocessable('COUPON_INVALID', 'This coupon code is not valid');
  const now = new Date();
  if (now < coupon.validFrom || now > coupon.validUntil) {
    throw ApiError.unprocessable('COUPON_EXPIRED', 'This coupon has expired');
  }
  if (subtotalInPaise < coupon.minOrderInPaise) {
    throw ApiError.unprocessable(
      'COUPON_MIN_ORDER',
      `This coupon needs a minimum order of ₹${(coupon.minOrderInPaise / 100).toFixed(0)}`,
    );
  }
  const perCustomer =
    identity.userId !== undefined
      ? { couponId: coupon.id, userId: identity.userId }
      : { couponId: coupon.id, guestEmail: identity.guestEmail.toLowerCase() };
  const [totalUses, userUses] = await prisma.$transaction([
    prisma.couponRedemption.count({ where: { couponId: coupon.id } }),
    prisma.couponRedemption.count({ where: perCustomer }),
  ]);
  if (coupon.usageLimit != null && totalUses >= coupon.usageLimit) {
    throw ApiError.unprocessable('COUPON_EXHAUSTED', 'This coupon has reached its usage limit');
  }
  if (userUses >= coupon.perUserLimit) {
    throw ApiError.unprocessable('COUPON_ALREADY_USED', 'You have already used this coupon');
  }
  return coupon;
}

/**
 * Prices the owner's cart. A guest's coupon is validated against the email
 * they will check out with; without one the per-customer limit is skipped
 * here and enforced again at checkout, where the email is known.
 */
export async function getCart(owner: CartOwner, couponCode?: string, guestEmail?: string): Promise<CartDto> {
  const rows = await prisma.cartItem.findMany({
    where: ownerWhere(owner),
    include: {
      variant: {
        include: { product: { include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const items: CartItemDto[] = rows
    .filter((r) => r.variant.isActive && r.variant.product.isActive)
    .map((r) => {
      const unit = effectiveUnitPrice(r.variant);
      return {
        id: r.id,
        variantId: r.variantId,
        productId: r.variant.productId,
        productName: r.variant.product.name,
        productSlug: r.variant.product.slug,
        thumbnailUrl: r.variant.product.images[0]?.url ?? null,
        size: r.variant.size,
        color: r.variant.color,
        qty: r.qty,
        unitPriceInPaise: unit,
        lineTotalInPaise: unit * r.qty,
        stockQty: r.variant.stockQty,
      };
    });

  const subtotalInPaise = items.reduce((s, i) => s + i.lineTotalInPaise, 0);

  let discountInPaise = 0;
  let appliedCode: string | null = null;
  if (couponCode && items.length > 0) {
    const identity: CouponIdentity =
      owner.userId !== undefined ? { userId: owner.userId } : { guestEmail: guestEmail ?? `guest:${owner.guestToken}` };
    const coupon = await getValidCoupon(couponCode, identity, subtotalInPaise);
    const rule: CouponRule = {
      type: coupon.type,
      value: coupon.value,
      minOrderInPaise: coupon.minOrderInPaise,
      maxDiscountInPaise: coupon.maxDiscountInPaise,
    };
    discountInPaise = computeDiscount(subtotalInPaise, rule);
    appliedCode = coupon.code;
  }

  const shippingInPaise = items.length ? computeShipping(subtotalInPaise - discountInPaise) : 0;
  return {
    items,
    subtotalInPaise,
    couponCode: appliedCode,
    discountInPaise,
    shippingInPaise,
    totalInPaise: subtotalInPaise - discountInPaise + shippingInPaise,
  };
}

export async function addToCart(owner: CartOwner, variantId: string, qty: number): Promise<void> {
  const variant = await prisma.productVariant.findUnique({ where: { id: variantId }, include: { product: true } });
  if (!variant || !variant.isActive || !variant.product.isActive) throw ApiError.notFound('Product not available');
  if (variant.stockQty <= 0) throw ApiError.unprocessable('OUT_OF_STOCK', 'This item is out of stock');

  const existing = await prisma.cartItem.findUnique({ where: ownerUnique(owner, variantId) });
  const newQty = Math.min((existing?.qty ?? 0) + qty, MAX_QTY_PER_LINE, variant.stockQty);
  await prisma.cartItem.upsert({
    where: ownerUnique(owner, variantId),
    update: { qty: newQty },
    create: {
      userId: owner.userId ?? null,
      guestToken: owner.guestToken ?? null,
      variantId,
      qty: Math.min(qty, MAX_QTY_PER_LINE, variant.stockQty),
    },
  });
}

/**
 * Folds a guest cart into the signed-in user's cart (quantities add up,
 * clamped to the line max and stock) and deletes the guest rows. Called when
 * a guest signs in or registers. Returns the number of lines merged.
 */
export async function mergeGuestCart(userId: string, guestToken: string): Promise<number> {
  const guestRows = await prisma.cartItem.findMany({
    where: { guestToken, userId: null },
    include: { variant: true },
  });
  if (guestRows.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    for (const row of guestRows) {
      const existing = await tx.cartItem.findUnique({
        where: { userId_variantId: { userId, variantId: row.variantId } },
      });
      const qty = Math.min((existing?.qty ?? 0) + row.qty, MAX_QTY_PER_LINE, Math.max(row.variant.stockQty, 0));
      if (qty <= 0) continue;
      await tx.cartItem.upsert({
        where: { userId_variantId: { userId, variantId: row.variantId } },
        update: { qty },
        create: { userId, variantId: row.variantId, qty },
      });
    }
    await tx.cartItem.deleteMany({ where: { guestToken, userId: null } });
  });
  return guestRows.length;
}

export async function updateCartItem(owner: CartOwner, itemId: string, qty: number): Promise<void> {
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, ...ownerWhere(owner) },
    include: { variant: true },
  });
  if (!item) throw ApiError.notFound('Cart item not found');
  if (qty === 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
    return;
  }
  if (qty > item.variant.stockQty) {
    throw ApiError.unprocessable('INSUFFICIENT_STOCK', `Only ${item.variant.stockQty} left in stock`);
  }
  await prisma.cartItem.update({ where: { id: item.id }, data: { qty: Math.min(qty, MAX_QTY_PER_LINE) } });
}

export async function removeCartItem(owner: CartOwner, itemId: string): Promise<void> {
  const deleted = await prisma.cartItem.deleteMany({ where: { id: itemId, ...ownerWhere(owner) } });
  if (deleted.count === 0) throw ApiError.notFound('Cart item not found');
}
