import { resolveAppSurface, type AppSurface } from '@maher/permissions';
import type { AuthUser } from '@maher/types';

export const WATCH_CAPABILITY_ALLOWLIST = [
  'production-task.read',
  'production-task.update-own',
  'production-task.complete',
  'quality-inspection.perform',
  'report.sales.read',
  'notification.read',
  'sales-order.read',
  'delivery.confirm-own-receipt',
] as const;

export type WatchCapability = (typeof WATCH_CAPABILITY_ALLOWLIST)[number];
export type WatchSurface = 'worker' | 'admin' | 'dealer';
export type WatchSessionState = 'unprovisioned' | 'active' | 'unavailable';

export type WatchUserContext = {
  state: 'active';
  sessionEpoch: number;
  userId: string;
  displayName: string;
  surface: WatchSurface;
  roles: string[];
  capabilities: string[];
  locale: string;
  apiBaseUrl: string;
};

export type WatchUnavailableContext = {
  state: 'unavailable';
  sessionEpoch: number;
};

export type WatchApplicationContext = WatchUserContext | WatchUnavailableContext;

export function surfaceFromAppSurface(app: AppSurface): WatchSurface {
  if (app === 'employee') return 'worker';
  if (app === 'customer') return 'dealer';
  return 'admin';
}

export function watchSurfaceLabel(surface: WatchSurface): 'Worker' | 'Admin' | 'Dealer' {
  if (surface === 'worker') return 'Worker';
  if (surface === 'dealer') return 'Dealer';
  return 'Admin';
}

export function filterWatchCapabilities(permissions: readonly string[]): string[] {
  const allow = new Set<string>(WATCH_CAPABILITY_ALLOWLIST);
  return permissions.filter((code) => allow.has(code));
}

export function buildWatchUserContext(input: {
  user: AuthUser | null | undefined;
  sessionEpoch: number;
  apiBaseUrl: string;
}): WatchUserContext | null {
  const user = input.user;
  if (!user?.id) return null;
  const displayName = (user.name || user.username || '').trim();
  if (!displayName) return null;

  return {
    state: 'active',
    sessionEpoch: input.sessionEpoch,
    userId: user.id,
    displayName,
    surface: surfaceFromAppSurface(resolveAppSurface(user)),
    roles: [...user.roles],
    capabilities: filterWatchCapabilities(user.permissions ?? []),
    locale: user.preferredLanguage || 'en',
    apiBaseUrl: input.apiBaseUrl,
  };
}

export function buildUnavailableContext(sessionEpoch: number): WatchUnavailableContext {
  return { state: 'unavailable', sessionEpoch };
}
