import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import { keepPreviousListDataIfSameScope } from '@/api/keepPreviousListScope';
import {
  flattenPaginatedPages,
  getNextPageParamFromMeta,
} from '@/api/infinite';
import {
  cancelSalesOrder,
  confirmSalesOrder,
  getSalesOrder,
  holdSalesOrder,
  listSalesOrders,
  updateSalesOrder,
  type SalesOrderListFilters,
  type UpdateSalesOrderInput,
} from './api';
import { listRequests } from '@/api/modules/requests';

export type OrdersListQueryFilters = Omit<SalesOrderListFilters, 'page' | 'pageSize'>;

export function useOrdersInfiniteQuery(
  filters: OrdersListQueryFilters,
  enabled: boolean,
) {
  return useInfiniteQuery({
    queryKey: queryKeys.salesOrders.list(filters),
    queryFn: ({ pageParam }) =>
      listSalesOrders({
        ...filters,
        page: pageParam,
        pageSize: 20,
      }),
    initialPageParam: 1,
    getNextPageParam: getNextPageParamFromMeta,
    enabled,
    staleTime: 30_000,
    // Keep the board visible while search / sort loads — never across type or journey.
    placeholderData: (previousData, previousQuery) =>
      keepPreviousListDataIfSameScope(
        previousData,
        previousQuery,
        {
          orderType: filters.orderType ?? null,
          journeyBucket: filters.journeyBucket ?? null,
        },
        ['orderType', 'journeyBucket'],
      ),
  });
}

export function flattenOrdersPages(
  data: ReturnType<typeof useOrdersInfiniteQuery>['data'],
) {
  return flattenPaginatedPages(data?.pages);
}

export type AdminRequestsListFilters = Omit<
  import('@/api/modules/requests').ListRequestsFilters,
  'page' | 'pageSize'
>;

export function useAdminRequestsInfiniteQuery(
  filters: AdminRequestsListFilters,
  enabled: boolean,
) {
  return useInfiniteQuery({
    queryKey: queryKeys.requests.list(filters),
    queryFn: ({ pageParam }) =>
      listRequests({
        ...filters,
        page: pageParam,
        pageSize: 20,
      }),
    initialPageParam: 1,
    getNextPageParam: getNextPageParamFromMeta,
    enabled,
    staleTime: 15_000,
    placeholderData: (previousData, previousQuery) =>
      keepPreviousListDataIfSameScope(
        previousData,
        previousQuery,
        {
          requestType: filters.requestType ?? null,
          statusGroup: filters.statusGroup ?? null,
        },
        ['requestType', 'statusGroup'],
      ),
  });
}

export function flattenRequestsPages(
  data: ReturnType<typeof useAdminRequestsInfiniteQuery>['data'],
) {
  return flattenPaginatedPages(data?.pages);
}

export function useSalesOrderQuery(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.salesOrders.detail(id ?? ''),
    queryFn: () => getSalesOrder(id!),
    enabled: Boolean(id) && enabled,
    // Manufacturing actual/variance move as floor usage posts — keep the desk current.
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });
}

function useInvalidateSalesOrder(id: string) {
  const qc = useQueryClient();
  return async () => {
    await qc.invalidateQueries({ queryKey: queryKeys.salesOrders.detail(id) });
    await qc.invalidateQueries({ queryKey: queryKeys.salesOrders.lists() });
  };
}

export function useSalesOrderActions(id: string) {
  const invalidate = useInvalidateSalesOrder(id);
  return {
    confirm: useMutation({
      mutationFn: () => confirmSalesOrder(id),
      onSuccess: invalidate,
    }),
    hold: useMutation({
      mutationFn: (reason?: string) => holdSalesOrder(id, reason),
      onSuccess: invalidate,
    }),
    cancel: useMutation({
      mutationFn: (reason?: string) => cancelSalesOrder(id, reason),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (body: UpdateSalesOrderInput) => updateSalesOrder(id, body),
      onSuccess: invalidate,
    }),
  };
}
