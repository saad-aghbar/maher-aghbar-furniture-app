import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import { flattenPaginatedPages, getNextPageParamFromMeta } from '@/api/infinite';
import {
  approvePurchaseOrder,
  approvePurchaseRequest,
  convertPurchaseRequest,
  createPurchaseOrder,
  createPurchaseRequest,
  createPurchaseRequestFromLowStock,
  createSupplier,
  getPurchaseOrder,
  getPurchaseRequest,
  getSupplier,
  getSupplierInvoice,
  listPurchaseOrders,
  listPurchaseRequests,
  listSupplierInvoices,
  listSuppliers,
  receivePurchaseOrder,
  sendPurchaseOrder,
  type CreatePurchaseOrderInput,
  type CreatePurchaseRequestInput,
  type CreateSupplierInput,
  type GoodsReceiptInput,
} from './api';

type ListFilters = {
  q?: string;
  status?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export function usePurchaseOrdersInfiniteQuery(filters: ListFilters, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: queryKeys.purchasing.list(filters),
    queryFn: ({ pageParam }) =>
      listPurchaseOrders({ page: pageParam, pageSize: 20, ...filters }),
    initialPageParam: 1,
    getNextPageParam: getNextPageParamFromMeta,
    enabled,
  });
}

export function flattenPurchaseOrders(
  data: ReturnType<typeof usePurchaseOrdersInfiniteQuery>['data'],
) {
  return flattenPaginatedPages(data?.pages);
}

export function usePurchaseRequestsInfiniteQuery(filters: ListFilters, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: queryKeys.purchasing.requestList(filters),
    queryFn: ({ pageParam }) =>
      listPurchaseRequests({ page: pageParam, pageSize: 20, ...filters }),
    initialPageParam: 1,
    getNextPageParam: getNextPageParamFromMeta,
    enabled,
  });
}

export function flattenPurchaseRequests(
  data: ReturnType<typeof usePurchaseRequestsInfiniteQuery>['data'],
) {
  return flattenPaginatedPages(data?.pages);
}

export function useSupplierInvoicesInfiniteQuery(filters: ListFilters, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: queryKeys.purchasing.invoiceList(filters),
    queryFn: ({ pageParam }) =>
      listSupplierInvoices({ page: pageParam, pageSize: 20, ...filters }),
    initialPageParam: 1,
    getNextPageParam: getNextPageParamFromMeta,
    enabled,
  });
}

export function flattenSupplierInvoices(
  data: ReturnType<typeof useSupplierInvoicesInfiniteQuery>['data'],
) {
  return flattenPaginatedPages(data?.pages);
}

export function usePurchaseOrderQuery(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.purchasing.detail(id ?? ''),
    queryFn: () => getPurchaseOrder(id!),
    enabled: Boolean(id) && enabled,
  });
}

export function usePurchaseRequestQuery(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.purchasing.requestDetail(id ?? ''),
    queryFn: () => getPurchaseRequest(id!),
    enabled: Boolean(id) && enabled,
  });
}

export function useSupplierInvoiceQuery(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.purchasing.invoiceDetail(id ?? ''),
    queryFn: () => getSupplierInvoice(id!),
    enabled: Boolean(id) && enabled,
  });
}

export function useSuppliersQuery(enabled: boolean, q?: string) {
  return useQuery({
    queryKey: queryKeys.purchasing.suppliers({ q }),
    queryFn: () => listSuppliers({ page: 1, pageSize: 100, q }),
    enabled,
  });
}

export function useSupplierDetailQuery(id: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...queryKeys.purchasing.all, 'supplier', id ?? ''] as const,
    queryFn: () => getSupplier(id!),
    enabled: Boolean(id) && enabled,
  });
}

export function useCreatePurchaseMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePurchaseOrderInput) => createPurchaseOrder(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.purchasing.lists() }),
  });
}

export function useCreatePurchaseRequestMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePurchaseRequestInput) => createPurchaseRequest(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.purchasing.requestLists() }),
  });
}

export function useCreateSupplierMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSupplierInput) => createSupplier(body),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [...queryKeys.purchasing.all, 'suppliers'] }),
  });
}

export function useFromLowStockMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => createPurchaseRequestFromLowStock(),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.purchasing.requestLists() }),
  });
}

export function usePurchaseActionMutation(id: string) {
  const qc = useQueryClient();
  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: queryKeys.purchasing.detail(id) });
    await qc.invalidateQueries({ queryKey: queryKeys.purchasing.lists() });
  };
  return {
    approve: useMutation({
      mutationFn: () => approvePurchaseOrder(id),
      onSuccess: invalidate,
    }),
    send: useMutation({
      mutationFn: () => sendPurchaseOrder(id),
      onSuccess: invalidate,
    }),
    receive: useMutation({
      mutationFn: (body: GoodsReceiptInput) => receivePurchaseOrder(id, body),
      onSuccess: async () => {
        await invalidate();
        await qc.invalidateQueries({ queryKey: queryKeys.purchasing.materialDemand() });
        await qc.invalidateQueries({ queryKey: queryKeys.inventory.lists() });
        await qc.invalidateQueries({ queryKey: queryKeys.inventory.overview() });
        await qc.invalidateQueries({ queryKey: queryKeys.inventory.warehouses() });
        await qc.invalidateQueries({ queryKey: queryKeys.production.lists() });
        await qc.invalidateQueries({ queryKey: queryKeys.production.summary() });
        await qc.invalidateQueries({ queryKey: queryKeys.production.all });
      },
    }),
  };
}

export function usePurchaseRequestActionMutation(id: string) {
  const qc = useQueryClient();
  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: queryKeys.purchasing.requestDetail(id) });
    await qc.invalidateQueries({ queryKey: queryKeys.purchasing.requestLists() });
    await qc.invalidateQueries({ queryKey: queryKeys.purchasing.lists() });
  };
  return {
    approve: useMutation({
      mutationFn: () => approvePurchaseRequest(id),
      onSuccess: invalidate,
    }),
    convert: useMutation({
      mutationFn: () => convertPurchaseRequest(id),
      onSuccess: invalidate,
    }),
  };
}
