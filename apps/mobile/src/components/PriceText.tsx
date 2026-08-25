import React from 'react';
import { StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';

import { colors, fonts } from '../theme';
import { formatPaise, Paise } from '../types/shared';

interface PriceTextProps {
  priceInPaise: Paise;
  /** Original MRP — rendered struck-through when higher than the price. */
  mrpInPaise?: Paise | null;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
}

const SIZES = { sm: 13, md: 16, lg: 20 } as const;

export function PriceText({ priceInPaise, mrpInPaise, size = 'md', style }: PriceTextProps) {
  const fontSize = SIZES[size];
  const showMrp = mrpInPaise != null && mrpInPaise > priceInPaise;
  const offPct = showMrp ? Math.round(((mrpInPaise - priceInPaise) / mrpInPaise) * 100) : 0;

  return (
    <View style={[styles.row, style]} accessible accessibilityLabel={priceLabel(priceInPaise, showMrp ? mrpInPaise : null)}>
      <Text style={[styles.price, { fontSize }]}>{formatPaise(priceInPaise)}</Text>
      {showMrp ? (
        <>
          <Text style={[styles.mrp, { fontSize: fontSize - 2 }]}>{formatPaise(mrpInPaise)}</Text>
          <Text style={[styles.off, { fontSize: fontSize - 3 }]}>{offPct}% off</Text>
        </>
      ) : null}
    </View>
  );
}

function priceLabel(price: Paise, mrp: Paise | null): string {
  const p = formatPaise(price);
  return mrp ? `Price ${p}, was ${formatPaise(mrp)}` : `Price ${p}`;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    flexWrap: 'wrap',
  },
  price: {
    fontFamily: fonts.semibold,
    color: colors.ink900,
    fontVariant: ['tabular-nums'],
  },
  mrp: {
    fontFamily: fonts.regular,
    color: colors.ink500,
    textDecorationLine: 'line-through',
    fontVariant: ['tabular-nums'],
  },
  off: {
    fontFamily: fonts.medium,
    color: colors.success,
  },
});
