import * as SecureStore from 'expo-secure-store';
import type { AuthUser } from '@maher/types';
import { getApiBaseUrl } from '@/api/config';
import { getWatchBridge, type WatchBridge } from '@/watch/bridge';
import {
  buildUnavailableContext,
  buildWatchUserContext,
  type WatchApplicationContext,
} from '@/watch/context';

export const WATCH_EPOCH_KEY = 'maher.watch_session_epoch';
export const WATCH_LAST_USER_KEY = 'maher.watch_last_user_id';

export type WatchSyncStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const defaultStore: WatchSyncStore = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

export type WatchSyncDeps = {
  store?: WatchSyncStore;
  bridge?: WatchBridge;
  apiBaseUrl?: string;
};

function resolveDeps(deps: WatchSyncDeps = {}): {
  store: WatchSyncStore;
  bridge: WatchBridge;
  apiBaseUrl: string;
} {
  return {
    store: deps.store ?? defaultStore,
    bridge: deps.bridge ?? getWatchBridge(),
    apiBaseUrl: deps.apiBaseUrl ?? safeApiBaseUrl(),
  };
}

function safeApiBaseUrl(): string {
  try {
    return getApiBaseUrl();
  } catch {
    return '';
  }
}

export async function readWatchEpoch(store: WatchSyncStore = defaultStore): Promise<number> {
  const raw = await store.getItem(WATCH_EPOCH_KEY);
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export async function bumpWatchEpoch(store: WatchSyncStore = defaultStore): Promise<number> {
  const next = (await readWatchEpoch(store)) + 1;
  await store.setItem(WATCH_EPOCH_KEY, String(next));
  return next;
}

export async function readLastWatchUserId(
  store: WatchSyncStore = defaultStore,
): Promise<string | null> {
  return store.getItem(WATCH_LAST_USER_KEY);
}

export async function syncWatchSession(
  user: AuthUser,
  accessToken: string | null,
  deps: WatchSyncDeps = {},
): Promise<WatchApplicationContext> {
  const { store, bridge, apiBaseUrl } = resolveDeps(deps);
  const lastUserId = await readLastWatchUserId(store);
  let epoch = await readWatchEpoch(store);
  if (lastUserId !== user.id) {
    epoch = await bumpWatchEpoch(store);
    await store.setItem(WATCH_LAST_USER_KEY, user.id);
  }
  if (epoch < 1) {
    epoch = await bumpWatchEpoch(store);
  }

  const context = buildWatchUserContext({ user, sessionEpoch: epoch, apiBaseUrl });
  if (!context) {
    return clearWatchSession(deps);
  }

  await bridge.publishContext(context);
  if (accessToken) {
    await bridge.publishToken(accessToken, epoch);
  }
  return context;
}

export async function clearWatchSession(
  deps: WatchSyncDeps = {},
): Promise<WatchApplicationContext> {
  const { store, bridge } = resolveDeps(deps);
  const epoch = await bumpWatchEpoch(store);
  await store.removeItem(WATCH_LAST_USER_KEY);
  const context = buildUnavailableContext(epoch);
  await bridge.clear();
  await bridge.publishContext(context);
  return context;
}

export async function mirrorWatchAccessToken(
  accessToken: string,
  deps: WatchSyncDeps = {},
): Promise<void> {
  const { store, bridge } = resolveDeps(deps);
  const epoch = await readWatchEpoch(store);
  if (epoch < 1) return;
  await bridge.publishToken(accessToken, epoch);
}

export async function invalidateWatchAccessToken(deps: WatchSyncDeps = {}): Promise<void> {
  const { bridge } = resolveDeps(deps);
  await bridge.clear();
}
