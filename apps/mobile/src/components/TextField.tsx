import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View, StyleProp, ViewStyle } from 'react-native';

import { colors, fonts, radius } from '../theme';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string | null;
  containerStyle?: StyleProp<ViewStyle>;
}

export function TextField({ label, error, containerStyle, ...inputProps }: TextFieldProps) {
  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.ink300}
        accessibilityLabel={label ?? inputProps.placeholder}
        {...inputProps}
        style={[styles.input, error ? styles.inputError : null]}
      />
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.ink700,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.ink300,
    borderRadius: radius.input,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink900,
    minHeight: 48,
  },
  inputError: {
    borderColor: colors.error,
  },
  error: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.error,
  },
});
