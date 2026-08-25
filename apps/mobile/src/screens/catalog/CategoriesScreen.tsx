import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useCategories } from '../../hooks/queries';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { ProductImage } from '../../components/ProductImage';
import { Skeleton } from '../../components/Skeleton';
import { colors, fonts, hairline, radius, spacing } from '../../theme';
import type { TabScreenProps } from '../../navigation/types';
import type { CategoryDto } from '../../types/shared';

export function CategoriesScreen({ navigation }: TabScreenProps<'CategoriesTab'>) {
  const categories = useCategories();
  const topLevel = (categories.data ?? []).filter((c) => !c.parentId);

  if (categories.isLoading) {
    return (
      <View style={styles.skeletonWrap}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} height={92} borderRadius={radius.card} />
        ))}
      </View>
    );
  }

  if (categories.isError) {
    return <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />;
  }

  return (
    <FlatList
      style={styles.flex}
      contentContainerStyle={styles.container}
      data={topLevel}
      keyExtractor={(item) => item.id}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      ListEmptyComponent={
        <EmptyState title="Nothing here yet" message="Our collections are being woven. Check back soon." />
      }
      renderItem={({ item }: { item: CategoryDto }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Browse ${item.name}`}
          onPress={() =>
            navigation.navigate('ProductList', { categorySlug: item.slug, categoryName: item.name })
          }
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.cream100 }]}
        >
          <ProductImage url={item.imageUrl} name={item.name} style={styles.thumb} borderRadius={10} />
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>{item.name}</Text>
            {item.children && item.children.length > 0 ? (
              <Text style={styles.rowSub} numberOfLines={1}>
                {item.children.map((c) => c.name).join(' · ')}
              </Text>
            ) : (
              <Text style={styles.rowSub}>Browse the collection</Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.ink300} />
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream50 },
  container: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  skeletonWrap: {
    flex: 1,
    backgroundColor: colors.cream50,
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: spacing.md,
    ...hairline,
  },
  thumb: {
    width: 68,
    height: 68,
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.ink900,
  },
  rowSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.ink500,
  },
});
