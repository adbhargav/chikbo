import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, toApiError } from '../../api/client';
import { useCart, useRemoveCartItem, useUpdateCartItem } from '../../hooks/queries';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { PriceText } from '../../components/PriceText';
import { ProductImage } from '../../components/ProductImage';
import { QtyStepper } from '../../components/QtyStepper';
import { Skeleton } from '../../components/Skeleton';
import { colors, fonts, hairline, radius, spacing } from '../../theme';
import type { AppScreenProps } from '../../navigation/types';
import { formatPaise, FREE_SHIPPING_THRESHOLD_PAISE } from '../../types/shared';

export function CartScreen({ navigation }: AppScreenProps<'Cart'>) {
  const insets = useSafeAreaInsets();
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  const baseCart = useCart(null);
  const couponCart = useCart(appliedCoupon);
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();

  // Surface 422 coupon errors and fall back to the un-couponed cart.
  useEffect(() => {
    if (appliedCoupon && couponCart.isError) {
      const err = toApiError(couponCart.error);
      if (err.status === 422 || err.code.startsWith('COUPON')) {
        setCouponError(err.message);
        setAppliedCoupon(null);
      }
    }
  }, [appliedCoupon, couponCart.isError, couponCart.error]);

  const activeQuery = appliedCoupon && couponCart.data ? couponCart : baseCart;
  const cart = appliedCoupon && couponCart.data ? couponCart.data : baseCart.data;
  const couponApplied = !!cart?.couponCode;

  if (baseCart.isLoading) {
    return (
      <View style={styles.skeletonWrap}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={104} borderRadius={radius.card} />
        ))}
        <Skeleton height={180} borderRadius={radius.card} style={{ marginTop: spacing.lg }} />
      </View>
    );
  }

  if (baseCart.isError) {
    return <ErrorState error={baseCart.error} onRetry={() => void baseCart.refetch()} />;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <EmptyState
        icon="bag-outline"
        title="Your cart is waiting"
        message="Fill it with pieces woven with trust."
        ctaTitle="Start shopping"
        onCtaPress={() => navigation.navigate('Tabs', { screen: 'HomeTab' })}
      />
    );
  }

  const applyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponError(null);
    setAppliedCoupon(code);
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError(null);
  };

  const afterDiscount = cart.subtotalInPaise - cart.discountInPaise;
  const toFreeShipping = FREE_SHIPPING_THRESHOLD_PAISE - afterDiscount;
  const progress = Math.min(1, afterDiscount / FREE_SHIPPING_THRESHOLD_PAISE);

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 + insets.bottom }} showsVerticalScrollIndicator={false}>
        {/* Free shipping progress */}
        <View style={styles.shippingHint}>
          {toFreeShipping > 0 ? (
            <Text style={styles.shippingHintText}>
              Add <Text style={styles.shippingHintStrong}>{formatPaise(toFreeShipping)}</Text> more for free delivery
            </Text>
          ) : (
            <Text style={styles.shippingHintText}>
              <Text style={styles.shippingHintStrong}>You've unlocked free delivery.</Text>
            </Text>
          )}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>

        {/* Line items */}
        <View style={{ gap: spacing.md }}>
          {cart.items.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View ${item.productName}`}
                onPress={() => navigation.navigate('ProductDetail', { slug: item.productSlug, name: item.productName })}
              >
                <ProductImage url={item.thumbnailUrl} name={item.productName} style={styles.itemImage} borderRadius={10} />
              </Pressable>
              <View style={styles.itemBody}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {item.productName}
                </Text>
                <Text style={styles.itemVariant}>
                  {[item.size, item.color].filter(Boolean).join(' · ') || 'One size'}
                </Text>
                <PriceText priceInPaise={item.unitPriceInPaise} size="sm" />
                <View style={styles.itemActions}>
                  <QtyStepper
                    qty={item.qty}
                    max={Math.min(10, item.stockQty)}
                    busy={updateItem.isPending && updateItem.variables?.itemId === item.id}
                    onChange={(qty) => updateItem.mutate({ itemId: item.id, qty })}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${item.productName} from cart`}
                    onPress={() => removeItem.mutate(item.id)}
                    hitSlop={8}
                    style={({ pressed }) => pressed && { opacity: 0.5 }}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.ink500} />
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Coupon */}
        <View style={styles.couponCard}>
          <Text style={styles.couponLabel}>COUPON</Text>
          {couponApplied ? (
            <View style={styles.couponAppliedRow}>
              <View style={styles.couponAppliedBadge}>
                <Ionicons name="pricetag" size={13} color={colors.success} />
                <Text style={styles.couponAppliedText}>
                  {cart.couponCode} applied · −{formatPaise(cart.discountInPaise)}
                </Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Remove coupon" onPress={removeCoupon} hitSlop={8}>
                <Text style={styles.couponRemove}>Remove</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.couponRow}>
                <TextInput
                  value={couponInput}
                  onChangeText={(t) => {
                    setCouponInput(t);
                    setCouponError(null);
                  }}
                  placeholder="Enter coupon code"
                  placeholderTextColor={colors.ink300}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={styles.couponInput}
                  accessibilityLabel="Coupon code"
                  onSubmitEditing={applyCoupon}
                  returnKeyType="done"
                />
                <Button
                  title="Apply"
                  size="sm"
                  variant="secondary"
                  onPress={applyCoupon}
                  loading={!!appliedCoupon && couponCart.isFetching}
                  disabled={!couponInput.trim()}
                />
              </View>
              {couponError ? (
                <Text style={styles.couponError} accessibilityLiveRegion="polite">
                  {couponError}
                </Text>
              ) : null}
            </>
          )}
        </View>

        {/* Totals */}
        <View style={styles.totalsCard}>
          <TotalRow label="Subtotal" value={formatPaise(cart.subtotalInPaise)} />
          {cart.discountInPaise > 0 ? (
            <TotalRow label={`Discount${cart.couponCode ? ` (${cart.couponCode})` : ''}`} value={`−${formatPaise(cart.discountInPaise)}`} tone="success" />
          ) : null}
          <TotalRow
            label="Delivery"
            value={cart.shippingInPaise === 0 ? 'FREE' : formatPaise(cart.shippingInPaise)}
            tone={cart.shippingInPaise === 0 ? 'success' : undefined}
          />
          <View style={styles.totalsDivider} />
          <TotalRow label="Total" value={formatPaise(cart.totalInPaise)} bold />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          title={`Checkout · ${formatPaise(cart.totalInPaise)}`}
          onPress={() =>
            navigation.navigate('AddressSelect', couponApplied && cart.couponCode ? { couponCode: cart.couponCode } : {})
          }
          disabled={activeQuery.isFetching}
        />
      </View>
    </View>
  );
}

function TotalRow({
  label,
  value,
  bold = false,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: 'success';
}) {
  return (
    <View style={totalStyles.row}>
      <Text style={[totalStyles.label, bold && totalStyles.bold]}>{label}</Text>
      <Text style={[totalStyles.value, bold && totalStyles.bold, tone === 'success' && { color: colors.success }]}>
        {value}
      </Text>
    </View>
  );
}

const totalStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.ink700,
  },
  value: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink900,
    fontVariant: ['tabular-nums'],
  },
  bold: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.ink900,
  },
});

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream50 },
  skeletonWrap: {
    flex: 1,
    backgroundColor: colors.cream50,
    padding: spacing.lg,
    gap: spacing.md,
  },
  shippingHint: {
    backgroundColor: colors.brand50,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  shippingHintText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.ink700,
  },
  shippingHintStrong: {
    fontFamily: fonts.semibold,
    color: colors.brand700,
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(234, 122, 18, 0.18)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.brand600,
  },
  itemCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: spacing.md,
    ...hairline,
  },
  itemImage: {
    width: 84,
    height: 112,
  },
  itemBody: {
    flex: 1,
    gap: 3,
  },
  itemName: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 19,
    color: colors.ink900,
  },
  itemVariant: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.ink500,
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  couponCard: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginTop: spacing.lg,
    ...hairline,
    gap: spacing.sm,
  },
  couponLabel: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.gold500,
  },
  couponRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  couponInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.ink300,
    borderRadius: radius.input,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink900,
    letterSpacing: 1,
  },
  couponError: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.error,
  },
  couponAppliedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  couponAppliedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.successTint,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  couponAppliedText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.success,
  },
  couponRemove: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.error,
  },
  totalsCard: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.md,
    ...hairline,
  },
  totalsDivider: {
    height: 1,
    backgroundColor: 'rgba(185, 178, 169, 0.4)',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.cream50,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(185, 178, 169, 0.4)',
  },
});
