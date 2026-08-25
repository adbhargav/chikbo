import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useNotifications } from '../../hooks/queries';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Skeleton } from '../../components/Skeleton';
import { colors, fonts, hairline, radius, spacing } from '../../theme';
import type { AppScreenProps } from '../../navigation/types';
import type { NotificationDto } from '../../api/types';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function NotificationsScreen(_props: AppScreenProps<'Notifications'>) {
  const notifications = useNotifications();

  if (notifications.isLoading) {
    return (
      <View style={styles.skeletonWrap}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={76} borderRadius={radius.card} />
        ))}
      </View>
    );
  }

  if (notifications.isError) {
    return <ErrorState error={notifications.error} onRetry={() => void notifications.refetch()} />;
  }

  return (
    <FlatList
      style={styles.flex}
      contentContainerStyle={styles.container}
      data={notifications.data ?? []}
      keyExtractor={(item) => item.id}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      refreshing={notifications.isRefetching}
      onRefresh={() => void notifications.refetch()}
      ListEmptyComponent={
        <EmptyState
          icon="notifications-outline"
          title="All quiet for now"
          message="Order updates and offers will appear here."
        />
      }
      renderItem={({ item }: { item: NotificationDto }) => (
        <View
          style={[styles.card, !item.readAt && styles.cardUnread]}
          accessible
          accessibilityLabel={`${item.title}. ${item.body}. ${timeAgo(item.createdAt)}`}
        >
          <View style={styles.iconWrap}>
            <Ionicons
              name={item.type === 'ORDER' ? 'cube-outline' : 'sparkles-outline'}
              size={16}
              color={colors.brand600}
            />
          </View>
          <View style={styles.body}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.text}>{item.body}</Text>
            <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
          </View>
          {!item.readAt ? <View style={styles.unreadDot} /> : null}
        </View>
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
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: spacing.lg,
    ...hairline,
  },
  cardUnread: {
    backgroundColor: colors.brand50,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.cream100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.ink900,
  },
  text: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.ink700,
    marginTop: 1,
  },
  time: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.ink500,
    marginTop: 4,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.brand600,
    marginTop: 4,
  },
});
