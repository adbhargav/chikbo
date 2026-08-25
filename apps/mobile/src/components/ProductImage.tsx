import React, { useState } from 'react';
import { Image, StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';

import { absoluteUrl } from '../config';
import { colors, fonts } from '../theme';

interface ProductImageProps {
  /** Server-relative or absolute URL. Seed data paths often 404 — we always fall back gracefully. */
  url: string | null | undefined;
  /** Product name shown inside the cream fallback block. */
  name: string;
  alt?: string | null;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
}

/**
 * Product image with a graceful cream fallback: a --cream-100 block with a
 * subtle Chikbo monogram and the product name. NEVER a broken-image glyph.
 */
export function ProductImage({ url, name, alt, style, borderRadius = 0 }: ProductImageProps) {
  const [failed, setFailed] = useState(false);
  const src = absoluteUrl(url);
  const showFallback = failed || !src;

  return (
    <View style={[styles.wrap, { borderRadius }, style]}>
      {showFallback ? (
        <View style={styles.fallback} accessible accessibilityLabel={alt ?? name}>
          <Text style={styles.monogram}>C</Text>
          <Text style={styles.fallbackName} numberOfLines={2}>
            {name}
          </Text>
        </View>
      ) : (
        <Image
          source={{ uri: src }}
          onError={() => setFailed(true)}
          style={styles.image}
          resizeMode="cover"
          accessible
          accessibilityLabel={alt ?? name}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.cream100,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: colors.cream100,
  },
  monogram: {
    fontFamily: fonts.display,
    fontSize: 44,
    color: colors.ink300,
    marginBottom: 6,
  },
  fallbackName: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.ink500,
    textAlign: 'center',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
