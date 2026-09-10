import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import { flattenPaginatedPages, getNextPageParamFromMeta } from '@/api/infinite';
import { useAuth } from '@/auth/AuthProvider';
import { listCustomers } from '@/api/modules/customers';
import { listSalesOrders } from '@/api/modules/sales-orders';
import { createInvoiceFromSalesOrder, getInvoice, listCreatableInvoiceSources, listInvoices, updateInvoice } from './api';
import { chargeReturn } from '@/api/modules/returns';
import { createSupplierInvoice } from '@/api/modules/purchasing';
import {
  deletePayment,
  deletePaymentAllocation,
  updatePayment,
  updatePaymentAllocation,
} from '@/api/modules/payments';
import type { InvoiceCreatableKind } from './invoiceCreate';
import { invoiceListCustomerScope } from './selectInvoice';

export function useInvoicesInfiniteQuery(
  filters: {
    status?: string;
    q?: string;
    customerId?: string;
    overdue?: boolean;
    kind?: 'ORDER' | 'RETURN';
  },
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

export function useCreatableInvoiceSourcesQuery(
  filters: { kind?: 'ALL' | InvoiceCreatableKind; q?: string },
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['invoices', 'creatable-sources', filters] as const,
    queryFn: () => listCreatableInvoiceSources({ page: 1, pageSize: 50, ...filters }),
    enabled,
  });
}

export function useCreateInvoiceFromSourceMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: { kind: InvoiceCreatableKind; id: string }) => {
      if (row.kind === 'RETURN') {
        const charged = await chargeReturn(row.id);
        return { id: charged.invoice.id, kind: row.kind };
      }
      if (row.kind === 'PURCHASING') {
        const invoice = await createSupplierInvoice({ purchaseOrderId: row.id });
        return { id: invoice.id, kind: row.kind };
      }
      const invoice = await createInvoiceFromSalesOrder(row.id);
      return { id: invoice.id, kind: row.kind };
    },
    onSuccess: async (created) => {
      await qc.invalidateQueries({ queryKey: queryKeys.invoices.lists() });
      await qc.invalidateQueries({ queryKey: queryKeys.purchasing.invoiceLists() });
      if (created.kind === 'PURCHASING') {
        await qc.invalidateQueries({ queryKey: queryKeys.purchasing.invoiceDetail(created.id) });
      } else {
        await qc.invalidateQueries({ queryKey: queryKeys.invoices.detail(created.id) });
      }
    },
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

export function useUpdatePaymentMutation(invoiceId: string, customerId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updatePayment>[1] }) =>
      updatePayment(id, body),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.invoices.lists() }),
        qc.invalidateQueries({ queryKey: queryKeys.invoices.detail(invoiceId) }),
        qc.invalidateQueries({ queryKey: queryKeys.payments.lists() }),
        customerId
          ? qc.invalidateQueries({ queryKey: queryKeys.payments.dealerSummary(customerId) })
          : Promise.resolve(),
        customerId
          ? qc.invalidateQueries({ queryKey: queryKeys.statements.detail(customerId) })
          : Promise.resolve(),
      ]);
    },
  });
}

export function useUpdateAllocationMutation(invoiceId: string, customerId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Parameters<typeof updatePaymentAllocation>[1];
    }) => updatePaymentAllocation(id, body),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.invoices.lists() }),
        qc.invalidateQueries({ queryKey: queryKeys.invoices.detail(invoiceId) }),
        qc.invalidateQueries({ queryKey: queryKeys.payments.lists() }),
        customerId
          ? qc.invalidateQueries({ queryKey: queryKeys.payments.dealerSummary(customerId) })
          : Promise.resolve(),
        customerId
          ? qc.invalidateQueries({ queryKey: queryKeys.statements.detail(customerId) })
          : Promise.resolve(),
      ]);
    },
  });
}

export function useDeleteAllocationMutation(invoiceId: string, customerId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePaymentAllocation(id),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.invoices.lists() }),
        qc.invalidateQueries({ queryKey: queryKeys.invoices.detail(invoiceId) }),
        qc.invalidateQueries({ queryKey: queryKeys.payments.lists() }),
        customerId
          ? qc.invalidateQueries({ queryKey: queryKeys.payments.dealerSummary(customerId) })
          : Promise.resolve(),
        customerId
          ? qc.invalidateQueries({ queryKey: queryKeys.statements.detail(customerId) })
          : Promise.resolve(),
      ]);
    },
  });
}

export function useDeletePaymentMutation(invoiceId: string, customerId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePayment(id),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.invoices.lists() }),
        qc.invalidateQueries({ queryKey: queryKeys.invoices.detail(invoiceId) }),
        qc.invalidateQueries({ queryKey: queryKeys.payments.lists() }),
        customerId
          ? qc.invalidateQueries({ queryKey: queryKeys.payments.dealerSummary(customerId) })
          : Promise.resolve(),
        customerId
          ? qc.invalidateQueries({ queryKey: queryKeys.statements.detail(customerId) })
          : Promise.resolve(),
      ]);
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
