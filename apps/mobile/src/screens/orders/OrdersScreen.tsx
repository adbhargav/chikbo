import React from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useInfiniteOrders } from '../../hooks/queries';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Skeleton } from '../../components/Skeleton';
import { StatusPill } from '../../components/StatusPill';
import { colors, fonts, hairline, radius, spacing } from '../../theme';
import type { TabScreenProps } from '../../navigation/types';
import { formatPaise, OrderDto } from '../../types/shared';

export function OrdersScreen({ navigation }: TabScreenProps<'OrdersTab'>) {
  const orders = useInfiniteOrders();
  const items = orders.data?.pages.flatMap((p) => p.items) ?? [];

  if (orders.isLoading) {
    return (
      <View style={styles.skeletonWrap}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={112} borderRadius={radius.card} />
        ))}
      </View>
    );
  }

  if (orders.isError) {
    return <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />;
  }

  return (
    <FlatList
      style={styles.flex}
      contentContainerStyle={styles.container}
      data={items}
      keyExtractor={(item) => item.id}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      refreshing={orders.isRefetching && !orders.isFetchingNextPage}
      onRefresh={() => void orders.refetch()}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (orders.hasNextPage && !orders.isFetchingNextPage) void orders.fetchNextPage();
      }}
      ListEmptyComponent={
        <EmptyState
          icon="cube-outline"
          title="No orders yet"
          message="Your first Chikbo piece is a tap away."
          ctaTitle="Start shopping"
          onCtaPress={() => navigation.navigate('HomeTab')}
        />
      }
      ListFooterComponent={
        orders.isFetchingNextPage ? (
          <ActivityIndicator color={colors.brand600} style={{ marginVertical: spacing.xl }} />
        ) : null
      }
      renderItem={({ item }: { item: OrderDto }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Order ${item.orderNumber}, ${item.status.replace(/_/g, ' ')}, ${formatPaise(item.totalInPaise)}`}
          onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
          style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.cream100 }]}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.orderNumber}>{item.orderNumber}</Text>
            <StatusPill status={item.status} />
          </View>
          <Text style={styles.itemsLine} numberOfLines={1}>
            {item.items.map((i) => i.productName).join(', ')}
          </Text>
          <View style={styles.cardFooter}>
            <Text style={styles.date}>
              {new Date(item.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
              {' · '}
              {item.items.reduce((n, i) => n + i.qty, 0)} item
              {item.items.reduce((n, i) => n + i.qty, 0) === 1 ? '' : 's'}
            </Text>
            <View style={styles.totalRow}>
              <Text style={styles.total}>{formatPaise(item.totalInPaise)}</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.ink300} />
            </View>
          </View>
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
    gap: spacing.sm,
    ...hairline,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNumber: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.ink900,
    letterSpacing: 0.5,
  },
  itemsLine: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.ink700,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.ink500,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  total: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.ink900,
    fontVariant: ['tabular-nums'],
  },
});
