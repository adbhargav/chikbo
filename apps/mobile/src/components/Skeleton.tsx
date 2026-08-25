import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, ViewStyle, StyleProp, DimensionValue } from 'react-native';

import { colors, radius } from '../theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Shimmer-style loading placeholder (opacity pulse — no spinners on content areas). */
export function Skeleton({ width = '100%', height = 16, borderRadius = 6, style }: SkeletonProps) {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      accessibilityElementsHidden
      style={[styles.base, { width, height, borderRadius, opacity: pulse }, style]}
    />
  );
}

/** A 3:4 product-card shaped skeleton for grid/rail loading states. */
export function ProductCardSkeleton({ width = 160 }: { width?: number }) {
  return (
    <Animated.View style={{ width }}>
      <Skeleton width={width} height={width * (4 / 3)} borderRadius={radius.card} />
      <Skeleton width={width * 0.85} height={13} style={{ marginTop: 10 }} />
      <Skeleton width={width * 0.5} height={13} style={{ marginTop: 6 }} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.cream100,
  },
});
