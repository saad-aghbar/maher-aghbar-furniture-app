import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSafeAsyncStorage } from '@/api/safeAsyncStorage';
import {
  favoritesStorageKey,
  isFavorite,
  parseFavoriteIds,
  serializeFavoriteIds,
  toggleFavoriteId,
} from './favoritesStore';

const storage = createSafeAsyncStorage(AsyncStorage);

/**
 * Device-local favorites for the signed-in dealer user.
 * Persists under `dealer.catalog.favorites.v1:{userId}`.
 */
export function useDealerFavorites(userId: string | undefined) {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setIds([]);

    if (!userId) {
      setReady(true);
      return;
    }

    void (async () => {
      const raw = await storage.getItem(favoritesStorageKey(userId));
      if (cancelled) return;
      setIds(parseFavoriteIds(raw));
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const persist = useCallback(
    async (next: string[]) => {
      if (!userId) return;
      setIds(next);
      await storage.setItem(favoritesStorageKey(userId), serializeFavoriteIds(next));
    },
    [userId],
  );

  const toggle = useCallback(
    (productId: string) => {
      if (!userId || !productId) return;
      const next = toggleFavoriteId(ids, productId);
      void persist(next);
    },
    [userId, ids, persist],
  );

  const has = useCallback((productId: string) => isFavorite(ids, productId), [ids]);

  return {
    favoriteIds: ids,
    favoriteSet: new Set(ids),
    ready,
    isFavorite: has,
    toggleFavorite: toggle,
  };
}
