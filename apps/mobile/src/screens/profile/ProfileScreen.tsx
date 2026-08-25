import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../auth/AuthContext';
import { colors, fonts, hairline, radius, spacing } from '../../theme';
import type { TabScreenProps } from '../../navigation/types';

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}

export function ProfileScreen({ navigation }: TabScreenProps<'ProfileTab'>) {
  const { user, logout } = useAuth();

  const confirmLogout = () => {
    Alert.alert('Sign out', 'Sign out of your Chikbo account?', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void logout() },
    ]);
  };

  const menu: MenuItem[] = [
    { icon: 'person-outline', label: 'Edit profile', onPress: () => navigation.navigate('EditProfile') },
    { icon: 'location-outline', label: 'My addresses', onPress: () => navigation.navigate('Addresses') },
    { icon: 'notifications-outline', label: 'Notifications', onPress: () => navigation.navigate('Notifications') },
    { icon: 'cube-outline', label: 'My orders', onPress: () => navigation.navigate('OrdersTab') },
    { icon: 'heart-outline', label: 'Wishlist', onPress: () => navigation.navigate('WishlistTab') },
  ];

  const initials = (user?.name ?? '?')
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      {/* Identity card */}
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.identityBody}>
          <Text style={styles.name}>{user?.name ?? 'Chikbo customer'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
      </View>

      {/* Menu */}
      <View style={styles.menuCard}>
        {menu.map((item, index) => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={item.onPress}
            style={({ pressed }) => [
              styles.menuRow,
              index < menu.length - 1 && styles.menuRowBorder,
              pressed && { backgroundColor: colors.cream100 },
            ]}
          >
            <Ionicons name={item.icon} size={19} color={colors.ink700} />
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.ink300} />
          </Pressable>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        onPress={confirmLogout}
        style={({ pressed }) => [styles.logoutRow, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="log-out-outline" size={19} color={colors.error} />
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>

      <Text style={styles.footer}>CHIKBO · Dealing in textiles since 1992</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream50 },
  container: {
    padding: spacing.lg,
    paddingBottom: 48,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.cream100,
    borderRadius: radius.card,
    padding: spacing.lg,
    ...hairline,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.white,
  },
  identityBody: {
    flex: 1,
  },
  name: {
    fontFamily: fonts.display,
    fontSize: 19,
    color: colors.ink900,
  },
  email: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.ink500,
    marginTop: 2,
  },
  menuCard: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    marginTop: spacing.lg,
    overflow: 'hidden',
    ...hairline,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 15,
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(185, 178, 169, 0.25)',
  },
  menuLabel: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink900,
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
  },
  logoutText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.error,
  },
  footer: {
    fontFamily: fonts.regular,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.ink300,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
});
