import { Platform } from 'react-native';

export type WatchBridge = {
  publishContext(payload: Record<string, unknown>): Promise<void>;
  publishToken(accessToken: string, sessionEpoch: number): Promise<void>;
  clear(): Promise<void>;
};

export const noopWatchBridge: WatchBridge = {
  async publishContext() {},
  async publishToken() {},
  async clear() {},
};

export function resolveWatchBridge(
  os: string,
  loadNative: () => WatchBridge | null,
): WatchBridge {
  if (os !== 'ios') return noopWatchBridge;
  return loadNative() ?? noopWatchBridge;
}

export function getWatchBridge(): WatchBridge {
  return resolveWatchBridge(Platform.OS, loadNativeWatchBridge);
}

function loadNativeWatchBridge(): WatchBridge | null {
  try {
    // Local Expo module — absent on Android/web and in most Jest runs.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const native = require('maher-watch-bridge') as { default?: WatchBridge | null } | WatchBridge | null;
    if (!native) return null;
    if ('publishContext' in native) return native;
    return native.default ?? null;
  } catch {
    return null;
  }
}
