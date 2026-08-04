'use client';

import { detectUiLocale, translateApiError } from '@maher/i18n';
import {
  useMutation,
  useQueryClient,
  type QueryKey,
  type UseMutationOptions,
} from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { useState } from 'react';

/** Localized API / client error text for alerts, banners, and confirm dialogs. */
export function mutationErrorMessage(error: unknown, fallback?: string): string {
  const locale = detectUiLocale(
    typeof document !== 'undefined' ? document.documentElement.lang : undefined,
  );
  return translateApiError(locale, error, fallback);
}

interface UseApiMutationOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  invalidateKeys?: QueryKey[];
  onSuccessMessage?: string | ((data: TData) => string);
  onSuccess?: (data: TData, variables: TVariables) => void;
  mutationOptions?: Omit<
    UseMutationOptions<TData, Error, TVariables>,
    'mutationFn' | 'onSuccess' | 'onError'
  >;
}

export function useApiMutation<TData, TVariables = void>({
  mutationFn,
  invalidateKeys = [],
  onSuccessMessage,
  onSuccess,
  mutationOptions,
}: UseApiMutationOptions<TData, TVariables>) {
  const queryClient = useQueryClient();
  const locale = useLocale();
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    ...mutationOptions,
    mutationFn,
    onSuccess: async (data, variables) => {
      setError(null);
      for (const key of invalidateKeys) {
        await queryClient.invalidateQueries({ queryKey: key });
      }
      const message =
        typeof onSuccessMessage === 'function'
          ? onSuccessMessage(data)
          : (onSuccessMessage ?? null);
      setSuccess(message);
      onSuccess?.(data, variables);
    },
    onError: (err) => {
      setSuccess(null);
      setError(translateApiError(locale, err));
    },
  });

  return {
    ...mutation,
    success,
    error,
    clearMessages: () => {
      setSuccess(null);
      setError(null);
    },
  };
}
