import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useInfiniteProducts } from '../../hooks/queries';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { ProductCard } from '../../components/ProductCard';
import { ProductCardSkeleton } from '../../components/Skeleton';
import { colors, fonts, hairline, radius, spacing } from '../../theme';
import type { AppScreenProps } from '../../navigation/types';
import type { ProductListParams } from '../../api/types';

type SortOption = NonNullable<ProductListParams['sort']>;

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest',
  price_asc: 'Price: Low to High',
  price_desc: 'Price: High to Low',
  rating: 'Top Rated',
};

const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'];

interface PriceRange {
  label: string;
  minPrice?: number;
  maxPrice?: number;
}

const PRICE_RANGES: PriceRange[] = [
  { label: 'Under ₹500', maxPrice: 500 },
  { label: '₹500 – ₹999', minPrice: 500, maxPrice: 999 },
  { label: '₹1,000 – ₹1,999', minPrice: 1000, maxPrice: 1999 },
  { label: '₹2,000+', minPrice: 2000 },
];

export function ProductListScreen({ route, navigation }: AppScreenProps<'ProductList'>) {
  const { categorySlug } = route.params;
  const { width } = useWindowDimensions();
  const [sort, setSort] = useState<SortOption>('newest');
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  // Applied filters
  const [sizes, setSizes] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<PriceRange | null>(null);

  // Draft filters while the sheet is open
  const [draftSizes, setDraftSizes] = useState<string[]>([]);
  const [draftPrice, setDraftPrice] = useState<PriceRange | null>(null);

  const params = useMemo<Omit<ProductListParams, 'page'>>(
    () => ({
      sort,
      ...(categorySlug ? { category: categorySlug } : {}),
      ...(sizes.length ? { sizes: sizes.join(',') } : {}),
      ...(priceRange?.minPrice != null ? { minPrice: priceRange.minPrice } : {}),
      ...(priceRange?.maxPrice != null ? { maxPrice: priceRange.maxPrice } : {}),
    }),
    [sort, categorySlug, sizes, priceRange],
  );

  const query = useInfiniteProducts(params);
  const products = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages[0]?.total;
  const cardWidth = (width - spacing.lg * 2 - spacing.md) / 2;
  const activeFilterCount = sizes.length + (priceRange ? 1 : 0);

  const openFilters = () => {
    setDraftSizes(sizes);
    setDraftPrice(priceRange);
    setFilterOpen(true);
  };

  const applyFilters = () => {
    setSizes(draftSizes);
    setPriceRange(draftPrice);
    setFilterOpen(false);
  };

  const clearFilters = () => {
    setDraftSizes([]);
    setDraftPrice(null);
  };

  const toggleDraftSize = (size: string) =>
    setDraftSizes((prev) => (prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]));

  return (
    <View style={styles.flex}>
      {/* Toolbar: sort + filters */}
      <View style={styles.toolbar}>
        <Text style={styles.count}>
          {total != null ? `${total} style${total === 1 ? '' : 's'}` : ' '}
        </Text>
        <View style={styles.toolbarActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Sort by ${SORT_LABELS[sort]}`}
            onPress={() => setSortOpen(true)}
            style={({ pressed }) => [styles.toolBtn, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="swap-vertical" size={14} color={colors.ink700} />
            <Text style={styles.toolBtnText}>{SORT_LABELS[sort]}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Filters${activeFilterCount ? `, ${activeFilterCount} active` : ''}`}
            onPress={openFilters}
            style={({ pressed }) => [styles.toolBtn, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="options-outline" size={14} color={colors.ink700} />
            <Text style={styles.toolBtnText}>
              Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
            </Text>
          </Pressable>
        </View>
      </View>

      {query.isLoading ? (
        <View style={styles.skeletonGrid}>
          {[0, 1, 2, 3].map((i) => (
            <ProductCardSkeleton key={i} width={cardWidth} />
          ))}
        </View>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              width={cardWidth}
              onPress={() => navigation.navigate('ProductDetail', { slug: item.slug, name: item.name })}
            />
          )}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => void query.refetch()}
          ListEmptyComponent={
            <EmptyState
              icon="shirt-outline"
              title="No styles match"
              message="Try loosening a filter — new pieces arrive often."
              ctaTitle={activeFilterCount ? 'Clear filters' : undefined}
              onCtaPress={
                activeFilterCount
                  ? () => {
                      setSizes([]);
                      setPriceRange(null);
                    }
                  : undefined
              }
            />
          }
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <ActivityIndicator color={colors.brand600} style={styles.footerSpinner} />
            ) : null
          }
        />
      )}

      {/* Sort sheet */}
      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSortOpen(false)} accessibilityLabel="Close sort options">
          <View />
        </Pressable>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Sort by</Text>
          {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityLabel={SORT_LABELS[option]}
              accessibilityState={{ selected: sort === option }}
              onPress={() => {
                setSort(option);
                setSortOpen(false);
              }}
              style={({ pressed }) => [styles.sortRow, pressed && { backgroundColor: colors.cream100 }]}
            >
              <Text style={[styles.sortLabel, sort === option && styles.sortLabelActive]}>
                {SORT_LABELS[option]}
              </Text>
              {sort === option ? <Ionicons name="checkmark" size={18} color={colors.brand600} /> : null}
            </Pressable>
          ))}
        </View>
      </Modal>

      {/* Filter sheet */}
      <Modal visible={filterOpen} transparent animationType="fade" onRequestClose={() => setFilterOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setFilterOpen(false)} accessibilityLabel="Close filters">
          <View />
        </Pressable>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filters</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Clear all filters" onPress={clearFilters} hitSlop={8}>
              <Text style={styles.clearLink}>Clear all</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.sheetScroll}>
            <Text style={styles.filterGroupLabel}>SIZE</Text>
            <View style={styles.chipRow}>
              {SIZE_OPTIONS.map((size) => (
                <Chip
                  key={size}
                  label={size}
                  selected={draftSizes.includes(size)}
                  onPress={() => toggleDraftSize(size)}
                />
              ))}
            </View>
            <Text style={[styles.filterGroupLabel, { marginTop: spacing.xl }]}>PRICE</Text>
            <View style={styles.chipRow}>
              {PRICE_RANGES.map((range) => (
                <Chip
                  key={range.label}
                  label={range.label}
                  selected={draftPrice?.label === range.label}
                  onPress={() => setDraftPrice(draftPrice?.label === range.label ? null : range)}
                />
              ))}
            </View>
          </ScrollView>
          <Button title="Apply filters" onPress={applyFilters} style={styles.applyBtn} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream50 },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  count: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.ink500,
  },
  toolbarActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.white,
    ...hairline,
  },
  toolBtnText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.ink700,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  grid: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  footerSpinner: {
    marginVertical: spacing.xl,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 23, 20, 0.4)',
  },
  sheet: {
    backgroundColor: colors.cream50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    maxHeight: '70%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink900,
    marginBottom: spacing.md,
  },
  clearLink: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.brand600,
  },
  sheetScroll: {
    marginBottom: spacing.lg,
  },
  filterGroupLabel: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.gold500,
    marginBottom: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  applyBtn: {
    marginTop: spacing.sm,
  },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
  },
  sortLabel: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink700,
  },
  sortLabelActive: {
    fontFamily: fonts.semibold,
    color: colors.ink900,
  },
});
