import { apiGet } from '@/api/client';
import { toSearchParams } from '@/api/pagination';

export type ReportPeriodQuery = {
  from?: string;
  to?: string;
  customerId?: string;
  productId?: string;
  salesRepId?: string;
};

export type DashboardReport = {
  newOrders?: number;
  ordersInProduction?: number;
  ordersNearingDelivery?: number;
  delayedOrders?: number;
  openInvoices?: number;
  outstandingReceivables?: number;
  lowStockItems?: number;
  activeOrders?: number;
  ordersDueSoon?: number;
  delayedProduction?: number;
  outstandingInvoices?: number;
  lowStock?: number;
  revenueInvoiced?: number;
  receivablesAmount?: number;
  openPurchases?: number;
  generatedAt?: string;
};

export type SalesReport = {
  ordersByStatus: Array<{ status: string; count: number; total: number }>;
  topCustomers: Array<{
    customerId: string;
    customerName: string;
    orderCount: number;
    total: number;
  }>;
  topProducts?: Array<{
    productId: string | null;
    sku: string | null;
    name: string | null;
    lineCount: number;
    quantity: number;
    total: number;
  }>;
  recentQuotes: Array<{
    id: string;
    number: string;
    status: string;
    total: string | number;
    customer: string;
  }>;
};

export type ProductionReport = {
  ordersByStatus: Array<{ status: string; _count: number }>;
  delayedOrders: Array<{
    id: string;
    number: string;
    status: string;
    daysLate?: number;
    customerName?: string | null;
    progressPercent?: number | null;
  }>;
  openCount?: number;
  delayedCount?: number;
  tasksByStatus: Array<{ status: string; _count: number }>;
  onTimeRate?: {
    sampleSize: number;
    onTimeCount: number;
    onTimeRate: number | null;
  };
};

export type OrderProfitReport = {
  totals: {
    sellerPrice: number;
    productionPrice: number;
    profit: number;
    orderCount: number;
  };
};

export type FinancialReport = {
  invoicesByStatus: Array<{
    status: string;
    count: number;
    total: number;
    outstanding: number;
  }>;
  paymentsTotal: number;
  paymentCount: number;
  aging: {
    current: number;
    d1_30: number;
    d31_60: number;
    d61_90: number;
    older: number;
  };
  openInvoices: Array<{
    id?: string;
    number: string;
    customer: string;
    dueDate?: string | null;
    outstanding: string | number;
  }>;
};

export type CashFlowReport = {
  totals: { inflow: number; outflow: number; net: number };
};

export type PeriodPlReport = {
  totals: {
    revenueOrders: number;
    revenueInvoiced: number;
    materialCogs: number;
    supplierSpend: number;
    laborHours: number;
    laborCost: number;
    grossProfit: number;
    contribution: number;
  };
};

export type InventoryReport = {
  lowStock: Array<{
    sku: string;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
    available: number;
    minStock: number;
  }>;
};

export type PurchasingReport = {
  purchaseOrdersByStatus: Array<{ status: string; _count: number }>;
  purchaseRequestsByStatus?: Array<{ status: string; _count: number }>;
};

function qs(query?: ReportPeriodQuery): string {
  if (!query) return '';
  return toSearchParams({
    from: query.from,
    to: query.to,
    customerId: query.customerId,
    productId: query.productId,
    salesRepId: query.salesRepId,
  });
}

export function getDashboardReport(): Promise<DashboardReport> {
  return apiGet<DashboardReport>('/reports/dashboard');
}

export function getSalesReport(query?: ReportPeriodQuery): Promise<SalesReport> {
  return apiGet<SalesReport>(`/reports/sales${qs(query)}`);
}

export function getProductionReport(query?: ReportPeriodQuery): Promise<ProductionReport> {
  return apiGet<ProductionReport>(`/reports/production${qs(query)}`);
}

export function getOrderProfitReport(query?: ReportPeriodQuery): Promise<OrderProfitReport> {
  return apiGet<OrderProfitReport>(`/reports/order-profit${qs(query)}`);
}

export function getFinancialReport(): Promise<FinancialReport> {
  return apiGet<FinancialReport>('/reports/financial');
}

export function getCashFlowReport(query?: ReportPeriodQuery): Promise<CashFlowReport> {
  return apiGet<CashFlowReport>(`/reports/cash-flow${qs(query)}`);
}

export function getPeriodPlReport(query?: ReportPeriodQuery): Promise<PeriodPlReport> {
  return apiGet<PeriodPlReport>(`/reports/period-pl${qs(query)}`);
}

export function getInventoryReport(): Promise<InventoryReport> {
  return apiGet<InventoryReport>('/reports/inventory');
}

export function getPurchasingReport(): Promise<PurchasingReport> {
  return apiGet<PurchasingReport>('/reports/purchasing');
}
