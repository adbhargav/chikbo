import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';

import { useAddresses } from '../../hooks/queries';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Skeleton } from '../../components/Skeleton';
import { colors, fonts, hairline, radius, spacing } from '../../theme';
import type { AppScreenProps } from '../../navigation/types';

export function AddressSelectScreen({ route, navigation }: AppScreenProps<'AddressSelect'>) {
  const { couponCode } = route.params;
  const insets = useSafeAreaInsets();
  const addresses = useAddresses();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Preselect the default address once loaded.
  useEffect(() => {
    if (addresses.data && !selectedId) {
      const preferred = addresses.data.find((a) => a.isDefault) ?? addresses.data[0];
      if (preferred) setSelectedId(preferred.id);
    }
  }, [addresses.data, selectedId]);

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

  const proceed = () => {
    if (!selectedId) return;
    navigation.navigate('Payment', {
      addressId: selectedId,
      ...(couponCode ? { couponCode } : {}),
      // Client-generated UUID; kept stable across retries so the server
      // returns the same pending order.
      idempotencyKey: Crypto.randomUUID(),
    });
  };

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 + insets.bottom }}>
        {list.length === 0 ? (
          <EmptyState
            icon="location-outline"
            title="Where should we deliver?"
            message="Add your first delivery address to continue."
            ctaTitle="Add address"
            onCtaPress={() => navigation.navigate('AddressForm')}
          />
        ) : (
          <View style={{ gap: spacing.md }}>
            {list.map((address) => {
              const selected = address.id === selectedId;
              return (
                <Pressable
                  key={address.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Deliver to ${address.fullName}, ${address.line1}, ${address.city} ${address.pincode}`}
                  onPress={() => setSelectedId(address.id)}
                  style={[styles.card, selected && styles.cardSelected]}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.radioRow}>
                      <View style={[styles.radio, selected && styles.radioSelected]}>
                        {selected ? <View style={styles.radioDot} /> : null}
                      </View>
                      <Text style={styles.cardName}>{address.fullName}</Text>
                      {address.isDefault ? (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                        </View>
                      ) : null}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Edit address for ${address.fullName}`}
                      onPress={() => navigation.navigate('AddressForm', { address })}
                      hitSlop={8}
                    >
                      <Ionicons name="pencil-outline" size={16} color={colors.ink500} />
                    </Pressable>
                  </View>
                  <Text style={styles.cardLines}>
                    {address.line1}
                    {address.line2 ? `, ${address.line2}` : ''}
                  </Text>
                  <Text style={styles.cardLines}>
                    {address.city}, {address.state} — {address.pincode}
                  </Text>
                  <Text style={styles.cardPhone}>{address.phone}</Text>
                </Pressable>
              );
            })}
            <Button
              title="Add new address"
              variant="secondary"
              onPress={() => navigation.navigate('AddressForm')}
            />
          </View>
        )}
      </ScrollView>

      {list.length > 0 ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button title="Proceed to payment" onPress={proceed} disabled={!selectedId} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream50 },
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
    gap: 4,
    ...hairline,
  },
  cardSelected: {
    borderColor: colors.brand600,
    borderWidth: 1.5,
    backgroundColor: colors.brand50,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.ink300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.brand600,
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.brand600,
  },
  cardName: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.ink900,
  },
  defaultBadge: {
    backgroundColor: colors.cream100,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  defaultBadgeText: {
    fontFamily: fonts.semibold,
    fontSize: 8,
    letterSpacing: 1,
    color: colors.gold500,
  },
  cardLines: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink700,
    marginLeft: 26,
  },
  cardPhone: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.ink500,
    marginLeft: 26,
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.cream50,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(185, 178, 169, 0.4)',
  },
});
