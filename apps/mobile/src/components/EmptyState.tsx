import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, fonts, spacing } from '../theme';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  ctaTitle?: string;
  onCtaPress?: () => void;
}

/** One gentle line + a clear CTA. Never sad-face emoji. */
export function EmptyState({ icon = 'leaf-outline', title, message, ctaTitle, onCtaPress }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={26} color={colors.gold500} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {ctaTitle && onCtaPress ? (
        <Button title={ctaTitle} onPress={onCtaPress} style={styles.cta} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: 56,
    paddingHorizontal: spacing.xl,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.cream100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 19,
    color: colors.ink900,
    textAlign: 'center',
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink500,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  cta: {
    marginTop: spacing.xl,
  },
});
