import type { AppNotification } from './api';

export type NotificationCardModel = {
  id: string;
  type: string;
  title: string;
  body: string;
  unread: boolean;
  createdAt: string;
  linkUrl: string | null;
};

export type NotificationDaySection = {
  key: string;
  label: string;
  data: NotificationCardModel[];
};

/** Ionicons glyph keys used by notification boards. */
export type NotificationIconName =
  | 'notifications-outline'
  | 'cube-outline'
  | 'receipt-outline'
  | 'construct-outline'
  | 'return-down-back-outline'
  | 'sparkles-outline'
  | 'clipboard-outline'
  | 'document-text-outline'
  | 'wallet-outline';

export function selectNotificationCard(
  row: AppNotification,
  locale: string,
): NotificationCardModel {
  const ar = locale === 'ar' || locale === 'he';
  return {
    id: row.id,
    type: row.type,
    title: ar ? row.titleAr || row.titleEn || row.type : row.titleEn || row.titleAr || row.type,
    body: ar ? row.bodyAr || row.bodyEn || '' : row.bodyEn || row.bodyAr || '',
    unread: !row.readAt,
    createdAt: row.createdAt,
    linkUrl: row.linkUrl ?? null,
  };
}

/** Normalize API list (array or paginated) into a flat list. */
export function normalizeNotificationList(
  payload: AppNotification[] | { data?: AppNotification[] } | undefined,
): AppNotification[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload.data ?? [];
}

export function unreadCount(rows: AppNotification[]): number {
  return rows.filter((r) => !r.readAt).length;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Group cards by calendar day (newest first). */
export function groupNotificationsByDay(
  items: NotificationCardModel[],
  formatDayLabel: (isoDate: string) => string,
): NotificationDaySection[] {
  const map = new Map<string, NotificationCardModel[]>();
  for (const item of items) {
    const key = dayKey(item.createdAt) || 'unknown';
    const bucket = map.get(key) ?? [];
    bucket.push(item);
    map.set(key, bucket);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([key, data]) => ({
      key,
      label: key === 'unknown' ? key : formatDayLabel(key),
      data,
    }));
}

/**
 * Pick a board icon from notification type and/or deep-link path.
 */
export function notificationIconFor(
  type: string,
  linkUrl?: string | null,
): NotificationIconName {
  const hay = `${type} ${linkUrl ?? ''}`.toLowerCase();

  if (/invoice|payment|statement|wallet|receivable/.test(hay)) return 'receipt-outline';
  if (/return/.test(hay)) return 'return-down-back-outline';
  if (/ai[-_]?intake|spark|ocr|intake/.test(hay)) return 'sparkles-outline';
  if (/task|assign|worker|production/.test(hay)) return 'construct-outline';
  if (/request|rfq|quotation|quote/.test(hay)) return 'document-text-outline';
  if (/order|sales[-_]?order|so[-_]/.test(hay)) return 'cube-outline';
  if (/clipboard|note/.test(hay)) return 'clipboard-outline';
  if (/pay|money|balance/.test(hay)) return 'wallet-outline';
  return 'notifications-outline';
}
