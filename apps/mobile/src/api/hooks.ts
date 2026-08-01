import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { ApiClientError, apiFetch } from './client';

export type Paginated<T> = {
  data: T[];
  meta?: { page: number; pageSize: number; totalItems: number; totalPages: number };
};

/** GET a `{ data, meta }` list endpoint and expose just the rows. */
export function useListQuery<T>(
  key: QueryKey,
  path: string,
  options: { enabled?: boolean } = {},
) {
  const query = useQuery({
    queryKey: key,
    enabled: options.enabled ?? true,
    queryFn: () => apiFetch<Paginated<T>>(path),
  });
  return { ...query, rows: query.data?.data ?? [], meta: query.data?.meta };
}

/** GET an endpoint that returns a bare array. */
export function useArrayQuery<T>(
  key: QueryKey,
  path: string,
  options: { enabled?: boolean } = {},
) {
  const query = useQuery({
    queryKey: key,
    enabled: options.enabled ?? true,
    queryFn: () => apiFetch<T[]>(path),
  });
  return { ...query, rows: query.data ?? [] };
}

export function useItemQuery<T>(key: QueryKey, path: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: key,
    enabled: options.enabled ?? true,
    queryFn: () => apiFetch<T>(path),
  });
}

export function errorMessage(err: unknown, fallback = 'Action failed'): string {
  if (err instanceof ApiClientError) return err.body?.message ?? err.message ?? fallback;
  if (err instanceof Error) return err.message;
  return fallback;
}

/**
 * POST/PATCH helper that invalidates the given query keys on success so lists
 * and detail screens stay consistent after a workflow action.
 */
export function useAction<TVars = void>(
  fn: (vars: TVars) => Promise<unknown>,
  invalidate: QueryKey[] = [],
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await Promise.all(invalidate.map((key) => qc.invalidateQueries({ queryKey: key })));
    },
  });
}
