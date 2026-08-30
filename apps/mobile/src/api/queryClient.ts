import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import {
  MutationCache,
  QueryCache,
  QueryClient,
} from '@tanstack/react-query';
import { translateApiError, translateErrorCode } from '@maher/i18n';
import { getActiveLocale } from '@/i18n/LocaleProvider';
import { isApiError } from './errors';
import { isRawNetworkFailure } from './queryErrorToast';
import { shouldRetryQuery } from './retry';
import { createSafeAsyncStorage } from './safeAsyncStorage';
import { QUERY_PERSIST_KEY } from './queryPersist';

export { createSafeAsyncStorage } from './safeAsyncStorage';
export { shouldDehydrateQuery, QUERY_PERSIST_KEY } from './queryPersist';

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

export function toastMessageForError(error: unknown, _t?: unknown): string {
  const locale = getActiveLocale();
  if (isRawNetworkFailure(error)) {
    return translateErrorCode(locale, 'NETWORK');
  }
  if (isApiError(error)) {
    if (error.isOffline) return translateErrorCode(locale, 'OFFLINE');
    return translateApiError(locale, error);
  }
  if (error instanceof Error) return translateApiError(locale, error);
  return translateErrorCode(locale, 'REQUEST_FAILED');
}
