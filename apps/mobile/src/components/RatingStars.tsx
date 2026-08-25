import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../theme';

interface RatingStarsProps {
  rating: number | null;
  count?: number;
  size?: number;
}

export function RatingStars({ rating, count, size = 12 }: RatingStarsProps) {
  if (rating == null) return null;
  const rounded = Math.round(rating);
  const stars = '★'.repeat(rounded) + '☆'.repeat(5 - rounded);

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`Rated ${rating.toFixed(1)} out of 5${count != null ? `, ${count} reviews` : ''}`}
    >
      <Text style={[styles.stars, { fontSize: size }]}>{stars}</Text>
      <Text style={[styles.value, { fontSize: size - 1 }]}>{rating.toFixed(1)}</Text>
      {count != null ? <Text style={[styles.count, { fontSize: size - 1 }]}>({count})</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stars: {
    color: colors.gold500,
    letterSpacing: 1,
  },
  value: {
    fontFamily: fonts.semibold,
    color: colors.ink700,
  },
  count: {
    fontFamily: fonts.regular,
    color: colors.ink500,
  },
});
