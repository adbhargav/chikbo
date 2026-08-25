import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  StyleProp,
  ViewStyle,
} from 'react-native';

import { colors, fonts, radius } from '../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' && styles.sm,
        variant === 'primary' && { backgroundColor: pressed ? colors.brand700 : colors.brand600 },
        variant === 'danger' && { backgroundColor: pressed ? '#9C2D22' : colors.error },
        variant === 'secondary' && [styles.secondary, pressed && { backgroundColor: colors.cream100 }],
        variant === 'ghost' && [styles.ghost, pressed && { opacity: 0.6 }],
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? colors.white : colors.brand600}
        />
      ) : (
        <Text
          style={[
            styles.label,
            size === 'sm' && styles.labelSm,
            (variant === 'secondary' || variant === 'ghost') && { color: colors.ink900 },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minHeight: 48,
  },
  sm: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    minHeight: 36,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.ink900,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.white,
    letterSpacing: 0.3,
  },
  labelSm: {
    fontSize: 13,
  },
});
