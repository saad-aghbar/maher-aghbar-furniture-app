import type { AuthUser } from '@maher/types';
import { useArrayQuery, useItemQuery, useListQuery } from '../../api/hooks';
import { can } from '../../permissions/can';

export type DashboardReport = {
  activeOrders: number;
  ordersDueSoon: number;
  delayedProduction: number;
  waitingMaterials: number;
  pendingQuoteApprovals: number;
  outstandingInvoices: number;
  lowStock: number;
  criticalBlockers: number;
  dailyCompletions: number;
  revenueInvoiced: number;
  receivablesAmount: number;
  completedSalesOrders: number;
  openPurchases: number;
  generatedAt: string;
};

export type TaskRow = {
  id: string;
  number: string;
  name: string;
  status: string;
  priority: string;
  progressPercent: number;
  plannedCompletion: string | null;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  productionOrder?: { id: string; number: string; productDescription: string | null } | null;
  stageDefinition?: { id: string; code: string; nameEn: string; nameAr: string } | null;
  blockers?: { id: string; reason: string; resolvedAt: string | null }[];
};

export type DeliveryRow = {
  id: string;
  number: string;
  status: string;
  scheduledDate: string | null;
  customer?: { id: string; nameEn: string; nameAr: string } | null;
};

export type QuotationRow = {
  id: string;
  number: string;
  status: string;
  totalAmount: unknown;
  currency?: string | null;
  validUntil: string | null;
  customer?: { nameEn: string; nameAr: string } | null;
};

export type InvoiceRow = {
  id: string;
  number: string;
  status: string;
  totalAmount: unknown;
  paidAmount?: unknown;
  dueDate: string | null;
  customer?: { nameEn: string; nameAr: string } | null;
};

export type RequestRow = {
  id: string;
  number: string;
  status: string;
  title?: string | null;
  createdAt: string;
  customer?: { nameEn: string; nameAr: string } | null;
};

export type SalesOrderRow = {
  id: string;
  number: string;
  status: string;
  totalAmount: unknown;
  requestedDeliveryDate: string | null;
  customer?: { nameEn: string; nameAr: string } | null;
};

export type InspectionRow = {
  id: string;
  number: string;
  status: string;
  result?: string | null;
  createdAt: string;
  productionOrder?: { number: string } | null;
};

export type LowStockRow = {
  id: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  minStock: unknown;
  availableQty: unknown;
};

export type PurchaseOrderRow = {
  id: string;
  number: string;
  status: string;
  totalAmount: unknown;
  expectedDate?: string | null;
  supplier?: { nameEn: string; nameAr: string } | null;
};

/**
 * Fires only the queries the signed-in user is allowed to call, so each persona
 * gets a populated dashboard without triggering 403s for the others.
 */
export function useHomeData(user: AuthUser | null | undefined) {
  const report = useItemQuery<DashboardReport>(['reports', 'dashboard'], '/reports/dashboard', {
    enabled: can(user, 'report.sales.read'),
  });

  const tasks = useListQuery<TaskRow>(
    ['tasks', 'mine'],
    '/tasks?mine=true&pageSize=50',
    { enabled: can(user, 'production-task.read') },
  );

  const deliveries = useListQuery<DeliveryRow>(['deliveries', 'home'], '/deliveries?pageSize=50', {
    enabled: can(user, 'delivery.read'),
  });

  const quotations = useListQuery<QuotationRow>(
    ['quotations', 'home'],
    '/quotations?pageSize=50',
    { enabled: can(user, 'quotation.read') },
  );

  const invoices = useListQuery<InvoiceRow>(['invoices', 'home'], '/invoices?pageSize=50', {
    enabled: can(user, 'invoice.read'),
  });

  const requests = useListQuery<RequestRow>(['requests', 'home'], '/requests?pageSize=50', {
    enabled: can(user, 'request.read'),
  });

  const salesOrders = useListQuery<SalesOrderRow>(
    ['sales-orders', 'home'],
    '/sales-orders?pageSize=50',
    { enabled: can(user, 'sales-order.read') },
  );

  const inspections = useListQuery<InspectionRow>(
    ['quality-inspections', 'home'],
    '/quality-inspections?pageSize=50',
    { enabled: can(user, 'quality-inspection.read') },
  );

  const lowStock = useArrayQuery<LowStockRow>(['inventory', 'low-stock'], '/inventory/low-stock', {
    enabled: can(user, 'inventory.read'),
  });

  const purchaseOrders = useListQuery<PurchaseOrderRow>(
    ['purchase-orders', 'home'],
    '/purchase-orders?pageSize=50',
    { enabled: can(user, 'purchase-order.read') },
  );

  const sources = [
    report,
    tasks,
    deliveries,
    quotations,
    invoices,
    requests,
    salesOrders,
    inspections,
    lowStock,
    purchaseOrders,
  ];

  return {
    report,
    tasks,
    deliveries,
    quotations,
    invoices,
    requests,
    salesOrders,
    inspections,
    lowStock,
    purchaseOrders,
    isLoading: sources.some((s) => s.isLoading && s.fetchStatus !== 'idle'),
    isRefreshing: sources.some((s) => s.isFetching),
    refetchAll: () => {
      sources.forEach((s) => {
        void s.refetch();
      });
    },
  };
}
