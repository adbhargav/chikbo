import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { useCart } from '../hooks/queries';
import { colors, fonts } from '../theme';
import type { AppStackParamList } from '../navigation/types';

/** Cart icon with a count badge — lives in the header, per the design blueprint. */
export function HeaderCartButton() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { data: cart } = useCart(null);
  const count = cart?.items.reduce((sum, item) => sum + item.qty, 0) ?? 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Cart, ${count} item${count === 1 ? '' : 's'}`}
      onPress={() => navigation.navigate('Cart')}
      hitSlop={8}
      style={({ pressed }) => [styles.wrap, pressed && { opacity: 0.6 }]}
    >
      <Ionicons name="bag-outline" size={22} color={colors.ink900} />
      {count > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.brand600,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontFamily: fonts.semibold,
    fontSize: 9,
    color: colors.white,
  },
});
