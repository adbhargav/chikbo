import React, { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { toApiError } from '../../api/client';
import { uploadsApi } from '../../api/endpoints';
import { useOrder, useRequestReturn } from '../../hooks/queries';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { ProductImage } from '../../components/ProductImage';
import { Skeleton } from '../../components/Skeleton';
import { colors, fonts, hairline, radius, spacing } from '../../theme';
import type { AppScreenProps } from '../../navigation/types';

const MIN_REASON_LENGTH = 10;
const MAX_PHOTOS = 6;

interface PickedPhoto {
  uri: string;
  name: string;
  type: string;
}

export function ReturnRequestScreen({ route, navigation }: AppScreenProps<'ReturnRequest'>) {
  const { orderId } = route.params;
  const order = useOrder(orderId);
  const requestReturn = useRequestReturn(orderId);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (order.isLoading) {
    return (
      <View style={styles.skeletonWrap}>
        <Skeleton height={90} borderRadius={radius.card} />
        <Skeleton height={120} borderRadius={radius.card} />
      </View>
    );
  }

  if (order.isError || !order.data) {
    return <ErrorState error={order.error} onRetry={() => void order.refetch()} />;
  }

  if (order.data.status !== 'DELIVERED') {
    return (
      <EmptyState
        icon="cube-outline"
        title="Returns open after delivery"
        message="You can request a return for genuinely damaged items once the order is delivered."
        ctaTitle="Back to order"
        onCtaPress={() => navigation.goBack()}
      />
    );
  }

  const pickPhotos = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo access is needed to attach damage photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
      quality: 0.7,
    });
    if (result.canceled) return;
    const picked: PickedPhoto[] = result.assets.map((asset, index) => ({
      uri: asset.uri,
      name: asset.fileName ?? `damage-${Date.now()}-${index}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
    }));
    setPhotos((prev) => [...prev, ...picked].slice(0, MAX_PHOTOS));
  };

  const removePhoto = (uri: string) => setPhotos((prev) => prev.filter((p) => p.uri !== uri));

  const submit = async () => {
    setError(null);
    if (!selectedItemId) {
      setError('Choose the item you want to return.');
      return;
    }
    if (reason.trim().length < MIN_REASON_LENGTH) {
      setError(`Please describe the damage in at least ${MIN_REASON_LENGTH} characters.`);
      return;
    }
    if (photos.length === 0) {
      setError('Attach at least one photo of the damage.');
      return;
    }
    setSubmitting(true);
    try {
      const uploaded = await uploadsApi.upload(photos);
      await requestReturn.mutateAsync({
        orderItemId: selectedItemId,
        reason: reason.trim(),
        imageUrls: uploaded.map((f) => f.url),
      });
      navigation.goBack();
    } catch (e) {
      setError(toApiError(e).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.intro}>
        Returns are accepted for genuine damage. Pick the item, describe the issue and attach clear
        photos — we'll review it quickly.
      </Text>

      {/* Item selection */}
      <Text style={styles.sectionLabel}>WHICH ITEM?</Text>
      <View style={{ gap: spacing.sm }}>
        {order.data.items.map((item) => {
          const selected = item.id === selectedItemId;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`Return ${item.productName}`}
              onPress={() => setSelectedItemId(item.id)}
              style={[styles.itemCard, selected && styles.itemCardSelected]}
            >
              <ProductImage url={item.thumbnailUrl} name={item.productName} style={styles.itemImage} borderRadius={8} />
              <View style={styles.itemBody}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {item.productName}
                </Text>
                <Text style={styles.itemVariant}>
                  {[item.size, item.color].filter(Boolean).join(' · ') || item.sku} · Qty {item.qty}
                </Text>
              </View>
              <Ionicons
                name={selected ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={selected ? colors.brand600 : colors.ink300}
              />
            </Pressable>
          );
        })}
      </View>

      {/* Reason */}
      <Text style={styles.sectionLabel}>WHAT WENT WRONG?</Text>
      <TextInput
        value={reason}
        onChangeText={setReason}
        placeholder="Describe the damage (at least 10 characters)…"
        placeholderTextColor={colors.ink300}
        multiline
        style={styles.reasonInput}
        accessibilityLabel="Return reason"
      />
      <Text style={styles.charCount}>
        {reason.trim().length}/{MIN_REASON_LENGTH} characters minimum
      </Text>

      {/* Photos */}
      <Text style={styles.sectionLabel}>DAMAGE PHOTOS</Text>
      <View style={styles.photoRow}>
        {photos.map((photo) => (
          <View key={photo.uri} style={styles.photoWrap}>
            <Image source={{ uri: photo.uri }} style={styles.photo} accessibilityLabel="Damage photo" />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove photo"
              onPress={() => removePhoto(photo.uri)}
              style={styles.photoRemove}
              hitSlop={6}
            >
              <Ionicons name="close" size={12} color={colors.white} />
            </Pressable>
          </View>
        ))}
        {photos.length < MAX_PHOTOS ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add damage photo"
            onPress={() => void pickPhotos()}
            style={({ pressed }) => [styles.addPhoto, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="camera-outline" size={22} color={colors.ink500} />
            <Text style={styles.addPhotoText}>Add photo</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.photoHint}>At least 1 photo required · up to {MAX_PHOTOS}, 5MB each</Text>

      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <Button title="Submit return request" onPress={() => void submit()} loading={submitting} style={{ marginTop: spacing.lg }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream50 },
  container: {
    padding: spacing.lg,
    paddingBottom: 48,
  },
  skeletonWrap: {
    flex: 1,
    backgroundColor: colors.cream50,
    padding: spacing.lg,
    gap: spacing.md,
  },
  intro: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink500,
  },
  sectionLabel: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.gold500,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: spacing.md,
    ...hairline,
  },
  itemCardSelected: {
    borderColor: colors.brand600,
    borderWidth: 1.5,
    backgroundColor: colors.brand50,
  },
  itemImage: {
    width: 48,
    height: 64,
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
  reasonInput: {
    borderWidth: 1,
    borderColor: colors.ink300,
    borderRadius: radius.input,
    backgroundColor: colors.white,
    padding: spacing.md,
    minHeight: 96,
    textAlignVertical: 'top',
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.ink900,
  },
  charCount: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.ink500,
    marginTop: 4,
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  photoWrap: {
    position: 'relative',
  },
  photo: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: colors.cream100,
  },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.ink900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhoto: {
    width: 72,
    height: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.ink300,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: colors.white,
  },
  addPhotoText: {
    fontFamily: fonts.regular,
    fontSize: 9,
    color: colors.ink500,
  },
  photoHint: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.ink500,
    marginTop: spacing.sm,
  },
  error: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.error,
    marginTop: spacing.lg,
  },
});
