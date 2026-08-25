import React from 'react';
import { StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';

import { colors, fonts } from '../theme';

interface SectionHeaderProps {
  overline?: string;
  title: string;
  style?: StyleProp<ViewStyle>;
}

/** Gold overline label above a Fraunces heading — e.g. "SINCE 1992 / New Arrivals". */
export function SectionHeader({ overline, title, style }: SectionHeaderProps) {
  return (
    <View style={[styles.wrap, style]} accessible accessibilityRole="header" accessibilityLabel={title}>
      {overline ? <Text style={styles.overline}>{overline.toUpperCase()}</Text> : null}
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
  },
  overline: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: colors.gold500,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: -0.4,
    color: colors.ink900,
  },
});
