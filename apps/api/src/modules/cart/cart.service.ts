import type { CartDto, CartItemDto } from '@chikbo/shared';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../middleware/error';
import { computeDiscount, computeShipping, effectiveUnitPrice, type CouponRule } from '../../utils/pricing';

export const MAX_QTY_PER_LINE = 10;

export async function getValidCoupon(code: string, userId: string, subtotalInPaise: number) {
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
  const [totalUses, userUses] = await prisma.$transaction([
    prisma.couponRedemption.count({ where: { couponId: coupon.id } }),
    prisma.couponRedemption.count({ where: { couponId: coupon.id, userId } }),
  ]);
  if (coupon.usageLimit != null && totalUses >= coupon.usageLimit) {
    throw ApiError.unprocessable('COUPON_EXHAUSTED', 'This coupon has reached its usage limit');
  }
  if (userUses >= coupon.perUserLimit) {
    throw ApiError.unprocessable('COUPON_ALREADY_USED', 'You have already used this coupon');
  }
  return coupon;
}

export async function getCart(userId: string, couponCode?: string): Promise<CartDto> {
  const rows = await prisma.cartItem.findMany({
    where: { userId },
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
    const coupon = await getValidCoupon(couponCode, userId, subtotalInPaise);
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

export async function addToCart(userId: string, variantId: string, qty: number): Promise<void> {
  const variant = await prisma.productVariant.findUnique({ where: { id: variantId }, include: { product: true } });
  if (!variant || !variant.isActive || !variant.product.isActive) throw ApiError.notFound('Product not available');
  if (variant.stockQty <= 0) throw ApiError.unprocessable('OUT_OF_STOCK', 'This item is out of stock');

  const existing = await prisma.cartItem.findUnique({
    where: { userId_variantId: { userId, variantId } },
  });
  const newQty = Math.min((existing?.qty ?? 0) + qty, MAX_QTY_PER_LINE, variant.stockQty);
  await prisma.cartItem.upsert({
    where: { userId_variantId: { userId, variantId } },
    update: { qty: newQty },
    create: { userId, variantId, qty: Math.min(qty, MAX_QTY_PER_LINE, variant.stockQty) },
  });
}

export async function updateCartItem(userId: string, itemId: string, qty: number): Promise<void> {
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, userId }, include: { variant: true } });
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

export async function removeCartItem(userId: string, itemId: string): Promise<void> {
  const deleted = await prisma.cartItem.deleteMany({ where: { id: itemId, userId } });
  if (deleted.count === 0) throw ApiError.notFound('Cart item not found');
}
