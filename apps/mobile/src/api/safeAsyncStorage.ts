type AsyncStorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

/**
 * Storage adapter that never throws to the Query persist layer.
 * Native-module failures (Expo Go mismatch, null legacy storage) degrade to empty cache.
 */
export function createSafeAsyncStorage(storage: AsyncStorageLike) {
  const warn = (op: string, error: unknown) => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn(`[query-persist] ${op} failed; continuing without cache`, error);
    }
  };

  return {
    getItem: async (key: string): Promise<string | null> => {
      try {
        return await storage.getItem(key);
      } catch (error) {
        warn('getItem', error);
        return null;
      }
    },
    setItem: async (key: string, value: string): Promise<void> => {
      try {
        await storage.setItem(key, value);
      } catch (error) {
        warn('setItem', error);
      }
    },
    removeItem: async (key: string): Promise<void> => {
      try {
        await storage.removeItem(key);
      } catch (error) {
        warn('removeItem', error);
      }
    },
  };
}
