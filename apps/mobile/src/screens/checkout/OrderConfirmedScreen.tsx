import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../../components/Button';
import { colors, fonts, spacing } from '../../theme';
import type { AppScreenProps } from '../../navigation/types';

export function OrderConfirmedScreen({ route, navigation }: AppScreenProps<'OrderConfirmed'>) {
  const { orderId, orderNumber } = route.params;
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="checkmark" size={40} color={colors.white} />
        </View>
        <Text style={styles.overline}>ORDER CONFIRMED</Text>
        <Text style={styles.title}>Thank you.</Text>
        <Text style={styles.orderNumber}>{orderNumber}</Text>
        <Text style={styles.message}>
          Your order is confirmed and will be quality-checked before it ships. We'll keep you posted
          at every step.
        </Text>
      </View>
      <View style={styles.actions}>
        <Button title="Track my order" onPress={() => navigation.replace('OrderDetail', { orderId })} />
        <Button
          title="Continue shopping"
          variant="ghost"
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.cream50,
    paddingHorizontal: spacing.xl,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  overline: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: colors.gold500,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 34,
    letterSpacing: -0.6,
    color: colors.ink900,
    marginTop: spacing.sm,
  },
  orderNumber: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.brand600,
    marginTop: spacing.md,
    letterSpacing: 1,
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink500,
    textAlign: 'center',
    marginTop: spacing.lg,
    maxWidth: 300,
  },
  actions: {
    gap: spacing.sm,
  },
});
