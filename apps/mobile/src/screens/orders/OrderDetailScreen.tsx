import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { toApiError } from '../../api/client';
import { useCancelOrder, useOrder } from '../../hooks/queries';
import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { PriceText } from '../../components/PriceText';
import { ProductImage } from '../../components/ProductImage';
import { Skeleton } from '../../components/Skeleton';
import { StatusPill } from '../../components/StatusPill';
import { colors, fonts, hairline, radius, spacing } from '../../theme';
import type { AppScreenProps } from '../../navigation/types';
import {
  CANCELLABLE_STATUSES,
  formatPaise,
  OrderStatus,
  RETURNABLE_STATUSES,
} from '../../types/shared';

const TIMELINE_STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'PENDING', label: 'Order placed' },
  { status: 'CONFIRMED', label: 'Confirmed' },
  { status: 'PROCESSING', label: 'Being prepared' },
  { status: 'SHIPPED', label: 'Shipped' },
  { status: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { status: 'DELIVERED', label: 'Delivered' },
];

const TERMINAL_LABELS: Partial<Record<OrderStatus, string>> = {
  CANCELLED: 'This order was cancelled.',
  RETURN_REQUESTED: 'A return has been requested for this order.',
  RETURNED: 'This order was returned.',
  REFUND_INITIATED: 'Your refund is on its way.',
  REFUNDED: 'This order has been refunded.',
};

export function OrderDetailScreen({ route, navigation }: AppScreenProps<'OrderDetail'>) {
  const { orderId } = route.params;
  const order = useOrder(orderId);
  const cancelOrder = useCancelOrder(orderId);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  if (order.isLoading) {
    return (
      <View style={styles.skeletonWrap}>
        <Skeleton height={80} borderRadius={radius.card} />
        <Skeleton height={200} borderRadius={radius.card} />
        <Skeleton height={140} borderRadius={radius.card} />
      </View>
    );
  }

  if (order.isError || !order.data) {
    return <ErrorState error={order.error} onRetry={() => void order.refetch()} />;
  }

  const data = order.data;
  const timelineIndex = TIMELINE_STEPS.findIndex((s) => s.status === data.status);
  const onForwardPath = timelineIndex >= 0;
  const canCancel = CANCELLABLE_STATUSES.includes(data.status);
  const canReturn = RETURNABLE_STATUSES.includes(data.status);

  const submitCancel = () => {
    const reason = cancelReason.trim();
    if (!reason) {
      setCancelError('Please tell us why you are cancelling.');
      return;
    }
    setCancelError(null);
    cancelOrder.mutate(reason, {
      onSuccess: () => {
        setCancelOpen(false);
        setCancelReason('');
      },
      onError: (e) => setCancelError(toApiError(e).message),
    });
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.orderNumber}>{data.orderNumber}</Text>
            <Text style={styles.date}>
              Placed{' '}
              {new Date(data.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          </View>
          <StatusPill status={data.status} />
        </View>
      </View>

      {/* Timeline */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>ORDER JOURNEY</Text>
        {onForwardPath ? (
          TIMELINE_STEPS.map((step, index) => {
            const done = index <= timelineIndex;
            const isLast = index === TIMELINE_STEPS.length - 1;
            return (
              <View key={step.status} style={styles.timelineRow}>
                <View style={styles.timelineRail}>
                  <View style={[styles.timelineDot, done && styles.timelineDotDone]}>
                    {done ? <Ionicons name="checkmark" size={10} color={colors.white} /> : null}
                  </View>
                  {!isLast ? (
                    <View style={[styles.timelineLine, index < timelineIndex && styles.timelineLineDone]} />
                  ) : null}
                </View>
                <Text style={[styles.timelineLabel, done && styles.timelineLabelDone]}>{step.label}</Text>
              </View>
            );
          })
        ) : (
          <Text style={styles.terminalNote}>{TERMINAL_LABELS[data.status] ?? data.status}</Text>
        )}
      </View>

      {/* Tracking */}
      {data.awbCode || (data.trackingEvents && data.trackingEvents.length > 0) ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>TRACKING</Text>
          {data.awbCode ? (
            <View style={styles.awbRow}>
              <Ionicons name="airplane-outline" size={15} color={colors.gold500} />
              <Text style={styles.awbText}>
                {data.courierName ?? 'Courier'} · AWB {data.awbCode}
              </Text>
            </View>
          ) : null}
          {(data.trackingEvents ?? []).map((event, index) => (
            <View key={`${event.at}-${index}`} style={styles.trackingEvent}>
              <View style={styles.trackingDot} />
              <View style={styles.trackingBody}>
                <Text style={styles.trackingStatus}>{event.status}</Text>
                {event.description ? (
                  <Text style={styles.trackingDesc}>{event.description}</Text>
                ) : null}
                <Text style={styles.trackingTime}>
                  {new Date(event.at).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* Items */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>ITEMS</Text>
        <View style={{ gap: spacing.md }}>
          {data.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <ProductImage url={item.thumbnailUrl} name={item.productName} style={styles.itemImage} borderRadius={8} />
              <View style={styles.itemBody}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {item.productName}
                </Text>
                <Text style={styles.itemVariant}>
                  {[item.size, item.color].filter(Boolean).join(' · ') || item.sku} · Qty {item.qty}
                </Text>
                <PriceText priceInPaise={item.lineTotalInPaise} size="sm" />
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Totals */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>PAYMENT SUMMARY</Text>
        <View style={{ gap: spacing.sm }}>
          <SummaryRow label="Subtotal" value={formatPaise(data.subtotalInPaise)} />
          {data.discountInPaise > 0 ? (
            <SummaryRow
              label={`Discount${data.couponCode ? ` (${data.couponCode})` : ''}`}
              value={`−${formatPaise(data.discountInPaise)}`}
              tone="success"
            />
          ) : null}
          <SummaryRow
            label="Delivery"
            value={data.shippingInPaise === 0 ? 'FREE' : formatPaise(data.shippingInPaise)}
            tone={data.shippingInPaise === 0 ? 'success' : undefined}
          />
          <View style={styles.divider} />
          <SummaryRow label="Total" value={formatPaise(data.totalInPaise)} bold />
        </View>
      </View>

      {/* Address */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>DELIVERY ADDRESS</Text>
        <Text style={styles.addressName}>{data.shippingAddress.fullName}</Text>
        <Text style={styles.addressLine}>
          {data.shippingAddress.line1}
          {data.shippingAddress.line2 ? `, ${data.shippingAddress.line2}` : ''}
        </Text>
        <Text style={styles.addressLine}>
          {data.shippingAddress.city}, {data.shippingAddress.state} — {data.shippingAddress.pincode}
        </Text>
        <Text style={styles.addressPhone}>{data.shippingAddress.phone}</Text>
      </View>

      {/* Actions */}
      {canCancel ? (
        <Button title="Cancel order" variant="secondary" onPress={() => setCancelOpen(true)} />
      ) : null}
      {canReturn ? (
        <Button
          title="Request return"
          variant="secondary"
          onPress={() => navigation.navigate('ReturnRequest', { orderId })}
        />
      ) : null}

      {/* Cancel modal */}
      <Modal visible={cancelOpen} transparent animationType="fade" onRequestClose={() => setCancelOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCancelOpen(false)} accessibilityLabel="Close cancel dialog">
          <View />
        </Pressable>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Cancel this order?</Text>
          <Text style={styles.sheetSub}>
            {'We\'ll refund automatically if you\'ve already paid. Tell us why you\'re cancelling:'}
          </Text>
          <TextInput
            value={cancelReason}
            onChangeText={(t) => {
              setCancelReason(t);
              setCancelError(null);
            }}
            placeholder="e.g. Ordered by mistake, found a better size…"
            placeholderTextColor={colors.ink300}
            multiline
            style={styles.reasonInput}
            accessibilityLabel="Cancellation reason"
          />
          {cancelError ? (
            <Text style={styles.sheetError} accessibilityLiveRegion="polite">
              {cancelError}
            </Text>
          ) : null}
          <Button title="Cancel order" variant="danger" onPress={submitCancel} loading={cancelOrder.isPending} />
          <Button title="Keep my order" variant="ghost" onPress={() => setCancelOpen(false)} />
        </View>
      </Modal>
    </ScrollView>
  );
}

function SummaryRow({
  label,
  value,
  bold = false,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: 'success';
}) {
  return (
    <View style={summaryStyles.row}>
      <Text style={[summaryStyles.label, bold && summaryStyles.bold]}>{label}</Text>
      <Text style={[summaryStyles.value, bold && summaryStyles.bold, tone === 'success' && { color: colors.success }]}>
        {value}
      </Text>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.ink700,
  },
  value: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.ink900,
    fontVariant: ['tabular-nums'],
  },
  bold: {
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
});

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream50 },
  container: {
    padding: spacing.lg,
    paddingBottom: 48,
    gap: spacing.md,
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
    ...hairline,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  orderNumber: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.ink900,
    letterSpacing: 0.5,
  },
  date: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.ink500,
    marginTop: 2,
  },
  sectionLabel: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.gold500,
    marginBottom: spacing.md,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  timelineRail: {
    alignItems: 'center',
    width: 18,
  },
  timelineDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.ink300,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotDone: {
    backgroundColor: colors.brand600,
    borderColor: colors.brand600,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 18,
    backgroundColor: 'rgba(185, 178, 169, 0.4)',
  },
  timelineLineDone: {
    backgroundColor: colors.brand600,
  },
  timelineLabel: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.ink500,
    paddingBottom: spacing.lg,
  },
  timelineLabelDone: {
    fontFamily: fonts.medium,
    color: colors.ink900,
  },
  terminalNote: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink700,
  },
  awbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brand50,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: spacing.md,
  },
  awbText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.ink900,
  },
  trackingEvent: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  trackingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold500,
    marginTop: 5,
  },
  trackingBody: {
    flex: 1,
  },
  trackingStatus: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.ink900,
  },
  trackingDesc: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.ink700,
    marginTop: 1,
  },
  trackingTime: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.ink500,
    marginTop: 2,
  },
  itemRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  itemImage: {
    width: 56,
    height: 74,
  },
  itemBody: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.ink900,
  },
  itemVariant: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.ink500,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(185, 178, 169, 0.4)',
    marginVertical: 4,
  },
  addressName: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.ink900,
    marginBottom: 2,
  },
  addressLine: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink700,
  },
  addressPhone: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.ink500,
    marginTop: 4,
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
    gap: spacing.md,
  },
  sheetTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink900,
  },
  sheetSub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink500,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: colors.ink300,
    borderRadius: radius.input,
    backgroundColor: colors.white,
    padding: spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.ink900,
  },
  sheetError: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.error,
  },
});
