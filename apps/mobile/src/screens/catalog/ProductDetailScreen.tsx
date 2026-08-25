import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useAddToCart,
  useInfiniteReviews,
  useProduct,
  useToggleWishlist,
  useWishlist,
} from '../../hooks/queries';
import { toApiError } from '../../api/client';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { PriceText } from '../../components/PriceText';
import { ProductImage } from '../../components/ProductImage';
import { RatingStars } from '../../components/RatingStars';
import { Skeleton } from '../../components/Skeleton';
import { colors, fonts, hairline, radius, spacing } from '../../theme';
import type { AppScreenProps } from '../../navigation/types';
import { formatPaise, ReviewDto, VariantDto } from '../../types/shared';

export function ProductDetailScreen({ route, navigation }: AppScreenProps<'ProductDetail'>) {
  const { slug } = route.params;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const product = useProduct(slug);
  const reviews = useInfiniteReviews(slug);
  const wishlist = useWishlist();
  const toggleWishlist = useToggleWishlist();
  const addToCart = useAddToCart();

  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const variants = useMemo(
    () => (product.data?.variants ?? []).filter((v) => v.isActive),
    [product.data],
  );
  const sizes = useMemo(
    () => [...new Set(variants.map((v) => v.size).filter((s): s is string => s != null))],
    [variants],
  );
  const colorOptions = useMemo(
    () => [...new Set(variants.map((v) => v.color).filter((c): c is string => c != null))],
    [variants],
  );

  // Default-select the first available combination once loaded.
  useEffect(() => {
    if (!variants.length) return;
    const first = variants.find((v) => v.inStock) ?? variants[0];
    if (first) {
      setSelectedSize((prev) => prev ?? first.size);
      setSelectedColor((prev) => prev ?? first.color);
    }
  }, [variants]);

  const matchVariant = (size: string | null, color: string | null): VariantDto | undefined =>
    variants.find((v) => v.size === size && v.color === color) ??
    variants.find(
      (v) => (sizes.length === 0 || v.size === size) && (colorOptions.length === 0 || v.color === color),
    );

  const selectedVariant = matchVariant(selectedSize, selectedColor);
  const effectivePrice = selectedVariant
    ? selectedVariant.discountPriceInPaise ?? selectedVariant.priceInPaise
    : product.data
      ? product.data.minDiscountPriceInPaise ?? product.data.minPriceInPaise
      : 0;
  const mrp = selectedVariant
    ? selectedVariant.discountPriceInPaise != null
      ? selectedVariant.priceInPaise
      : null
    : product.data?.minDiscountPriceInPaise != null
      ? product.data.minPriceInPaise
      : null;

  const wished = !!wishlist.data?.some((p) => p.id === product.data?.id);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(t);
  }, [feedback]);

  if (product.isLoading) {
    return (
      <View style={styles.skeletonWrap}>
        <Skeleton width={width} height={width * (4 / 3)} borderRadius={0} />
        <View style={styles.skeletonBody}>
          <Skeleton width="70%" height={22} />
          <Skeleton width="40%" height={18} />
          <Skeleton width="100%" height={14} />
          <Skeleton width="90%" height={14} />
        </View>
      </View>
    );
  }

  if (product.isError || !product.data) {
    return <ErrorState error={product.error} onRetry={() => void product.refetch()} />;
  }

  const detail = product.data;
  const images = [...detail.images].sort((a, b) => a.sortOrder - b.sortOrder);
  const reviewItems = reviews.data?.pages.flatMap((p) => p.items) ?? [];
  const reviewTotal = reviews.data?.pages[0]?.total ?? 0;

  const onAddToCart = () => {
    if (!selectedVariant) {
      setFeedback({ tone: 'error', message: 'Choose a size and colour first.' });
      return;
    }
    addToCart.mutate(
      { variantId: selectedVariant.id, qty: 1 },
      {
        onSuccess: () => setFeedback({ tone: 'success', message: 'Added to your cart.' }),
        onError: (e) => setFeedback({ tone: 'error', message: toApiError(e).message }),
      },
    );
  };

  const onToggleWishlist = () => {
    toggleWishlist.mutate(
      { productId: detail.id, wished },
      { onError: (e) => setFeedback({ tone: 'error', message: toApiError(e).message }) },
    );
  };

  const priceForSize = (size: string): string | undefined => {
    const v = matchVariant(size, selectedColor);
    if (!v) return undefined;
    return formatPaise(v.discountPriceInPaise ?? v.priceInPaise);
  };

  const stockNote = (v: VariantDto | undefined): string | null => {
    if (!v) return null;
    if (!v.inStock) return 'Out of stock';
    if (v.stockQty <= 5) return `Only ${v.stockQty} left`;
    return null;
  };

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }} showsVerticalScrollIndicator={false}>
        {/* Image carousel with graceful cream fallback */}
        <View>
          <FlatList
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            data={images.length ? images : [{ id: 'fallback', url: '', alt: detail.name, sortOrder: 0 }]}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ProductImage
                url={item.url}
                alt={item.alt}
                name={detail.name}
                style={{ width, height: width * (4 / 3) }}
              />
            )}
            onMomentumScrollEnd={(e) =>
              setCarouselIndex(Math.round(e.nativeEvent.contentOffset.x / width))
            }
          />
          {images.length > 1 ? (
            <View style={styles.dots}>
              {images.map((img, i) => (
                <View key={img.id} style={[styles.dot, i === carouselIndex && styles.dotActive]} />
              ))}
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={wished ? 'Remove from wishlist' : 'Add to wishlist'}
            onPress={onToggleWishlist}
            style={({ pressed }) => [styles.wishBtn, pressed && { opacity: 0.7 }]}
            hitSlop={8}
          >
            <Ionicons
              name={wished ? 'heart' : 'heart-outline'}
              size={22}
              color={wished ? colors.brand600 : colors.ink900}
            />
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={styles.name}>{detail.name}</Text>
          <View style={styles.ratingRow}>
            <RatingStars rating={detail.ratingAvg} count={detail.ratingCount} size={14} />
          </View>
          <PriceText priceInPaise={effectivePrice} mrpInPaise={mrp} size="lg" style={styles.price} />
          <Text style={styles.taxNote}>Inclusive of all taxes · Free delivery over ₹999</Text>

          {/* Size selection */}
          {sizes.length > 0 ? (
            <View style={styles.variantGroup}>
              <Text style={styles.variantLabel}>SIZE</Text>
              <View style={styles.chipRow}>
                {sizes.map((size) => {
                  const v = matchVariant(size, selectedColor);
                  return (
                    <Chip
                      key={size}
                      label={size}
                      sublabel={priceForSize(size)}
                      selected={selectedSize === size}
                      disabled={!v}
                      onPress={() => setSelectedSize(size)}
                      accessibilityLabel={`Size ${size}${v ? `, ${formatPaise(v.discountPriceInPaise ?? v.priceInPaise)}${v.inStock ? '' : ', out of stock'}` : ', unavailable'}`}
                    />
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Colour selection */}
          {colorOptions.length > 0 ? (
            <View style={styles.variantGroup}>
              <Text style={styles.variantLabel}>COLOUR</Text>
              <View style={styles.chipRow}>
                {colorOptions.map((color) => {
                  const v = matchVariant(selectedSize, color);
                  return (
                    <Chip
                      key={color}
                      label={color}
                      selected={selectedColor === color}
                      disabled={!v}
                      onPress={() => setSelectedColor(color)}
                      accessibilityLabel={`Colour ${color}${v && !v.inStock ? ', out of stock' : ''}`}
                    />
                  );
                })}
              </View>
            </View>
          ) : null}

          {stockNote(selectedVariant) ? (
            <Text
              style={[
                styles.stockNote,
                { color: selectedVariant?.inStock ? colors.brand700 : colors.error },
              ]}
            >
              {stockNote(selectedVariant)}
            </Text>
          ) : null}

          {/* Description */}
          <Text style={styles.sectionLabel}>ABOUT THIS PIECE</Text>
          <Text style={styles.description}>{detail.description}</Text>

          {detail.attributes && Object.keys(detail.attributes).length > 0 ? (
            <View style={styles.attributes}>
              {Object.entries(detail.attributes).map(([key, value]) => (
                <View key={key} style={styles.attrRow}>
                  <Text style={styles.attrKey}>{key}</Text>
                  <Text style={styles.attrValue}>{value}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Reviews */}
          <Text style={styles.sectionLabel}>
            REVIEWS{reviewTotal ? ` (${reviewTotal})` : ''}
          </Text>
          {reviews.isLoading ? (
            <View style={{ gap: spacing.md }}>
              <Skeleton height={72} borderRadius={radius.card} />
              <Skeleton height={72} borderRadius={radius.card} />
            </View>
          ) : reviewItems.length === 0 ? (
            <EmptyState
              icon="chatbubble-ellipses-outline"
              title="No reviews yet"
              message="Be the first to share how it wears."
            />
          ) : (
            <View style={{ gap: spacing.md }}>
              {reviewItems.map((review: ReviewDto) => (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <RatingStars rating={review.rating} size={12} />
                    {review.verifiedPurchase ? (
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={11} color={colors.success} />
                        <Text style={styles.verifiedText}>Verified purchase</Text>
                      </View>
                    ) : null}
                  </View>
                  {review.title ? <Text style={styles.reviewTitle}>{review.title}</Text> : null}
                  {review.body ? <Text style={styles.reviewBody}>{review.body}</Text> : null}
                  <Text style={styles.reviewMeta}>
                    {review.authorName} · {new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
              ))}
              {reviews.hasNextPage ? (
                <Button
                  title="More reviews"
                  variant="ghost"
                  size="sm"
                  loading={reviews.isFetchingNextPage}
                  onPress={() => void reviews.fetchNextPage()}
                />
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky footer: add to cart */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {feedback ? (
          <View
            style={[
              styles.feedback,
              { backgroundColor: feedback.tone === 'success' ? colors.ink900 : colors.error },
            ]}
            accessibilityLiveRegion="polite"
          >
            <Text style={styles.feedbackText}>{feedback.message}</Text>
            {feedback.tone === 'success' ? (
              <Pressable accessibilityRole="button" accessibilityLabel="View cart" onPress={() => navigation.navigate('Cart')} hitSlop={8}>
                <Text style={styles.feedbackLink}>View cart</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <Button
          title={
            selectedVariant && !selectedVariant.inStock
              ? 'Out of stock'
              : `Add to cart · ${formatPaise(effectivePrice)}`
          }
          onPress={onAddToCart}
          loading={addToCart.isPending}
          disabled={!!selectedVariant && !selectedVariant.inStock}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream50 },
  skeletonWrap: { flex: 1, backgroundColor: colors.cream50 },
  skeletonBody: { padding: spacing.lg, gap: spacing.md },
  dots: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(26, 23, 20, 0.25)',
  },
  dotActive: {
    backgroundColor: colors.brand600,
    width: 16,
  },
  wishBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cream50,
    alignItems: 'center',
    justifyContent: 'center',
    ...hairline,
  },
  body: {
    padding: spacing.lg,
  },
  name: {
    fontFamily: fonts.display,
    fontSize: 23,
    lineHeight: 29,
    letterSpacing: -0.3,
    color: colors.ink900,
  },
  ratingRow: {
    marginTop: 6,
  },
  price: {
    marginTop: spacing.md,
  },
  taxNote: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.ink500,
    marginTop: 4,
  },
  variantGroup: {
    marginTop: spacing.xl,
  },
  variantLabel: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.gold500,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  stockNote: {
    fontFamily: fonts.medium,
    fontSize: 13,
    marginTop: spacing.md,
  },
  sectionLabel: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.gold500,
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 23,
    color: colors.ink700,
  },
  attributes: {
    marginTop: spacing.lg,
    backgroundColor: colors.cream100,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  attrRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  attrKey: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.ink500,
    textTransform: 'capitalize',
  },
  attrValue: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.ink700,
    flexShrink: 1,
    textAlign: 'right',
  },
  reviewCard: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: spacing.lg,
    ...hairline,
    gap: 6,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  verifiedText: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.success,
  },
  reviewTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.ink900,
  },
  reviewBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink700,
  },
  reviewMeta: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.ink500,
    marginTop: 2,
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
  feedback: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  feedbackText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.cream50,
    flexShrink: 1,
  },
  feedbackLink: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.brand500,
  },
});
