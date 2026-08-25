import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { cardShadow, colors, fonts, radius, spacing } from '../theme';

interface BannerContent {
  title: string;
  body: string;
}

/**
 * Listens for push notifications received while the app is in the foreground
 * and shows a dismissible in-app banner (ink-900 toast, per design system).
 */
export function ForegroundNotificationBanner() {
  const [content, setContent] = useState<BannerContent | null>(null);
  const translateY = useRef(new Animated.Value(-120)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const hide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    Animated.timing(translateY, { toValue: -160, duration: 200, useNativeDriver: true }).start(() =>
      setContent(null),
    );
  }, [translateY]);

  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body } = notification.request.content;
      setContent({ title: title ?? 'Chikbo', body: body ?? '' });
      translateY.setValue(-120);
      Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }).start();
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(hide, 5000);
    });
    return () => {
      sub.remove();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [hide, translateY]);

  if (!content) return null;

  return (
    <Animated.View
      style={[styles.wrap, { top: insets.top + 8, transform: [{ translateY }] }]}
      pointerEvents="box-none"
    >
      <Pressable
        accessibilityRole="alert"
        accessibilityLabel={`Notification: ${content.title}. ${content.body}`}
        onPress={hide}
        style={styles.banner}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="notifications" size={16} color={colors.brand500} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {content.title}
          </Text>
          {content.body ? (
            <Text style={styles.body} numberOfLines={2}>
              {content.body}
            </Text>
          ) : null}
        </View>
        <Ionicons name="close" size={16} color={colors.ink300} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: spacing.lg,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.ink900,
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...cardShadow,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.cream50,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.ink300,
    marginTop: 1,
  },
});
