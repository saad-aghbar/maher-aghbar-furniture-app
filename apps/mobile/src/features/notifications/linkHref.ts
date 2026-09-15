import type { Href } from 'expo-router';
import type { AppSurface } from '@maher/permissions';
import { resolveNotificationOpen, SURFACE_HUB_HREF } from '@maher/notifications';

export type NotificationHrefExtras = {
  entityType?: string | null;
  entityId?: string | null;
};

/**
 * Map API `linkUrl` paths to in-app Expo routes.
 * Dealers and workers never enter `(admin)`. Missing detail uses an authorized hub.
 */
export function mapNotificationLinkToHref(
  linkUrl: string | null,
  surface: AppSurface = 'admin',
  topic?: string | null,
  extras?: NotificationHrefExtras,
): Href {
  const opened = resolveNotificationOpen({
    linkUrl,
    surface,
    topic,
    entityType: extras?.entityType,
    entityId: extras?.entityId,
  });
  return (opened?.href ?? SURFACE_HUB_HREF[surface]) as Href;
}
