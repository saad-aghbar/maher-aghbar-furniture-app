import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { can } from '@maher/permissions';
import type { AuthUser } from '@maher/types';
import { registerDeviceToken } from '@/api/modules/notifications';

function resolvePlatform(): 'ios' | 'android' | 'web' {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

/** Expo Go (SDK 53+) has no remote push — skip native notifications module entirely. */
function isExpoGo(): boolean {
  return (
    Constants.appOwnership === 'expo' ||
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  );
}

/**
 * Register Expo push token with the API after login.
 * Push *delivery* is not implemented server-side — registration only.
 * No-ops in Expo Go (avoids SDK 53+ expo-notifications warnings).
 */
export async function registerPushDevice(user: AuthUser | null | undefined): Promise<boolean> {
  if (!user || !can(user, 'notification.read')) return false;
  if (isExpoGo()) return false;

  try {
    // Dynamic import so Expo Go never loads expo-notifications (and its WARN spam).
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

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const permissions = await Notifications.getPermissionsAsync();
    let status = permissions.status;
    if (status !== 'granted') {
      const asked = await Notifications.requestPermissionsAsync();
      status = asked.status;
    }
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

    await registerDeviceToken({ token, platform: resolvePlatform() });
    return true;
  } catch {
    // Missing projectId / simulator / permission denial — never block login.
    return false;
  }
}
