import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import { flattenPaginatedPages, getNextPageParamFromMeta } from '@/api/infinite';
import {
  createReturn,
  getReturn,
  listReturns,
  resolveReturn,
  type ReturnReason,
} from './api';

export function useReturnsInfiniteQuery(
  filters: { q?: string; customerId?: string },
  enabled: boolean,
) {
  return useInfiniteQuery({
    queryKey: queryKeys.returns.list(filters),
    queryFn: ({ pageParam }) =>
      listReturns({ page: pageParam, pageSize: 20, ...filters }),
    initialPageParam: 1,
    getNextPageParam: getNextPageParamFromMeta,
    enabled,
  });
}

export function flattenReturns(data: ReturnType<typeof useReturnsInfiniteQuery>['data']) {
  return flattenPaginatedPages(data?.pages);
}

export function useReturnQuery(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.returns.detail(id ?? ''),
    queryFn: () => getReturn(id!),
    enabled: Boolean(id) && enabled,
  });
}

export function useCreateReturnMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createReturn,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.returns.lists() }),
  });
}

export function useResolveReturnMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: 'APPROVED' | 'REJECTED') => resolveReturn(id, status),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.returns.detail(id) });
      await qc.invalidateQueries({ queryKey: queryKeys.returns.lists() });
    },
  });
}

export type { ReturnReason };
