import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { userApi } from '../api/endpoints';

// Show alerts for notifications that arrive while the app is foregrounded;
// the in-app banner (NotificationBannerProvider) renders our own UI on top.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Ask permission, fetch the Expo push token and register it with the API.
 * Best-effort: emulators and Expo Go (SDK 53+) can't get remote-push tokens,
 * so every failure is swallowed — push is never allowed to break login.
 */
export async function registerPushToken(): Promise<void> {
  try {
    if (!Device.isDevice) return;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Chikbo',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: '#EA7A12',
      });
    }

    const projectId: string | undefined =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );

    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    await userApi.registerDeviceToken(tokenResult.data, platform);
  } catch {
    // Push registration is optional — never surface this to the user.
  }
}
