import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { can } from '@maher/permissions';
import type { AuthUser } from '@maher/types';
import { registerDeviceToken, releaseDeviceToken } from '@/api/modules/notifications';
import {
  clearStoredPushToken,
  getStoredPushToken,
  setStoredPushToken,
} from '@/storage/pushDevice';

function resolvePlatform(): 'ios' | 'android' | 'web' {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

/** Expo Go (SDK 53+) has no remote push — skip native notifications module entirely. */
export function isExpoGo(): boolean {
  return (
    Constants.appOwnership === 'expo' ||
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  );
}

async function ensureAndroidChannels(
  Notifications: typeof import('expo-notifications'),
): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('maher-default', {
    name: 'Maher',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync('maher-high', {
    name: 'Maher important',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync('maher-critical', {
    name: 'Maher urgent',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
  });
}

/**
 * Register Expo push token with the API after login.
 * OS permission and "Deliver to this phone" are stored on this device row.
 */
export async function registerPushDevice(user: AuthUser | null | undefined): Promise<boolean> {
  if (!user || !can(user, 'notification.read')) return false;
  if (isExpoGo()) return false;

  try {
    const Notifications = await import('expo-notifications');

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    await ensureAndroidChannels(Notifications);

    const permissions = await Notifications.getPermissionsAsync();
    let status = permissions.status;
    if (status !== 'granted') {
      const asked = await Notifications.requestPermissionsAsync();
      status = asked.status;
    }
    const osPermission = status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
    if (status !== 'granted') return false;

    const projectId =
      Constants.easConfig?.projectId ??
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
        ?.projectId;

    const tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResult.data?.trim();
    if (!token) return false;

    await registerDeviceToken({
      token,
      platform: resolvePlatform(),
      osPermission,
      pushEnabled: true,
    });
    await setStoredPushToken(token);
    return true;
  } catch {
    return false;
  }
}

/** Unbind this phone from the signed-in user so the next account cannot inherit pushes. */
export async function releasePushDevice(): Promise<void> {
  const token = await getStoredPushToken();
  try {
    if (token && !isExpoGo()) {
      await releaseDeviceToken(token);
    }
  } catch {
    // Offline logout still clears the local token; B's register will steal if needed.
  } finally {
    await clearStoredPushToken();
  }
}
