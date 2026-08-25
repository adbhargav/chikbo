import React from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useToggleWishlist, useWishlist } from '../../hooks/queries';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { ProductCard } from '../../components/ProductCard';
import { ProductCardSkeleton } from '../../components/Skeleton';
import { colors, hairline, spacing } from '../../theme';
import type { TabScreenProps } from '../../navigation/types';

export function WishlistScreen({ navigation }: TabScreenProps<'WishlistTab'>) {
  const wishlist = useWishlist();
  const toggle = useToggleWishlist();
  const { width } = useWindowDimensions();
  const cardWidth = (width - spacing.lg * 2 - spacing.md) / 2;

  if (wishlist.isLoading) {
    return (
      <View style={styles.skeletonGrid}>
        {[0, 1, 2, 3].map((i) => (
          <ProductCardSkeleton key={i} width={cardWidth} />
        ))}
      </View>
    );
  }

  if (wishlist.isError) {
    return <ErrorState error={wishlist.error} onRetry={() => void wishlist.refetch()} />;
  }

  return (
    <FlatList
      style={styles.flex}
      contentContainerStyle={styles.grid}
      data={wishlist.data ?? []}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={styles.columnWrapper}
      refreshing={wishlist.isRefetching}
      onRefresh={() => void wishlist.refetch()}
      ListEmptyComponent={
        <EmptyState
          icon="heart-outline"
          title="Nothing saved yet"
          message="Tap the heart on any piece you love — it'll wait for you here."
          ctaTitle="Discover pieces"
          onCtaPress={() => navigation.navigate('HomeTab')}
        />
      }
      renderItem={({ item }) => (
        <View style={{ width: cardWidth }}>
          <ProductCard
            product={item}
            width={cardWidth}
            onPress={() => navigation.navigate('ProductDetail', { slug: item.slug, name: item.name })}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.name} from wishlist`}
            onPress={() => toggle.mutate({ productId: item.id, wished: true })}
            style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.6 }]}
            hitSlop={6}
          >
            <Ionicons name="heart" size={18} color={colors.brand600} />
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream50 },
  grid: {
    padding: spacing.lg,
    paddingBottom: 40,
    flexGrow: 1,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  skeletonGrid: {
    flex: 1,
    backgroundColor: colors.cream50,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    padding: spacing.lg,
  },
  removeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.cream50,
    alignItems: 'center',
    justifyContent: 'center',
    ...hairline,
  },
});
