'use client';

import { ApiClientError } from '@/lib/api-client';
import {
  useMutation,
  useQueryClient,
  type QueryKey,
  type UseMutationOptions,
} from '@tanstack/react-query';
import { useState } from 'react';

export function mutationErrorMessage(error: unknown, fallback = 'Request failed'): string {
  if (error instanceof ApiClientError) return error.body?.message ?? error.message;
  if (error instanceof Error) return error.message;
  return fallback;
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
      setError(mutationErrorMessage(err));
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
