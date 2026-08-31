import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import { flattenPaginatedPages, getNextPageParamFromMeta } from '@/api/infinite';
import { useAuth } from '@/auth/AuthProvider';
import { listCustomers } from '@/api/modules/customers';
import { listSalesOrders } from '@/api/modules/sales-orders';
import { createInvoiceFromSalesOrder, getInvoice, listInvoices, updateInvoice } from './api';
import { invoiceListCustomerScope } from './selectInvoice';

export function useInvoicesInfiniteQuery(
  filters: { status?: string; q?: string; customerId?: string; overdue?: boolean },
  enabled: boolean,
) {
  const { user } = useAuth();
  const customerId = invoiceListCustomerScope(user?.customerId, filters.customerId);
  const scoped = { ...filters, customerId };

  return useInfiniteQuery({
    queryKey: queryKeys.invoices.list(scoped),
    queryFn: ({ pageParam }) =>
      listInvoices({ page: pageParam, pageSize: 20, ...scoped }),
    initialPageParam: 1,
    getNextPageParam: getNextPageParamFromMeta,
    enabled,
  });
}

export function flattenInvoices(data: ReturnType<typeof useInvoicesInfiniteQuery>['data']) {
  return flattenPaginatedPages(data?.pages);
}

export function useInvoiceQuery(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.invoices.detail(id ?? ''),
    queryFn: () => getInvoice(id!),
    enabled: Boolean(id) && enabled,
  });
}

export function useInvoiceCustomersQuery(enabled: boolean) {
  return useQuery({
    queryKey: ['customers', 'invoice-filter'],
    queryFn: () => listCustomers({ page: 1, pageSize: 100 }),
    enabled,
  });
}

export function useInvoiceSalesOrdersQuery(enabled: boolean) {
  return useQuery({
    queryKey: ['sales-orders', 'invoice-create'],
    queryFn: () => listSalesOrders({ page: 1, pageSize: 100 }),
    enabled,
  });
}

export function useCreateInvoiceMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (salesOrderId: string) => createInvoiceFromSalesOrder(salesOrderId),
    onSuccess: async (invoice) => {
      await qc.invalidateQueries({ queryKey: queryKeys.invoices.lists() });
      if (invoice?.id) {
        await qc.invalidateQueries({ queryKey: queryKeys.invoices.detail(invoice.id) });
      }
    },
  });
}

export function useUpdateInvoiceMutation(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof updateInvoice>[1]) =>
      updateInvoice(invoiceId, body),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.invoices.lists() }),
        qc.invalidateQueries({ queryKey: queryKeys.invoices.detail(invoiceId) }),
      ]);
    },
  });
}
