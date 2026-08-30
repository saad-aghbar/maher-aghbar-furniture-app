import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { MutationCache, QueryClient } from '@tanstack/react-query';
import { translateApiError, translateErrorCode } from '@maher/i18n';
import { getActiveLocale } from '@/i18n/LocaleProvider';
import { isApiError } from './errors';
import { isRawNetworkFailure } from './queryErrorToast';
import { shouldRetryQuery } from './retry';
import { createSafeAsyncStorage } from './safeAsyncStorage';
import { QUERY_PERSIST_KEY } from './queryPersist';
import { isQueryDebugToastMessage } from '@/components/feedback/queryDebugToast';
import { isTechnicalQueryError } from './toastErrors';

export { isTechnicalQueryError, shouldToastApiError } from './toastErrors';

export { createSafeAsyncStorage } from './safeAsyncStorage';
export { shouldDehydrateQuery, QUERY_PERSIST_KEY } from './queryPersist';

export type QueryClientHooks = {
  /** Mutation failures only. Query loads render ErrorState — do not toast those. */
  onError?: (error: unknown) => void;
};

export function createQueryClient(hooks: QueryClientHooks = {}): QueryClient {
  const notify = (error: unknown) => {
    hooks.onError?.(error);
  };

  return new QueryClient({
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

export function toastMessageForError(error: unknown, _t?: unknown): string {
  const locale = getActiveLocale();
  if (isRawNetworkFailure(error)) {
    return translateErrorCode(locale, 'NETWORK');
  }
  if (isTechnicalQueryError(error)) return translateErrorCode(locale, 'REQUEST_FAILED');
  const fallback = translateErrorCode(locale, 'REQUEST_FAILED');
  let message: string;
  if (isApiError(error)) {
    message = error.isOffline
      ? translateErrorCode(locale, 'OFFLINE')
      : translateApiError(locale, error);
  } else if (error instanceof Error) {
    message = translateApiError(locale, error);
  } else {
    message = fallback;
  }
  if (isQueryDebugToastMessage(message) || (error instanceof Error && isQueryDebugToastMessage(error.message))) {
    return fallback;
  }
  return message;
}
