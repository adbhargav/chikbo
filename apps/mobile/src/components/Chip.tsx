import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fonts, radius } from '../theme';

interface ChipProps {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
  /** Extra line under the label (e.g. per-variant price). */
  sublabel?: string;
  accessibilityLabel?: string;
}

export function Chip({ label, sublabel, selected = false, disabled = false, onPress, accessibilityLabel }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        disabled && styles.disabled,
        pressed && !disabled && { opacity: 0.75 },
      ]}
    >
      <Text style={[styles.label, selected && styles.labelSelected, disabled && styles.labelDisabled]}>
        {label}
      </Text>
      {sublabel ? (
        <Text style={[styles.sublabel, selected && styles.sublabelSelected]}>{sublabel}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.ink300,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  selected: {
    borderColor: colors.brand600,
    backgroundColor: colors.brand50,
  },
  disabled: {
    opacity: 0.45,
    borderStyle: 'dashed',
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.ink700,
  },
  labelSelected: {
    color: colors.brand700,
    fontFamily: fonts.semibold,
  },
  labelDisabled: {
    textDecorationLine: 'line-through',
  },
  sublabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.ink500,
    marginTop: 1,
  },
  sublabelSelected: {
    color: colors.brand700,
  },
});
