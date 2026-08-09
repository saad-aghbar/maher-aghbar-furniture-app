import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import {
  MutationCache,
  QueryCache,
  QueryClient,
} from '@tanstack/react-query';
import { isApiError } from './errors';
import { shouldRetryQuery } from './retry';
import { createSafeAsyncStorage } from './safeAsyncStorage';

export { createSafeAsyncStorage } from './safeAsyncStorage';
export { shouldDehydrateQuery } from './queryPersist';

export const QUERY_PERSIST_KEY = 'maher.rq.cache';

export type QueryClientHooks = {
  onError?: (error: unknown) => void;
};

export function createQueryClient(hooks: QueryClientHooks = {}): QueryClient {
  const notify = (error: unknown) => {
    hooks.onError?.(error);
  };

  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => notify(error),
    }),
    mutationCache: new MutationCache({
      onError: (error) => notify(error),
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: shouldRetryQuery,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function createQueryPersister() {
  return createAsyncStoragePersister({
    storage: createSafeAsyncStorage(AsyncStorage),
    key: QUERY_PERSIST_KEY,
  });
}

/** Codes that should surface as toasts from global handlers. */
export function shouldToastApiError(error: unknown): boolean {
  if (!isApiError(error)) return true;
  if (error.code === 'UNAUTHORIZED' || error.status === 401) return false;
  if (error.isAborted) return false;
  return (
    error.isOffline ||
    error.code === 'FORBIDDEN' ||
    error.code === 'TOO_MANY_REQUESTS' ||
    error.status >= 500 ||
    error.code === 'INTERNAL_ERROR' ||
    error.code === 'OFFLINE'
  );
}

export function toastMessageForError(error: unknown): string {
  if (isApiError(error)) {
    if (error.isOffline) return 'You are offline';
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}
