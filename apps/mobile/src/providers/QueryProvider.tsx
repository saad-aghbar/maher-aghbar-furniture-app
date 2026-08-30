import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createElement, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, LogBox, type AppStateStatus, Platform } from 'react-native';
import { useToast } from '@/components/feedback/Toast';
import {
  createQueryClient,
  createQueryPersister,
  shouldDehydrateQuery,
  shouldToastApiError,
  toastMessageForError,
} from '@/api/queryClient';

function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
  }
}

function setupOnlineManager() {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected);
    }),
  );
}

setupOnlineManager();

LogBox.ignoreLogs([/dehydrated as pending/i, /was dehydrated/i]);

/**
 * Query client provider with AsyncStorage persistence (catalog/tasks lists only).
 * Uses createElement to avoid dual @types/react JSX conflicts in the monorepo.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const [client] = useState(() =>
    createQueryClient({
      onError: (error) => {
        if (!shouldToastApiError(error)) return;
        showToastRef.current({
          message: toastMessageForError(error),
          variant: 'error',
        });
      },
    }),
  );

  const [persister] = useState(() => createQueryPersister());

  useEffect(() => {
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, []);

  return createElement(
    PersistQueryClientProvider,
    {
      client,
      persistOptions: {
        persister,
        // Flush caches that dehydrated in-flight queries (TanStack debug banner).
        buster: 'no-pending-dehydrate-v1',
        dehydrateOptions: {
          shouldDehydrateQuery,
          shouldDehydrateMutation: () => false,
        },
        maxAge: 1000 * 60 * 60 * 24, // 24h
      },
      onError: () => {
        // Restore failed — drop silently. Never surface persist internals.
      },
    },
    children,
  );
}
