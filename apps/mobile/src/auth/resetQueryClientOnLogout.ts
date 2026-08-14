import type { QueryClient } from '@tanstack/react-query';
import { QUERY_PERSIST_KEY } from '@/api/queryPersist';

/** Drop in-memory and persisted React Query caches so the next login cannot inherit modules. */
export async function resetQueryClientOnLogout(queryClient: QueryClient): Promise<void> {
  queryClient.clear();
  try {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    await AsyncStorage.removeItem(QUERY_PERSIST_KEY);
  } catch {
    /* ignore storage failures — memory cache is already empty */
  }
}
