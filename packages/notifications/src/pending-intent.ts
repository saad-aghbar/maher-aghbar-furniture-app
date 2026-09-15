import type { AppSurface } from '@maher/permissions';
import { resolveNotificationOpen } from './href';
import { SURFACE_HUB_HREF } from './live-routes';
import type {
  AuthBootstrapStatus,
  PendingNotificationIntent,
} from './types';

export type NotificationOpenDecision =
  | { action: 'wait' }
  | { action: 'drop'; reason: 'wrong_user' | 'unauthenticated' | 'no_destination' }
  | { action: 'navigate'; href: string; usedFallback: boolean };

/**
 * Cold-start / lock-screen tap. Never navigate until auth, identity,
 * permissions, and AppSurface are known. Never route dealer/worker into admin.
 */
export function decideNotificationOpen(input: {
  status: AuthBootstrapStatus;
  user: { id: string } | null;
  surface: AppSurface | null;
  intent: PendingNotificationIntent | null;
}): NotificationOpenDecision {
  if (!input.intent) return { action: 'drop', reason: 'no_destination' };
  if (
    input.status === 'bootstrapping' ||
    input.status === 'authenticating' ||
    input.status === 'needs_biometric'
  ) {
    return { action: 'wait' };
  }
  if (input.status !== 'authenticated' || !input.user || !input.surface) {
    return { action: 'drop', reason: 'unauthenticated' };
  }
  if (input.intent.userId && input.intent.userId !== input.user.id) {
    return { action: 'drop', reason: 'wrong_user' };
  }
  const opened = resolveNotificationOpen({
    surface: input.surface,
    linkUrl: input.intent.linkUrl,
    topic: input.intent.topic,
    entityType: input.intent.entityType,
    entityId: input.intent.entityId,
  });
  const href = opened?.href ?? SURFACE_HUB_HREF[input.surface];
  if (input.surface !== 'admin' && href.includes('(admin)')) {
    return { action: 'navigate', href: SURFACE_HUB_HREF[input.surface], usedFallback: true };
  }
  return { action: 'navigate', href, usedFallback: opened?.usedFallback ?? true };
}
