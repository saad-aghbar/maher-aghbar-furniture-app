import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import {
  flattenPaginatedPages,
  getNextPageParamFromMeta,
} from '@/api/infinite';
import {
  createInventoryItem,
  createInventoryStockCount,
  createWarehouse,
  createWarehouseTransfer,
  completeWarehouseTransfer,
  getInventoryItem,
  getInventoryOverview,
  issueStock,
  listFinishedGoodsItems,
  listInventoryGroups,
  listInventoryItems,
  listInventoryStockCounts,
  listInventoryTransactions,
  listSemiFinishedLots,
  listWarehouseTransfers,
  listWarehouses,
  postInventoryStockCount,
  receiveStock,
  syncInventoryFromMaterials,
  updateInventoryItem,
  type CreateInventoryItemInput,
  type CreateInventoryStockCountInput,
  type CreateWarehouseInput,
  type CreateWarehouseTransferInput,
  type InventoryCategoryGroup,
  type StockIssueInput,
  type StockReceiptInput,
  type UpdateInventoryItemInput,
} from './api';

/** Hub already paints a floor error board — skip the generic query toast. */
const skipHubErrorToast = { skipErrorToast: true } as const;

export function useInventoryGroupsQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.inventory.groups(),
    queryFn: listInventoryGroups,
    enabled,
    staleTime: 30_000,
    meta: skipHubErrorToast,
  });
}

export function useInventoryItemsInfiniteQuery(
  filters: { categoryGroup: InventoryCategoryGroup; q?: string },
  enabled: boolean,
) {
  return useInfiniteQuery({
    queryKey: queryKeys.inventory.list(filters),
    queryFn: ({ pageParam }) =>
      listInventoryItems({
        page: pageParam,
        pageSize: 20,
        categoryGroup: filters.categoryGroup,
        q: filters.q,
      }),
    initialPageParam: 1,
    getNextPageParam: getNextPageParamFromMeta,
    enabled,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
    meta: skipHubErrorToast,
  });
}

export function flattenInventoryItemPages(
  data: ReturnType<typeof useInventoryItemsInfiniteQuery>['data'],
) {
  return flattenPaginatedPages(data?.pages);
}

export function useInventoryItemQuery(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.inventory.detail(id ?? ''),
    queryFn: () => getInventoryItem(id!),
    enabled: Boolean(id) && enabled,
    staleTime: 10_000,
  });
}

export function useInventoryTransactionsInfiniteQuery(
  id: string | undefined,
  enabled: boolean,
) {
  return useInfiniteQuery({
    queryKey: queryKeys.inventory.transactions(id ?? '', {}),
    queryFn: ({ pageParam }) =>
      listInventoryTransactions(id!, { page: pageParam, pageSize: 20 }),
    initialPageParam: 1,
    getNextPageParam: getNextPageParamFromMeta,
    enabled: Boolean(id) && enabled,
    staleTime: 15_000,
  });
}

export function flattenInventoryTransactionPages(
  data: ReturnType<typeof useInventoryTransactionsInfiniteQuery>['data'],
) {
  return flattenPaginatedPages(data?.pages);
}

export function useWarehousesQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.inventory.warehouses(),
    queryFn: listWarehouses,
    enabled,
    staleTime: 60_000,
  });
}

export function useReceiveStockMutation(itemId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: StockReceiptInput) => receiveStock(body),
    onSuccess: async (_data, variables) => {
      const id = itemId ?? variables.inventoryItemId;
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.inventory.detail(id) }),
        qc.invalidateQueries({ queryKey: queryKeys.inventory.lists() }),
        qc.invalidateQueries({ queryKey: queryKeys.inventory.groups() }),
        qc.invalidateQueries({
          queryKey: queryKeys.inventory.transactions(id, {}),
        }),
      ]);
    },
  });
}

export function useIssueStockMutation(itemId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: StockIssueInput) => issueStock(body),
    onSuccess: async (_data, variables) => {
      const id = itemId ?? variables.inventoryItemId;
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.inventory.detail(id) }),
        qc.invalidateQueries({ queryKey: queryKeys.inventory.lists() }),
        qc.invalidateQueries({ queryKey: queryKeys.inventory.groups() }),
        qc.invalidateQueries({
          queryKey: queryKeys.inventory.transactions(id, {}),
        }),
      ]);
    },
  });
}

export function useSyncInventoryFromMaterialsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => syncInventoryFromMaterials(),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.inventory.lists() }),
        qc.invalidateQueries({ queryKey: queryKeys.inventory.groups() }),
      ]);
    },
  });
}

export function useWarehouseTransfersInfiniteQuery(
  enabled: boolean,
  warehouseType?: string,
) {
  return useInfiniteQuery({
    queryKey: queryKeys.inventory.transfersList({ warehouseType }),
    queryFn: ({ pageParam }) =>
      listWarehouseTransfers({
        page: pageParam,
        pageSize: 20,
        warehouseType,
      }),
    initialPageParam: 1,
    getNextPageParam: getNextPageParamFromMeta,
    enabled,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
    meta: skipHubErrorToast,
  });
}

export function flattenWarehouseTransferPages(
  data: ReturnType<typeof useWarehouseTransfersInfiniteQuery>['data'],
) {
  return flattenPaginatedPages(data?.pages);
}

export function useInventoryStockCountsInfiniteQuery(
  enabled: boolean,
  warehouseType?: string,
) {
  return useInfiniteQuery({
    queryKey: queryKeys.inventory.countsList({ warehouseType }),
    queryFn: ({ pageParam }) =>
      listInventoryStockCounts({
        page: pageParam,
        pageSize: 20,
        warehouseType,
      }),
    initialPageParam: 1,
    getNextPageParam: getNextPageParamFromMeta,
    enabled,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
    meta: skipHubErrorToast,
  });
}

export function flattenInventoryStockCountPages(
  data: ReturnType<typeof useInventoryStockCountsInfiniteQuery>['data'],
) {
  return flattenPaginatedPages(data?.pages);
}

export function useCreateWarehouseMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateWarehouseInput) => createWarehouse(body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.inventory.warehouses() });
    },
  });
}

export function useCreateInventoryItemMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateInventoryItemInput) => createInventoryItem(body),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.inventory.lists() }),
        qc.invalidateQueries({ queryKey: queryKeys.inventory.groups() }),
      ]);
    },
  });
}

export function useUpdateInventoryItemMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateInventoryItemInput }) =>
      updateInventoryItem(id, body),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.inventory.detail(variables.id) }),
        qc.invalidateQueries({ queryKey: queryKeys.inventory.lists() }),
        qc.invalidateQueries({ queryKey: queryKeys.inventory.groups() }),
      ]);
    },
  });
}

export function useCreateWarehouseTransferMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateWarehouseTransferInput) => createWarehouseTransfer(body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.inventory.transfers() });
    },
  });
}

export function useCreateInventoryStockCountMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateInventoryStockCountInput) => createInventoryStockCount(body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.inventory.counts() });
    },
  });
}

export function useCompleteWarehouseTransferMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => completeWarehouseTransfer(id),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.inventory.transfers() }),
        qc.invalidateQueries({ queryKey: queryKeys.inventory.lists() }),
        qc.invalidateQueries({ queryKey: queryKeys.inventory.groups() }),
        qc.invalidateQueries({ queryKey: queryKeys.inventory.overview() }),
      ]);
    },
  });
}

export function usePostInventoryStockCountMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => postInventoryStockCount(id),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.inventory.counts() }),
        qc.invalidateQueries({ queryKey: queryKeys.inventory.lists() }),
        qc.invalidateQueries({ queryKey: queryKeys.inventory.groups() }),
        qc.invalidateQueries({ queryKey: queryKeys.inventory.overview() }),
      ]);
    },
  });
}

export function useInventoryOverviewQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.inventory.overview(),
    queryFn: getInventoryOverview,
    enabled,
    staleTime: 30_000,
  });
}

export function useSemiFinishedLotsInfiniteQuery(filters: { q?: string }, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: queryKeys.inventory.semiFinished(filters),
    queryFn: ({ pageParam }) =>
      listSemiFinishedLots({ page: pageParam, pageSize: 20, q: filters.q }),
    initialPageParam: 1,
    getNextPageParam: getNextPageParamFromMeta,
    enabled,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
    meta: skipHubErrorToast,
  });
}

export function flattenSemiFinishedPages(
  data: ReturnType<typeof useSemiFinishedLotsInfiniteQuery>['data'],
) {
  return flattenPaginatedPages(data?.pages);
}

export function useFinishedGoodsInfiniteQuery(filters: { q?: string }, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: queryKeys.inventory.finishedGoods(filters),
    queryFn: ({ pageParam }) =>
      listFinishedGoodsItems({ page: pageParam, pageSize: 20, q: filters.q }),
    initialPageParam: 1,
    getNextPageParam: getNextPageParamFromMeta,
    enabled,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
    meta: skipHubErrorToast,
  });
}

export function flattenFinishedGoodsPages(
  data: ReturnType<typeof useFinishedGoodsInfiniteQuery>['data'],
) {
  return flattenPaginatedPages(data?.pages);
}
