import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { toApiError } from '../api/client';
import { colors, fonts, spacing } from '../theme';
import { Button } from './Button';

interface ErrorStateProps {
  error?: unknown;
  title?: string;
  onRetry?: () => void;
}

export function ErrorState({ error, title = 'Something went astray', onRetry }: ErrorStateProps) {
  const message = error ? toApiError(error).message : 'Please try again in a moment.';

  return (
    <View style={styles.wrap}>
      <View style={styles.iconCircle}>
        <Ionicons name="cloud-offline-outline" size={26} color={colors.error} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <Button title="Try again" onPress={onRetry} variant="secondary" style={styles.cta} />
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
    backgroundColor: colors.errorTint,
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
