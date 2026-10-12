import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { palette, updateMyProfile, type CampusClient } from '@campuscycle/shared';

export type PushRoute =
  '/(main)' | '/riding' | '/(main)/history' | '/(main)/profile' | '/notifications' | `/ride/${string}`;

/**
 * Where a tapped push or inbox row goes (04 §1.8). `null` means the gate decides after a refresh.
 */
export function routeForPush(data: Record<string, unknown> | null | undefined): PushRoute | null {
  switch (data?.screen) {
    case 'home':
      return '/(main)';
    case 'riding':
      return '/riding';
    case 'rides':
      return typeof data.ride_id === 'string' && data.ride_id ? `/ride/${data.ride_id}` : '/(main)/history';
    case 'profile':
      return '/(main)/profile';
    case 'blocked':
      return null;
    default:
      return '/notifications';
  }
}

/** Banner and sound while the app is open, no badge. */
export async function configureForegroundPush(): Promise<void> {
  if (Platform.OS === 'web') return;
  const Notifications = await import('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Saves this device's Expo push token on the profile when notifications are allowed (03 §4.11). */
export async function registerPush(db: CampusClient, currentToken?: string | null): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const Notifications = await import('expo-notifications');
    const { granted } = await Notifications.getPermissionsAsync();
    if (!granted) return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.HIGH,
        enableVibrate: true,
        lightColor: palette.dark.primary,
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (token && token !== currentToken) await updateMyProfile(db, { push_token: token });
  } catch (e) {
    // Without google-services.json (added in Phase 5) there is no token; the inbox still works.
    console.warn('[push] registration skipped', e);
  }
}

export type PermissionState = 'granted' | 'denied' | 'ask';

export function toPermissionState(p: { granted: boolean; canAskAgain: boolean }): PermissionState {
  return p.granted ? 'granted' : p.canAskAgain ? 'ask' : 'denied';
}

export async function getPushPermission(): Promise<PermissionState> {
  if (Platform.OS === 'web') return 'denied';
  const Notifications = await import('expo-notifications');
  return toPermissionState(await Notifications.getPermissionsAsync());
}

export async function requestPushPermission(): Promise<PermissionState> {
  if (Platform.OS === 'web') return 'denied';
  const Notifications = await import('expo-notifications');
  return toPermissionState(await Notifications.requestPermissionsAsync());
}
