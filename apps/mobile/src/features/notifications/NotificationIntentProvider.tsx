import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { decideNotificationOpen, type PendingNotificationIntent } from '@maher/notifications';
import { resolveAppSurface } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { isExpoGo, registerPushDevice } from '@/features/notifications/registerPushDevice';
import { navigateSurfaceHref } from '@/navigation/navigateSurfaceHref';
import {
  clearPendingNotificationIntent,
  getPendingNotificationIntentJson,
  setPendingNotificationIntentJson,
} from '@/storage/pushDevice';

function intentFromData(data: Record<string, unknown> | undefined): PendingNotificationIntent | null {
  if (!data) return null;
  const linkUrl = typeof data.linkUrl === 'string' ? data.linkUrl : null;
  const topic = typeof data.topic === 'string' ? data.topic : null;
  if (!linkUrl && !topic && typeof data.notificationId !== 'string') return null;
  return {
    notificationId: typeof data.notificationId === 'string' ? data.notificationId : undefined,
    userId: typeof data.userId === 'string' ? data.userId : undefined,
    linkUrl,
    topic,
    entityType: typeof data.entityType === 'string' ? data.entityType : undefined,
    entityId: typeof data.entityId === 'string' ? data.entityId : undefined,
  };
}

async function persistIntent(intent: PendingNotificationIntent) {
  await setPendingNotificationIntentJson(JSON.stringify(intent));
}

export function NotificationIntentProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const consuming = useRef(false);

  const consume = useCallback(
    async (intent: PendingNotificationIntent) => {
      const surface = user ? resolveAppSurface(user) : null;
      const decision = decideNotificationOpen({
        status: status === 'offline' ? 'unauthenticated' : status,
        user: user ? { id: user.id } : null,
        surface,
        intent,
      });
      if (decision.action === 'wait') {
        await persistIntent(intent);
        return;
      }
      await clearPendingNotificationIntent();
      if (decision.action !== 'navigate' || !surface) return;
      navigateSurfaceHref(router, decision.href as Href);
    },
    [router, status, user],
  );

  useEffect(() => {
    if (consuming.current) return;
    if (status !== 'authenticated' || !user) return;
    consuming.current = true;
    void (async () => {
      try {
        const raw = await getPendingNotificationIntentJson();
        if (!raw) return;
        const parsed = JSON.parse(raw) as PendingNotificationIntent;
        await consume(parsed);
      } catch {
        await clearPendingNotificationIntent();
      } finally {
        consuming.current = false;
      }
    })();
  }, [consume, status, user]);

  useEffect(() => {
    if (isExpoGo()) return;
    let sub: { remove: () => void } | undefined;
    let appSub: ReturnType<typeof AppState.addEventListener> | undefined;
    void (async () => {
      try {
        const Notifications = await import('expo-notifications');
        const last = await Notifications.getLastNotificationResponseAsync();
        const fromLast = intentFromData(last?.notification.request.content.data as Record<string, unknown>);
        if (fromLast) await persistIntent(fromLast);

        sub = Notifications.addNotificationResponseReceivedListener((response) => {
          const intent = intentFromData(
            response.notification.request.content.data as Record<string, unknown>,
          );
          if (intent) void consume(intent);
        });
      } catch {
        // Expo Go / missing native module
      }
    })();

    appSub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && user && status === 'authenticated') {
        void registerPushDevice(user);
      }
    });

    return () => {
      sub?.remove();
      appSub?.remove();
    };
  }, [consume, status, user]);

  return children;
}
