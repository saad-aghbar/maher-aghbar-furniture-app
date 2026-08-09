import type { PaginatedResponse } from '@maher/types';
import { apiGet, apiPost } from '../client';
import { toSearchParams, type PageParams } from '../pagination';

export type AppNotification = {
  id: string;
  type: string;
  titleAr?: string | null;
  titleEn?: string | null;
  bodyAr?: string | null;
  bodyEn?: string | null;
  linkUrl?: string | null;
  readAt?: string | null;
  createdAt: string;
};

export type NotificationListFilters = PageParams;

export async function listNotifications(filters: NotificationListFilters = {}) {
  const qs = toSearchParams({ pageSize: 50, ...filters });
  return apiGet<AppNotification[] | PaginatedResponse<AppNotification>>(`/notifications${qs}`);
}

export async function markNotificationRead(id: string) {
  return apiPost<{ ok: boolean }>(`/notifications/${encodeURIComponent(id)}/read`);
}

export async function markAllNotificationsRead() {
  return apiPost<{ ok: boolean }>('/notifications/read-all');
}

export async function registerDeviceToken(body: {
  token: string;
  platform: 'ios' | 'android' | 'web';
}) {
  return apiPost<{ ok: boolean; id: string }>('/notifications/device-token', body);
}
