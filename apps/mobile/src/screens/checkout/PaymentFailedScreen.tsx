import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../../components/Button';
import { colors, fonts, spacing } from '../../theme';
import type { AppScreenProps } from '../../navigation/types';

export function PaymentFailedScreen({ route, navigation }: AppScreenProps<'PaymentFailed'>) {
  const { addressId, couponCode, idempotencyKey, message } = route.params;
  const insets = useSafeAreaInsets();

  const retry = () =>
    // Same idempotencyKey → the server reuses the same pending order.
    navigation.replace('Payment', {
      addressId,
      ...(couponCode ? { couponCode } : {}),
      idempotencyKey,
    });

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="close" size={38} color={colors.white} />
        </View>
        <Text style={styles.title}>Payment didn't go through</Text>
        <Text style={styles.message}>
          {message ?? 'The payment was cancelled or declined. No money was captured — you can try again safely.'}
        </Text>
      </View>
      <View style={styles.actions}>
        <Button title="Try payment again" onPress={retry} />
        <Button
          title="Back to cart"
          variant="secondary"
          onPress={() => navigation.reset({ index: 1, routes: [{ name: 'Tabs' }, { name: 'Cart' }] })}
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
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: -0.4,
    color: colors.ink900,
    textAlign: 'center',
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
