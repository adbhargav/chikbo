import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '../theme';
import type { OrderStatus } from '../types/shared';

type Tone = 'success' | 'error' | 'info' | 'warn' | 'neutral';

const TONE_FOR_STATUS: Record<OrderStatus, Tone> = {
  PENDING: 'warn',
  CONFIRMED: 'info',
  PROCESSING: 'info',
  SHIPPED: 'info',
  OUT_FOR_DELIVERY: 'info',
  DELIVERED: 'success',
  CANCELLED: 'error',
  RETURN_REQUESTED: 'warn',
  RETURNED: 'neutral',
  REFUND_INITIATED: 'warn',
  REFUNDED: 'success',
};

const TONE_STYLES: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: colors.successTint, fg: colors.success },
  error: { bg: colors.errorTint, fg: colors.error },
  info: { bg: colors.infoTint, fg: colors.info },
  warn: { bg: colors.brand50, fg: colors.brand700 },
  neutral: { bg: colors.cream100, fg: colors.ink500 },
};

interface StatusPillProps {
  status: OrderStatus | string;
  tone?: Tone;
}

export function StatusPill({ status, tone }: StatusPillProps) {
  const resolved: Tone = tone ?? TONE_FOR_STATUS[status as OrderStatus] ?? 'neutral';
  const { bg, fg } = TONE_STYLES[resolved];
  const label = String(status).replace(/_/g, ' ');

  return (
    <View style={[styles.pill, { backgroundColor: bg }]} accessible accessibilityLabel={`Status: ${label}`}>
      <View style={[styles.dot, { backgroundColor: fg }]} />
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 0.4,
  },
});
