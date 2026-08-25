import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, hairline, radius } from '../theme';

interface QtyStepperProps {
  qty: number;
  onChange: (qty: number) => void;
  min?: number;
  max?: number;
  busy?: boolean;
}

export function QtyStepper({ qty, onChange, min = 1, max = 10, busy = false }: QtyStepperProps) {
  const canDec = qty > min && !busy;
  const canInc = qty < max && !busy;

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
        accessibilityState={{ disabled: !canDec }}
        disabled={!canDec}
        onPress={() => onChange(qty - 1)}
        style={({ pressed }) => [styles.btn, pressed && styles.pressed, !canDec && styles.disabled]}
        hitSlop={8}
      >
        <Text style={styles.sign}>−</Text>
      </Pressable>
      <View style={styles.qtyBox} accessible accessibilityLabel={`Quantity ${qty}`}>
        {busy ? (
          <ActivityIndicator size="small" color={colors.brand600} />
        ) : (
          <Text style={styles.qty}>{qty}</Text>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        accessibilityState={{ disabled: !canInc }}
        disabled={!canInc}
        onPress={() => onChange(qty + 1)}
        style={({ pressed }) => [styles.btn, pressed && styles.pressed, !canInc && styles.disabled]}
        hitSlop={8}
      >
        <Text style={styles.sign}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    ...hairline,
    backgroundColor: colors.white,
  },
  btn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: colors.cream100,
    borderRadius: radius.pill,
  },
  disabled: {
    opacity: 0.35,
  },
  sign: {
    fontFamily: fonts.medium,
    fontSize: 17,
    color: colors.ink900,
  },
  qtyBox: {
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qty: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.ink900,
    fontVariant: ['tabular-nums'],
  },
});
