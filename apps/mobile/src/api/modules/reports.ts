import { apiGet } from '../client';
import { toSearchParams } from '../pagination';

export type AdminHomeUrgentTask = {
  id: string;
  number: string;
  name: string;
  priority: string;
  status: string;
  plannedCompletion: string | null;
  assigneeName: string | null;
};

export type AdminHomeActivity = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  actorName: string | null;
};

export type AdminHomeRecentOrder = {
  id: string;
  number: string;
  status: string;
  title: string;
  imageUrl: string | null;
  customerName: string | null;
  externalOrderNumber: string | null;
  endCustomerName: string | null;
  requiredDeliveryDate?: string | null;
  /** Scheduler-committed date, when a schedule has been approved. */
  committedDeliveryDate?: string | null;
};

export type FloorSpotlightReason = 'late' | 'nearing' | 'in_production';

export type AdminHomeFloorSpotlight = {
  order: AdminHomeRecentOrder;
  reason: FloorSpotlightReason;
  /** How many open orders share this priority bucket (factory scale). */
  peerCount: number;
};

export type AdminHomePayload = {
  newOrders: number;
  ordersInProduction: number;
  ordersNearingDelivery: number;
  completedOrders: number;
  delayedOrders: number;
  openInvoices: number;
  outstandingReceivables: number | string;
  dealersActive: number;
  pendingReturns: number;
  lowStockItems: number;
  recentOrders: AdminHomeRecentOrder[];
  generatedAt: string;
  completedToday: number;
  urgentTasksCount: number;
  urgentTasks: AdminHomeUrgentTask[];
  unreadNotifications: number;
  recentActivity: AdminHomeActivity[] | null;
  /** Priority exemplar from hottest queue — not “newest of recent”. */
  floorSpotlight?: AdminHomeFloorSpotlight | null;
};

export async function getAdminHome(): Promise<AdminHomePayload> {
  return apiGet<AdminHomePayload>('/reports/admin-home');
}

/** Piece 12 management desk tile — count + deep-link contract. */
export type MgmtTile = {
  count: number;
  key: string;
  href: string;
  filter: string;
};

export type MgmtAttentionCard = {
  id: string;
  title: string;
  why: string;
  actionLabel: string;
  priority: 'critical' | 'high' | 'normal';
  href: string;
  filter: string;
};

export type MgmtFlowPhase = {
  key: string;
  label: string;
  count: number;
  href: string;
  filter: string;
};

export type MgmtBlockedItem = {
  id: string;
  title: string;
  why: string;
  href: string;
  filter: string;
};

export type MgmtEvent = {
  at: string;
  label: string;
  href?: string;
};

export type MgmtFinanceSummary = {
  receivable: number;
  overdue: number;
  /** Never net with overdue. */
  accountCredit: number;
  paymentsThisMonth: number;
  openInvoices: MgmtTile;
  topOverdue: Array<{ customerId: string; name: string; amount: number; href: string }>;
};

export type ManagementSummaryPayload = {
  attention: MgmtAttentionCard[];
  today: {
    productionStarting: MgmtTile;
    productionDue: MgmtTile;
    qualityWaiting: MgmtTile;
    finishedToday: MgmtTile;
    leavingToday: MgmtTile;
    receivingToday: MgmtTile;
  };
  factoryFlow: MgmtFlowPhase[];
  production: {
    activeOrders: MgmtTile;
    tasksCompletedToday: MgmtTile;
    blocked: MgmtTile;
    dueToday: MgmtTile;
    events: MgmtEvent[];
  };
  blocked: MgmtBlockedItem[];
  workers: {
    workingToday: number;
    assigned: number;
    unassigned: number;
    conflicts: number;
  } | null;
  late: { overdue: MgmtTile; atRiskLimited: boolean };
  outbound: {
    finishedWaiting: MgmtTile;
    leavingToday: MgmtTile;
    overduePickup: MgmtTile;
    shippedAwaitingDealer: MgmtTile;
  };
  materials: {
    needsPurchasing: MgmtTile;
    blockingProduction: MgmtTile;
    arrivingToday: MgmtTile;
    lateSupplierPos: MgmtTile;
  };
  inventory: {
    rawShortages: MgmtTile;
    semiHandoff: MgmtTile;
    finishedWaiting: MgmtTile;
    correctionsAttention: MgmtTile;
  };
  quality: {
    waitingInspection: MgmtTile;
    failRework: MgmtTile;
    readyReinspection: MgmtTile;
    passedToday: MgmtTile;
  };
  exceptions: {
    returnsOpen: MgmtTile;
    waitingReturn: MgmtTile;
    waitingInspection: MgmtTile;
    cancelDisposition: MgmtTile;
    inventoryCorrections: MgmtTile;
  };
  finance: MgmtFinanceSummary | null;
  manufacturing: {
    finalCostOrders: number;
    finalCostTotal: number;
    incompleteCosting: number;
    grossMfgDifference: number | null;
  } | null;
  activity: MgmtEvent[];
  generatedAt: string;
};

/** `GET /reports/management-summary` — Piece 12 factory management desk. */
export async function getManagementSummary(): Promise<ManagementSummaryPayload> {
  return apiGet<ManagementSummaryPayload>('/reports/management-summary');
}

export type DealerHomeOrder = {
  id: string;
  number: string;
  status: string;
  title: string;
  imageUrl: string | null;
  progressPercent: number;
  progressLabel: string;
  externalOrderNumber: string | null;
  endCustomerName: string | null;
  requiredDeliveryDate: string | null;
  requestedDeliveryDate?: string | null;
  suggestedDeliveryDate?: string | null;
  committedDeliveryDate?: string | null;
  projectedDeliveryDate?: string | null;
  plannedDeliveryDate?: string | null;
  actualDeliveryDate?: string | null;
  calendarDate?: string | null;
  customerStatus?: string | null;
};

export type DealerHomeInvoice = {
  id: string;
  number: string;
  status: string;
  total: string;
  outstandingAmount: string;
  issuedAt: string;
  dueDate: string | null;
};

export type DealerHomePayload = {
  activeOrders: number;
  ordersInProduction: number;
  ordersNearingDelivery: number;
  completedOrders: number;
  outstandingBalance: string;
  balanceDueInDays: number | null;
  unreadNotifications: number;
  recentOrders: DealerHomeOrder[];
  recentInvoices: DealerHomeInvoice[];
  generatedAt: string;
};

export async function getDealerHome(): Promise<DealerHomePayload> {
  return apiGet<DealerHomePayload>('/reports/dealer-home');
}

export type WorkerHomeTask = {
  id: string;
  number: string;
  name: string;
  nameEn?: string | null;
  nameAr?: string | null;
  nameHe?: string | null;
  priority: string;
  status: string;
  orderNumber: string;
  productTitle: string;
  productNameEn?: string | null;
  productNameAr?: string | null;
  productNameHe?: string | null;
  imageUrl: string | null;
  deadline: string | null;
  /** Estimated duration in minutes when known. */
  estimatedMinutes: number | null;
  timing?: {
    status: 'running' | 'stopped' | 'idle' | 'done';
    actualMinutes: number;
    actualSeconds?: number;
    openStartedAt: string | null;
    estimatedMinutes: number | null;
    plannedCompletion: string | null;
    elapsedMinutes: number;
    /** Scheduler allocation start, when this task has been scheduled. */
    plannedStart?: string | null;
  };
};

export type WorkerHomeNotification = {
  id: string;
  title: string;
  body: string;
  titleEn?: string | null;
  titleAr?: string | null;
  bodyEn?: string | null;
  bodyAr?: string | null;
  createdAt: string;
  readAt: string | null;
};

export type WorkerHomePayload = {
  completedTodayCount: number;
  unreadNotifications: number;
  urgentTask: WorkerHomeTask | null;
  todaysTasks: WorkerHomeTask[];
  notifications: WorkerHomeNotification[];
  generatedAt: string;
};

export async function getWorkerHome(): Promise<WorkerHomePayload> {
  return apiGet<WorkerHomePayload>('/reports/worker-home');
}

export type ReportsPeriodQuery = {
  from: string;
  to: string;
};

export type DashboardReportPayload = {
  activeOrders?: number;
  ordersInProduction?: number;
  ordersDueSoon?: number;
  ordersNearingDelivery?: number;
  delayedProduction?: number;
  delayedOrders?: number;
  outstandingInvoices?: number;
  openInvoices?: number;
  revenueInvoiced?: number | string | null;
  receivablesAmount?: number | string | null;
  outstandingReceivables?: number | string | null;
  lowStock?: number;
  lowStockItems?: number;
  openPurchases?: number;
  generatedAt?: string;
};

export type SalesReportPayload = {
  ordersByStatus?: Array<{ status?: string; count?: number; total?: number }>;
  topCustomers?: Array<{
    customerId: string;
    customerName: string;
    orderCount: number;
    total: number;
  }>;
};

export type ProductionReportPayload = {
  ordersByStatus?: Array<{ status?: string; _count?: number; count?: number }>;
  tasksByStatus?: Array<{ status?: string; _count?: number; count?: number }>;
  delayedCount?: number;
  openCount?: number;
};

export type FinancialReportPayload = {
  invoicesByStatus?: Array<{
    status?: string;
    count?: number;
    total?: number;
    outstanding?: number;
  }>;
  paymentsTotal?: number;
  paymentCount?: number;
  aging?: {
    current: number;
    d1_30: number;
    d31_60: number;
    d61_90: number;
    older: number;
  };
};

export async function getDashboardReport(): Promise<DashboardReportPayload> {
  return apiGet<DashboardReportPayload>('/reports/dashboard');
}

export async function getSalesReport(query: ReportsPeriodQuery): Promise<SalesReportPayload> {
  const qs = toSearchParams({ from: query.from, to: query.to });
  return apiGet<SalesReportPayload>(`/reports/sales${qs}`);
}

export async function getProductionReport(
  query: ReportsPeriodQuery,
): Promise<ProductionReportPayload> {
  const qs = toSearchParams({ from: query.from, to: query.to });
  return apiGet<ProductionReportPayload>(`/reports/production${qs}`);
}

export async function getFinancialReport(): Promise<FinancialReportPayload> {
  return apiGet<FinancialReportPayload>('/reports/financial');
}
