import type { PaginatedResponse } from '@maher/types';
import { apiGet, apiPost, apiPut } from '../client';
import { toSearchParams, type PageParams } from '../pagination';

export type AppNotification = {
  id: string;
  type: string;
  topic?: string | null;
  titleAr?: string | null;
  titleEn?: string | null;
  titleHe?: string | null;
  bodyAr?: string | null;
  bodyEn?: string | null;
  bodyHe?: string | null;
  linkUrl?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  readAt?: string | null;
  createdAt: string;
};

export type NotificationTopicRow = {
  code: string;
  group: string;
  name: string;
  hint: string;
  urgency: 'normal' | 'high' | 'critical';
  defaultOn: boolean;
  enabled: boolean;
};

export type NotificationTopicsResponse = {
  masterEnabled: boolean;
  device: {
    token: string;
    pushEnabled: boolean;
    osPermission: string | null;
    platform: string;
  } | null;
  groups: Array<{ id: string; name: string }>;
  topics: NotificationTopicRow[];
};

export type NotificationListFilters = PageParams;

export async function listNotifications(filters: NotificationListFilters = {}) {
  const qs = toSearchParams({ pageSize: 100, ...filters });
  return apiGet<AppNotification[] | PaginatedResponse<AppNotification>>(`/notifications${qs}`);
}

export async function getNotificationTopics(token?: string | null) {
  const qs = token ? `?token=${encodeURIComponent(token)}` : '';
  return apiGet<NotificationTopicsResponse>(`/notifications/topics${qs}`);
}

export async function putNotificationPreferences(body: {
  masterEnabled?: boolean;
  topics?: Record<string, boolean>;
  device?: { token: string; pushEnabled: boolean };
}) {
  return apiPut<{ ok: boolean }>('/notifications/preferences', body);
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
  osPermission?: 'granted' | 'denied' | 'undetermined';
  pushEnabled?: boolean;
  deviceId?: string;
}) {
  return apiPost<{ ok: boolean; id: string }>('/notifications/device-token', body);
}

export async function releaseDeviceToken(token: string) {
  return apiPost<{ ok: boolean; released: boolean }>('/notifications/device-token/release', {
    token,
  });
}
