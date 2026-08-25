import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAddresses } from '../../hooks/queries';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Skeleton } from '../../components/Skeleton';
import { colors, fonts, hairline, radius, spacing } from '../../theme';
import type { AppScreenProps } from '../../navigation/types';

export function AddressesScreen({ navigation }: AppScreenProps<'Addresses'>) {
  const addresses = useAddresses();

  if (addresses.isLoading) {
    return (
      <View style={styles.skeletonWrap}>
        {[0, 1].map((i) => (
          <Skeleton key={i} height={110} borderRadius={radius.card} />
        ))}
      </View>
    );
  }

  if (addresses.isError) {
    return <ErrorState error={addresses.error} onRetry={() => void addresses.refetch()} />;
  }

  const list = addresses.data ?? [];

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      {list.length === 0 ? (
        <EmptyState
          icon="location-outline"
          title="No addresses saved"
          message="Add an address to breeze through checkout."
          ctaTitle="Add address"
          onCtaPress={() => navigation.navigate('AddressForm')}
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          {list.map((address) => (
            <Pressable
              key={address.id}
              accessibilityRole="button"
              accessibilityLabel={`Edit address for ${address.fullName}`}
              onPress={() => navigation.navigate('AddressForm', { address })}
              style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.cream100 }]}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardName}>{address.fullName}</Text>
                <View style={styles.headerRight}>
                  {address.isDefault ? (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                    </View>
                  ) : null}
                  <Ionicons name="pencil-outline" size={15} color={colors.ink500} />
                </View>
              </View>
              <Text style={styles.cardLine}>
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ''}
              </Text>
              <Text style={styles.cardLine}>
                {address.city}, {address.state} — {address.pincode}
              </Text>
              <Text style={styles.cardPhone}>{address.phone}</Text>
            </Pressable>
          ))}
          <Button title="Add new address" variant="secondary" onPress={() => navigation.navigate('AddressForm')} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream50 },
  container: {
    padding: spacing.lg,
    paddingBottom: 40,
    flexGrow: 1,
  },
  skeletonWrap: {
    flex: 1,
    backgroundColor: colors.cream50,
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: 3,
    ...hairline,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardName: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.ink900,
  },
  defaultBadge: {
    backgroundColor: colors.brand50,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  defaultBadgeText: {
    fontFamily: fonts.semibold,
    fontSize: 8,
    letterSpacing: 1,
    color: colors.brand700,
  },
  cardLine: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink700,
  },
  cardPhone: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.ink500,
    marginTop: 2,
  },
});
