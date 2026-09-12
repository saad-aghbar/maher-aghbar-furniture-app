import { apiGet, apiPost } from '../client';
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
  pendingReturns: number;
  recentOrders: DealerHomeOrder[];
  recentInvoices: DealerHomeInvoice[];
  generatedAt: string;
};

export async function getDealerHome(): Promise<DealerHomePayload> {
  return apiGet<DealerHomePayload>('/reports/dealer-home');
}

export type WorkerHomeTask = {
  id: string;
  productionOrderId?: string | null;
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
  from?: string;
  to?: string;
  customerId?: string;
  productId?: string;
  variantId?: string;
  optionValueId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
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
  topProducts?: Array<{
    productId: string | null;
    sku: string | null;
    name: string | null;
    lineCount: number;
    quantity: number;
    total: number;
  }>;
  bySalesRep?: Array<{
    salesRepId: string | null;
    name: string;
    count: number;
  }>;
  recentQuotes?: Array<{
    id: string;
    number: string;
    status: string;
    customerName?: string | null;
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
  const qs = toSearchParams({
    from: query.from,
    to: query.to,
    customerId: query.customerId,
    productId: query.productId,
  });
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

export type CostOrderRow = {
  id: string;
  number: string;
  status: string;
  productSummary: string;
  actualCost: number | null;
  plannedCost: number | null;
  variance: number | null;
  saleValue: number | null;
  grossMargin: number | null;
  marginPct: number | null;
  coverage: 'FINAL' | 'PARTIAL' | 'UNPRICED';
  labor: number | null;
  workerEffortMinutes: number;
  dealer?: { nameEn?: string | null; nameAr?: string | null; nameHe?: string | null };
};

export type CostOrderDossier = {
  id: string;
  number: string;
  status?: string;
  dealer?: { nameEn?: string | null; nameAr?: string | null; nameHe?: string | null };
  summary: {
    saleValue: number | null;
    actualProductionCost: number | null;
    plannedCost?: number | null;
    variance?: number | null;
    grossMargin: number | null;
    coverage: string;
    averageCostPerUnit: number | null;
    labor?: number | null;
  };
  lines?: Array<{
    id: string;
    description: string;
    sku: string | null;
    quantity: number;
    actualCost: number | null;
    averageCostPerUnit: number | null;
  }>;
  materials?: {
    coverage: string;
    rows?: Array<{
      inventoryItemId?: string;
      sku: string;
      actualCost: number | null;
      netQty: number;
    }>;
    usage?: Array<{
      sku: string;
      expectedQty: number;
      actualQty: number;
      scrapQty: number;
    }>;
  };
  time: {
    workerEffortMinutes: number;
    wallClockMinutes: number | null;
    reworkEffortMinutes: number;
    labor: {
      enabled: boolean;
      total: number | null;
      note: string | null;
      byWorker?: Array<{ userId: string; minutes: number; actual: number | null }>;
      byStage?: Array<{
        stageDefinitionId: string;
        stageCode: string | null;
        estimated: number | null;
        actual: number | null;
        minutes: number;
      }>;
    };
    byStage?: Array<{ stageCode: string | null; minutes: number }>;
  };
  returns?: Array<{ id: string; number: string; lifecycleState: string }>;
  provenance?: {
    source: string;
    formula: string;
    transactions?: Array<{
      id: string;
      number: string;
      type: string;
      sku: string;
      quantity: number;
      unitCost: number | null;
    }>;
  };
  lifetime: {
    originalProductionCost: number | null;
    afterSaleReturnCost: number | null;
    lifetimeCost: number | null;
    recoveredValue: number | null;
    disposedValue: number | null;
  };
};

export type CostProductRow = {
  productId: string;
  orderCount: number;
  averageActualCost: number | null;
  lowestActualCost: number | null;
  highestActualCost: number | null;
  averageEffortMinutes: number | null;
  product: { id: string; sku: string; nameEn?: string | null; nameAr?: string | null } | null;
};

export type CostVariantRow = {
  variantId: string;
  orderCount: number;
  averageActualCost: number | null;
  lowestActualCost: number | null;
  highestActualCost: number | null;
  variant?: {
    id?: string;
    sku?: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
    productId?: string;
  } | null;
};

export type CostOptionRow = {
  optionValueId: string;
  optionCode?: string | null;
  optionName?: string | null;
  groupCode?: string | null;
  groupName?: string | null;
  orderCount: number;
  averageActualCost: number | null;
};

export type CostReturnRow = {
  id: string;
  number: string;
  lifecycleState?: string;
  salesOrder?: { id: string; number: string } | null;
};

export type CostCoveragePayload = {
  pricedCount?: number;
  unpricedCount?: number;
  unpriced: Array<{ id: string; sku: string; nameEn?: string | null; category?: string | null }>;
};

export async function getCostOrders(query: ReportsPeriodQuery) {
  const qs = toSearchParams({
    from: query.from,
    to: query.to,
    customerId: query.customerId,
    productId: query.productId,
    variantId: query.variantId,
    optionValueId: query.optionValueId,
    status: query.status,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 50,
  });
  return apiGet<{ data: CostOrderRow[]; meta?: { page: number; pageSize: number; totalItems: number } }>(
    `/reports/cost/orders${qs}`,
  );
}

export async function getCostOrderDossier(id: string) {
  return apiGet<CostOrderDossier>(`/reports/cost/orders/${encodeURIComponent(id)}`);
}

export async function getCostProducts(query: ReportsPeriodQuery) {
  const qs = toSearchParams({
    from: query.from,
    to: query.to,
    customerId: query.customerId,
    productId: query.productId,
    variantId: query.variantId,
    optionValueId: query.optionValueId,
    status: query.status,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 50,
  });
  return apiGet<{
    data: CostProductRow[];
    products: CostProductRow[];
    variants?: CostVariantRow[];
    byOption?: CostOptionRow[];
    meta?: { totalItems: number };
  }>(
    `/reports/cost/products${qs}`,
  );
}

export async function getCostReturns(query: ReportsPeriodQuery) {
  const qs = toSearchParams({
    from: query.from,
    to: query.to,
    customerId: query.customerId,
    productId: query.productId,
    variantId: query.variantId,
    status: query.status,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 50,
  });
  return apiGet<{ data: CostReturnRow[] }>(`/reports/cost/returns${qs}`);
}

export type CostReturnDossier = {
  id: string;
  number: string;
  status?: string;
  lifecycleState?: string;
  salesOrder?: { id: string; number: string } | null;
  pieceCount?: number;
  repairCost?: number | null;
  replacementCost?: number | null;
  recoveryCost?: number | null;
  returnGrossCost?: number | null;
  recoveredValue?: number | null;
  disposedValue?: number | null;
  recoveredQty?: number;
  disposedQty?: number;
  workerEffortMinutes?: number;
  pieces?: Array<{
    id: string;
    repairCost: number | null;
    replacementCost: number | null;
    recoveryCost: number | null;
    workCost: number | null;
    workerEffortMinutes: number;
    recoveredValue?: number | null;
    disposedValue?: number | null;
  }>;
};

export async function getCostReturnDossier(id: string) {
  return apiGet<CostReturnDossier>(`/reports/cost/returns/${encodeURIComponent(id)}`);
}

export async function getCostCoverage() {
  return apiGet<CostCoveragePayload>('/reports/cost/coverage');
}

export async function postCostCoverageBackfill() {
  return apiPost<{ updated: number }>('/reports/cost/coverage/backfill', {});
}

export type CostLaborRateRow = {
  id: string;
  userId?: string | null;
  hourlyRate: number | string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  user?: { id: string; firstName: string; lastName: string } | null;
  stageDefinition?: { id: string; code: string; nameEn?: string | null; nameAr?: string | null } | null;
};

export async function getCostLaborRates() {
  return apiGet<CostLaborRateRow[]>('/reports/cost/labor-rates');
}

export type CostLaborActuals = {
  labor: { estimated: number | null; actual: number | null } | null;
  byWorker: Array<{ userId: string; name: string; minutes: number; actual: number | null }>;
  byStage: Array<{
    stageDefinitionId: string;
    stageCode: string | null;
    estimated: number | null;
    actual: number | null;
    minutes: number;
  }>;
};

export async function getCostLaborActuals(query: ReportsPeriodQuery = {}) {
  const qs = toSearchParams({ from: query.from, to: query.to });
  return apiGet<CostLaborActuals>(`/reports/cost/labor${qs}`);
}
