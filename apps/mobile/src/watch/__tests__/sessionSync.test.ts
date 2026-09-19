import type { AuthUser } from '@maher/types';
import { ROLE_PERMISSIONS } from '@maher/permissions';
import type { WatchBridge } from '../bridge';
import {
  WATCH_EPOCH_KEY,
  WATCH_LAST_USER_KEY,
  bumpWatchEpoch,
  clearWatchSession,
  mirrorWatchAccessToken,
  syncWatchSession,
  type WatchSyncStore,
} from '../sessionSync';

function memoryStore(seed: Record<string, string> = {}): WatchSyncStore {
  const mem = new Map(Object.entries(seed));
  return {
    getItem: async (key) => mem.get(key) ?? null,
    setItem: async (key, value) => {
      mem.set(key, value);
    },
    removeItem: async (key) => {
      mem.delete(key);
    },
  };
}

function mockBridge(): WatchBridge & {
  contexts: Record<string, unknown>[];
  tokens: { accessToken: string; sessionEpoch: number }[];
  clears: number;
} {
  const contexts: Record<string, unknown>[] = [];
  const tokens: { accessToken: string; sessionEpoch: number }[] = [];
  const api = {
    contexts,
    tokens,
    clears: 0,
    async publishContext(payload: Record<string, unknown>) {
      contexts.push(payload);
    },
    async publishToken(accessToken: string, sessionEpoch: number) {
      tokens.push({ accessToken, sessionEpoch });
    },
    async clear() {
      api.clears += 1;
    },
  };
  return api;
}

const worker: AuthUser = {
  id: 'emp-khaled',
  username: 'khaled',
  email: 'khaled@maher.local',
  name: 'Khaled',
  roles: ['PRODUCTION_WORKER'],
  permissions: [...ROLE_PERMISSIONS.PRODUCTION_WORKER],
  preferredLanguage: 'ar',
};

const admin: AuthUser = {
  id: 'emp-saad',
  username: 'saad',
  email: 'saad@maher.local',
  name: 'Saad',
  roles: ['SYSTEM_ADMINISTRATOR'],
  permissions: [...ROLE_PERMISSIONS.SYSTEM_ADMINISTRATOR],
  preferredLanguage: 'en',
};

describe('Watch session sync', () => {
  it('bumps epoch when the iPhone account switches', async () => {
    const store = memoryStore({
      [WATCH_EPOCH_KEY]: '4',
      [WATCH_LAST_USER_KEY]: worker.id,
    });
    const bridge = mockBridge();

    const first = await syncWatchSession(worker, 'tok-khaled', {
      store,
      bridge,
      apiBaseUrl: 'http://api.test',
    });
    expect(first.state).toBe('active');
    expect(first.sessionEpoch).toBe(4);
    expect(bridge.tokens[0]).toEqual({ accessToken: 'tok-khaled', sessionEpoch: 4 });

    const switched = await syncWatchSession(admin, 'tok-saad', {
      store,
      bridge,
      apiBaseUrl: 'http://api.test',
    });
    expect(switched.state).toBe('active');
    if (switched.state !== 'active') throw new Error('expected active');
    expect(switched.userId).toBe(admin.id);
    expect(switched.surface).toBe('admin');
    expect(switched.sessionEpoch).toBe(5);
    expect(bridge.contexts.at(-1)).toMatchObject({ userId: admin.id, sessionEpoch: 5 });
  });

  it('clears last user and publishes unavailable on logout', async () => {
    const store = memoryStore({
      [WATCH_EPOCH_KEY]: '2',
      [WATCH_LAST_USER_KEY]: worker.id,
    });
    const bridge = mockBridge();

    const cleared = await clearWatchSession({ store, bridge });
    expect(cleared).toEqual({ state: 'unavailable', sessionEpoch: 3 });
    expect(await store.getItem(WATCH_LAST_USER_KEY)).toBeNull();
    expect(bridge.clears).toBe(1);
    expect(bridge.contexts.at(-1)).toEqual({ state: 'unavailable', sessionEpoch: 3 });
  });

  it('does not publish a token when no Watch session epoch exists yet', async () => {
    const store = memoryStore();
    const bridge = mockBridge();
    await mirrorWatchAccessToken('fresh', { store, bridge });
    expect(bridge.tokens).toEqual([]);
  });

  it('mirrors a refreshed access token against the current epoch', async () => {
    const store = memoryStore({ [WATCH_EPOCH_KEY]: '7' });
    const bridge = mockBridge();
    await mirrorWatchAccessToken('next-access', { store, bridge });
    expect(bridge.tokens).toEqual([{ accessToken: 'next-access', sessionEpoch: 7 }]);
  });

  it('starts epoch at 1 on first successful publish', async () => {
    const store = memoryStore();
    const bridge = mockBridge();
    const ctx = await syncWatchSession(worker, 'tok', {
      store,
      bridge,
      apiBaseUrl: 'http://api.test',
    });
    expect(ctx.sessionEpoch).toBe(1);
    expect(await bumpWatchEpoch(store)).toBe(2);
  });
});
