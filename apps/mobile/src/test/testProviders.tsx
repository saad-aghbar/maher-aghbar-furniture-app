import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LocaleProvider } from '@/i18n';
import { ThemeProvider } from '@/theme';
import { OrderBasketProvider } from '@/features/requests/OrderBasketProvider';
import { HARNESS_SAFE_AREA } from './harnessScopes';

export function createHarnessQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function HarnessProviders({
  children,
  locale = 'en',
  queryClient,
}: {
  children: ReactNode;
  locale?: 'en' | 'ar' | 'he';
  queryClient?: QueryClient;
}) {
  const client = queryClient ?? createHarnessQueryClient();
  return (
    <SafeAreaProvider initialMetrics={HARNESS_SAFE_AREA}>
      <ThemeProvider initialMode="light">
        <LocaleProvider initialLocale={locale}>
          <QueryClientProvider client={client}>
            <OrderBasketProvider>{children}</OrderBasketProvider>
          </QueryClientProvider>
        </LocaleProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
