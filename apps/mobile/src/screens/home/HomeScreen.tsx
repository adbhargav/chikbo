import React from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useCategories, useInfiniteProducts } from '../../hooks/queries';
import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { ProductCard } from '../../components/ProductCard';
import { ProductImage } from '../../components/ProductImage';
import { ProductCardSkeleton, Skeleton } from '../../components/Skeleton';
import { SectionHeader } from '../../components/SectionHeader';
import { colors, fonts, hairline, radius, spacing } from '../../theme';
import type { TabScreenProps } from '../../navigation/types';
import type { CategoryDto } from '../../types/shared';

const TRUST_ITEMS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'ribbon-outline', label: 'Since 1992' },
  { icon: 'shield-checkmark-outline', label: 'Quality checked' },
  { icon: 'lock-closed-outline', label: 'Secure payments' },
  { icon: 'airplane-outline', label: 'Pan-India' },
];

export function HomeScreen({ navigation }: TabScreenProps<'HomeTab'>) {
  const { width } = useWindowDimensions();
  const categories = useCategories();
  const newArrivals = useInfiniteProducts({ sort: 'newest', pageSize: 10 });

  const topCategories: CategoryDto[] = (categories.data ?? []).filter((c) => !c.parentId).slice(0, 5);
  const railProducts = newArrivals.data?.pages[0]?.items ?? [];
  const tileWidth = (width - spacing.lg * 2 - spacing.md) / 2;

  const refreshing =
    (categories.isRefetching || newArrivals.isRefetching) && !categories.isLoading;

  const onRefresh = () => {
    void categories.refetch();
    void newArrivals.refetch();
  };

  const openCategory = (category: CategoryDto) =>
    navigation.navigate('ProductList', { categorySlug: category.slug, categoryName: category.name });

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand600} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroOverline}>DEALING IN TEXTILES SINCE 1992</Text>
        <Text style={styles.heroTitle}>Woven with{'\n'}Trust.</Text>
        <Text style={styles.heroSub}>Trust, Quality and Budget friendly — handpicked Indian fashion, delivered pan-India.</Text>
        <Button
          title="Shop new arrivals"
          onPress={() => navigation.navigate('ProductList', { categoryName: 'New Arrivals' })}
          style={styles.heroCta}
        />
        <View style={styles.heroGlow} pointerEvents="none" />
      </View>

      {/* Category tiles */}
      <SectionHeader overline="Explore" title="Shop by Category" style={styles.sectionHeader} />
      {categories.isLoading ? (
        <View style={styles.tileGrid}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} width={i === 0 ? width - spacing.lg * 2 : tileWidth} height={i === 0 ? 140 : 110} borderRadius={radius.card} />
          ))}
        </View>
      ) : categories.isError ? (
        <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
      ) : (
        <View style={styles.tileGrid}>
          {topCategories.map((category, index) => (
            <Pressable
              key={category.id}
              accessibilityRole="button"
              accessibilityLabel={`Shop ${category.name}`}
              onPress={() => openCategory(category)}
              style={({ pressed }) => [
                styles.tile,
                { width: index === 0 ? width - spacing.lg * 2 : tileWidth, height: index === 0 ? 140 : 110 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <ProductImage
                url={category.imageUrl}
                name={category.name}
                style={styles.tileImage}
                borderRadius={radius.card}
              />
              <View style={styles.tileScrim} />
              <Text style={styles.tileName}>{category.name}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* New arrivals rail */}
      <SectionHeader overline="Just In" title="New Arrivals" style={styles.sectionHeader} />
      {newArrivals.isLoading ? (
        <View style={styles.railSkeleton}>
          <ProductCardSkeleton width={150} />
          <ProductCardSkeleton width={150} />
          <ProductCardSkeleton width={150} />
        </View>
      ) : newArrivals.isError ? (
        <ErrorState error={newArrivals.error} onRetry={() => void newArrivals.refetch()} />
      ) : (
        <FlatList
          horizontal
          data={railProducts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              width={150}
              onPress={() => navigation.navigate('ProductDetail', { slug: item.slug, name: item.name })}
            />
          )}
          contentContainerStyle={styles.rail}
          ItemSeparatorComponent={() => <View style={{ width: spacing.md }} />}
          showsHorizontalScrollIndicator={false}
        />
      )}

      {/* Trust strip */}
      <View style={styles.trustStrip}>
        {TRUST_ITEMS.map((item) => (
          <View key={item.label} style={styles.trustItem}>
            <Ionicons name={item.icon} size={18} color={colors.gold500} />
            <Text style={styles.trustLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.footerLine}>Free delivery over ₹999 · Pan-India shipping</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream50 },
  container: { paddingBottom: 48 },
  hero: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    backgroundColor: colors.cream100,
    borderRadius: 16,
    padding: spacing.xl,
    overflow: 'hidden',
    ...hairline,
  },
  heroOverline: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    letterSpacing: 2.2,
    color: colors.gold500,
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1,
    color: colors.ink900,
    marginTop: spacing.md,
  },
  heroSub: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink500,
    marginTop: spacing.md,
    maxWidth: 280,
  },
  heroCta: {
    marginTop: spacing.xl,
    alignSelf: 'flex-start',
  },
  heroGlow: {
    position: 'absolute',
    right: -70,
    top: -70,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: colors.brand50,
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  tile: {
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  tileImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  tileScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(26, 23, 20, 0.22)',
    borderRadius: radius.card,
  },
  tileName: {
    position: 'absolute',
    left: 14,
    bottom: 12,
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.cream50,
    letterSpacing: 0.2,
    textShadowColor: 'rgba(26, 23, 20, 0.5)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
  },
  rail: {
    paddingHorizontal: spacing.lg,
  },
  railSkeleton: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  trustStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: spacing.lg,
    marginTop: spacing.xxl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.brand50,
    borderRadius: radius.card,
  },
  trustItem: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  trustLabel: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.ink700,
    textAlign: 'center',
  },
  footerLine: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.ink500,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
