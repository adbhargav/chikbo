import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, hairline, radius } from '../theme';
import type { ProductListItemDto } from '../types/shared';
import { PriceText } from './PriceText';
import { ProductImage } from './ProductImage';
import { RatingStars } from './RatingStars';

interface ProductCardProps {
  product: ProductListItemDto;
  onPress: () => void;
  width?: number;
}

export function ProductCard({ product, onPress, width = 160 }: ProductCardProps) {
  const price = product.minDiscountPriceInPaise ?? product.minPriceInPaise;
  const mrp = product.minDiscountPriceInPaise != null ? product.minPriceInPaise : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, view product`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}
    >
      <View style={{ width, height: width * (4 / 3) }}>
        <ProductImage
          url={product.thumbnailUrl}
          name={product.name}
          style={styles.image}
          borderRadius={radius.card}
        />
        {!product.inStock ? (
          <View style={styles.soldOut}>
            <Text style={styles.soldOutText}>SOLD OUT</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <PriceText priceInPaise={price} mrpInPaise={mrp} size="sm" />
        <RatingStars rating={product.ratingAvg} count={product.ratingCount} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
  },
  pressed: {
    opacity: 0.85,
  },
  image: {
    flex: 1,
    ...hairline,
    borderRadius: radius.card,
  },
  soldOut: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: colors.ink900,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  soldOutText: {
    fontFamily: fonts.semibold,
    fontSize: 9,
    color: colors.cream50,
    letterSpacing: 1,
  },
  body: {
    paddingTop: 8,
    gap: 4,
  },
  name: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink700,
  },
});
