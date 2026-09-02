import type { PaginatedResponse } from '@maher/types';
import { apiGet, apiPatch, apiPost, apiPut } from '../client';
import { toSearchParams, type PageParams } from '../pagination';
import type { ProductionSetupBehavior, ProductionSetupStage } from './workflow';

export type ProductionListBucket =
  | 'all'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'in_production'
  | 'late'
  | 'completed'
  | 'needs_setup'
  | 'ready_to_start'
  | 'on_floor'
  | 'blocked'
  | 'inspection_packaging';

export type ProductionPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type ProductionReadinessReason = {
  code: string;
  stageId?: string | null;
  stageCode?: string;
  stageName?: string;
  taskId?: string;
  message?: string;
};

export type ProductionReadiness = {
  policy: string;
  canStart: boolean;
  materialsReady: boolean;
  workflowReady: boolean;
  schedulePresent: boolean;
  workersReady?: boolean;
  datesReady?: boolean;
  setupReady?: boolean;
  assignment: {
    required: number;
    assigned: number;
    missing: Array<{
      taskId: string;
      stageId: string | null;
      stageCode: string;
      stageName: string;
    }>;
  };
  dates?: {
    required: number;
    ready: number;
    missing: Array<{
      taskId: string;
      stageId: string | null;
      stageCode: string;
      stageName: string;
    }>;
  };
  blockers: Array<{ kind: string; taskId?: string; message?: string }>;
  reasons: ProductionReadinessReason[];
  boardBucket: ProductionListBucket | string;
};

export type ProductionSummary = {
  dailyProduction: number;
  weeklyProduction: number;
  monthlyProduction: number;
  completedToday: number;
  completedThisWeek: number;
  completedThisMonth: number;
  completedOrders: number;
  inProduction: number;
  lateOrders: number;
  overallProgress: number;
  needsSetup?: number;
  readyToStart?: number;
  onFloor?: number;
  blocked?: number;
  inspectionPackaging?: number;
};

export type ProductionCustomer = {
  id: string;
  code?: string;
  name?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
};

export type ProductionOrderListItem = {
  id: string;
  number: string;
  status: string;
  priority: ProductionPriority | string;
  progressPercent: number;
  quantity?: number | string | null;
  productDescription?: string | null;
  requiredDeliveryDate?: string | null;
  plannedCompletionDate?: string | null;
  /** Scheduler-committed date, when a schedule has been approved. */
  committedDeliveryDate?: string | null;
  /** Dealer-safe commercial promise state (see @maher scheduling domain). */
  promiseState?: string | null;
  imageUrl?: string | null;
  isLate?: boolean;
  customer?: ProductionCustomer | null;
  product?: {
    id: string;
    sku?: string;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
    imageUrl?: string | null;
    manufacturingCost?: number | string | null;
  } | null;
  salesOrder?: {
    id: string;
    number: string;
    externalOrderNumber?: string | null;
  } | null;
  salesOrderLine?: {
    id: string;
    description?: string | null;
    productionSetup?: {
      workflowId?: string | null;
      manufacturingName?: string | null;
    } | null;
  } | null;
  currentStage?: {
    code: string;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
  } | null;
  readiness?: ProductionReadiness | null;
  releasedToFactoryAt?: string | null;
  releasedToFactoryById?: string | null;
  actualStartDate?: string | null;
  plannedStartDate?: string | null;
  /** Phase C day lens enrichment (present when onDate+dateMode queried). */
  dayLens?: ProductionDayLensPayload | null;
};

export type ProductionDateMode = 'planned' | 'actual';

export type ProductionDayLensPlannedTask = {
  taskId: string;
  taskNumber: string;
  stageCode?: string | null;
  stageNameEn?: string | null;
  stageNameAr?: string | null;
  stageNameHe?: string | null;
  department?: string | null;
  workerName?: string | null;
  plannedStart?: string | null;
  plannedCompletion?: string | null;
  estimatedMinutes?: number | null;
  status?: string;
};

export type ProductionDayLensEvent = {
  kind: string;
  at: string;
  stage?: string | null;
  worker?: string | null;
  sku?: string | null;
  name?: string | null;
};

export type ProductionDayLensPayload = {
  mode: ProductionDateMode;
  onDate: string;
  timezone: string;
  plannedTasks?: ProductionDayLensPlannedTask[];
  events?: ProductionDayLensEvent[];
};

export type ProductionDaySummary = {
  onDate: string;
  timezone: string;
  factoryTodayYmd: string;
  isToday: boolean;
  isFuture: boolean;
  dateMode?: ProductionDateMode;
  planned: {
    orders: number;
    tasks: number;
    byDepartment: Array<{ code: string; nameEn: string; taskCount: number }>;
  };
  actual: {
    orders: number;
    taskEvents: number;
  };
  lateMissed: number;
  atRisk: number;
  /** Board lane counts scoped to onDate + dateMode (view/filter only). */
  board?: {
    needsSetup: number;
    readyToStart: number;
    onFloor: number;
    blocked: number;
    inspectionPackaging: number;
  };
};

export type ProductionBlocker = {
  id: string;
  category: string;
  reason: string;
  resolvedAt?: string | null;
  taskId?: string;
  taskName?: string;
  taskNumber?: string;
};

export type ProductionTask = {
  id: string;
  number: string;
  name: string;
  status: string;
  priority?: string;
  progressPercent?: number;
  notes?: string | null;
  assignedEmployeeId?: string | null;
  assignedEmployee?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
  } | null;
  actualCompletion?: string | null;
  plannedCompletion?: string | null;
  /** Scheduler allocation start, when this task has been scheduled. */
  plannedStart?: string | null;
  estimatedMinutes?: number | null;
  actualMinutes?: number | null;
  timing?: {
    status: string;
    actualMinutes: number;
    actualSeconds?: number;
    openStartedAt: string | null;
    estimatedMinutes: number | null;
    plannedCompletion: string | null;
    elapsedMinutes: number;
  };
  blockers?: Array<{
    id: string;
    category: string;
    reason: string;
    resolvedAt?: string | null;
  }>;
  stageDefinition?: {
    id?: string;
    code?: string;
    nameEn?: string;
    nameAr?: string | null;
    nameHe?: string | null;
    responsibleDepartment?: string | null;
    executionKind?: string | null;
  } | null;
};

export type ProductionOrderDetail = ProductionOrderListItem & {
  notes?: string | null;
  openBlockers?: ProductionBlocker[];
  tasks?: ProductionTask[];
  /** Role-scoped workflow stages (dealer-safe or admin-enriched). */
  stages?: Array<{
    code?: string;
    nameEn?: string;
    nameAr?: string | null;
    nameHe?: string | null;
    sortOrder?: number;
    dependsOnCodes?: string[];
    status?: string;
    progressPercent?: number | null;
    actualStart?: string | null;
    actualEnd?: string | null;
    plannedEnd?: string | null;
    notes?: string | null;
    isOverdue?: boolean;
    assignees?: Array<{
      id: string;
      name: string;
      elapsedMinutes?: number;
      actualMinutes?: number;
      running?: boolean;
      openStartedAt?: string | null;
      estimatedMinutes?: number | null;
      plannedCompletion?: string | null;
    }>;
    blockers?: { id: string; category: string; reason: string }[];
    attachmentCount?: number;
    photos?: Array<{ id: string; fileName: string; mimeType?: string | null }>;
    stageDefinition?: {
      code: string;
      nameEn?: string | null;
      nameAr?: string | null;
      nameHe?: string | null;
      sortOrder?: number;
      dependsOnCodes?: string[] | null;
    };
    tasks?: ProductionTask[];
  }>;
  manufacturingCosting?: {
    status?: string | null;
    incomplete?: boolean;
    estimatedTotal?: number | null;
    actualTotal?: number | null;
    varianceCost?: number | null;
    variancePct?: number | null;
    scrapCost?: number | null;
    finalizedAt?: string | null;
  } | null;
};

export type RecommendBand = 'recommended' | 'busy' | 'conflict' | 'other';

export type WorkerOverlapWindow = {
  start: string;
  end: string;
  label: string;
};

export type WorkerDayWindow = {
  start: string;
  end: string;
  label: string;
  salesOrderNumber?: string | null;
  stage?: string | null;
};

export type AssignableWorker = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  username?: string | null;
  activeTaskCount?: number;
  recommendBand?: RecommendBand;
  recommendReason?: string | null;
  recommendReasonCode?: string | null;
  overlapWindows?: WorkerOverlapWindow[];
  /** All planned blocks on the assign day (time-based capacity). */
  dayWindows?: WorkerDayWindow[];
  suggestedWindow?: {
    plannedStart: string;
    plannedCompletion: string;
  } | null;
  department?: {
    id: string;
    code: string;
    nameEn: string;
    nameAr: string;
  } | null;
};

export async function getProductionSummary() {
  return apiGet<ProductionSummary>('/reports/production-summary');
}

export async function listProductionOrders(
  params: PageParams & {
    bucket?: ProductionListBucket;
    priority?: ProductionPriority | string;
    status?: string;
    q?: string;
    /** Dealer (customer) scope — matches API `customerId`. */
    customerId?: string;
    assignedEmployeeId?: string;
    /** Factory-local YYYY-MM-DD — view/filter only. */
    onDate?: string;
    dateMode?: ProductionDateMode;
  } = {},
) {
  const qs = toSearchParams({
    page: params.page,
    pageSize: params.pageSize,
    bucket: params.bucket === 'all' ? undefined : params.bucket,
    priority: params.priority,
    status: params.status,
    q: params.q,
    customerId: params.customerId,
    assignedEmployeeId: params.assignedEmployeeId,
    onDate: params.onDate,
    dateMode: params.dateMode,
  });
  return apiGet<PaginatedResponse<ProductionOrderListItem>>(`/production-orders${qs}`);
}

export async function getProductionDaySummary(params: {
  onDate?: string;
  dateMode?: ProductionDateMode;
  bucket?: ProductionListBucket;
  customerId?: string;
} = {}) {
  const qs = toSearchParams({
    onDate: params.onDate,
    dateMode: params.dateMode,
    bucket: params.bucket === 'all' ? undefined : params.bucket,
    customerId: params.customerId,
  });
  return apiGet<ProductionDaySummary>(`/production-orders/day-summary${qs}`);
}

export async function getProductionOrder(id: string) {
  return apiGet<ProductionOrderDetail>(`/production-orders/${encodeURIComponent(id)}`);
}

export async function startProductionOrder(
  id: string,
  body?: { plannedStartDate?: string },
) {
  return apiPost<ProductionOrderDetail>(
    `/production-orders/${encodeURIComponent(id)}/start`,
    body ?? {},
  );
}

/** Ready for Factory → Needs Planning: clear release, unlock plan; retain history server-side. */
export async function returnProductionOrderToPreparing(
  id: string,
  body?: { reason?: string },
) {
  return apiPost<ProductionOrderDetail>(
    `/production-orders/${encodeURIComponent(id)}/return-to-preparing`,
    body ?? {},
  );
}

/** Repair missing floor tasks from stage instances (legacy demos / partial releases). */
export async function ensureProductionPlanTasks(id: string) {
  return apiPost<{ created: number }>(
    `/production-orders/${encodeURIComponent(id)}/ensure-plan-tasks`,
  );
}

export type OrderPlanBomLine = {
  inventoryItemId?: string | null;
  sku: string;
  qty: number;
  exists: boolean;
  imageUrl?: string | null;
  nameEn?: string | null;
  nameAr?: string | null;
  nameHe?: string | null;
  unit?: string | null;
  category?: string | null;
  source?: string;
  needsReview?: boolean;
  unitCost?: number | null;
};

export type OrderPlanSetupTask = {
  id: string;
  number: string;
  name: string;
  status: string;
  assignedEmployeeId?: string | null;
  plannedStart?: string | null;
  plannedCompletion?: string | null;
  /** Worker-facing instructions for this task (shown on the worker portal). */
  notes?: string | null;
  stageDefinitionId?: string | null;
  stageDefinition?: {
    id?: string;
    code?: string;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
    responsibleDepartment?: string | null;
  } | null;
  assigneeName?: string | null;
};

export type OrderPlanSetupResponse = {
  productionOrderId: string;
  salesOrderId: string | null;
  salesOrderLineId: string | null;
  planEditable: boolean;
  factoryReleased: boolean;
  plannedStartDate?: string | null;
  requiredDeliveryDate?: string | null;
  committedDeliveryDate?: string | null;
  product?: {
    id: string;
    sku?: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
    imageUrl?: string | null;
  } | null;
  salesOrder?: {
    id: string;
    number: string;
    customer?: {
      id: string;
      name?: string | null;
      nameEn?: string | null;
      nameAr?: string | null;
      nameHe?: string | null;
    } | null;
  } | null;
  workflow: {
    id: string;
    code?: string;
    nameEn: string;
    nameAr: string;
    nameHe?: string | null;
  } | null;
  bomLines: OrderPlanBomLine[];
  stages: ProductionSetupStage[];
  warehouses: Array<{
    id: string;
    nameEn: string;
    nameAr: string;
    nameHe?: string | null;
    type: string;
    isDefault: boolean;
  }>;
  tasks: OrderPlanSetupTask[];
  readiness: {
    hasWorkflow: boolean;
    hasMaterials: boolean;
    hasExecutableTasks?: boolean;
    hasProductionStart?: boolean;
    assignment: { required: number; assigned: number; missing: string[] };
    dates?: { required: number; ready: number; missing: string[] };
    canConfirm: boolean;
  };
};

export async function getOrderPlanSetup(productionOrderId: string) {
  return apiGet<OrderPlanSetupResponse>(
    `/production-orders/${encodeURIComponent(productionOrderId)}/plan-setup`,
  );
}

export async function putOrderPlanSetup(
  productionOrderId: string,
  body: {
    workflowId?: string | null;
    bomLines?: Array<{
      inventoryItemId?: string | null;
      sku?: string | null;
      displayName?: string | null;
      category?: string | null;
      unit?: string;
      expectedQty: number;
      source?: 'CATALOG' | 'FACTORY_MODIFIED' | 'CUSTOM';
      needsReview?: boolean;
    }>;
    stages?: Array<{
      workflowNodeId: string;
      stageDefinitionId: string;
      behavior: ProductionSetupBehavior;
      consumesRawMaterials?: boolean;
      consumesSemiFinished?: boolean;
      outputNameEn?: string | null;
      outputNameAr?: string | null;
      outputNameHe?: string | null;
      outputQtyPerUnit?: number | null;
      expectedPieceCount?: number | null;
      pieceLabels?: Array<{ nameEn: string; nameAr?: string | null; nameHe?: string | null }> | null;
      defaultWarehouseId?: string | null;
      consumeOutputIds?: string[];
      consumeWorkflowNodeIds?: string[];
      materialInputs?: Array<{
        sku: string;
        qtyPerUnit: number;
        unit?: string;
        inventoryItemId?: string | null;
      }>;
    }>;
  },
) {
  return apiPut<OrderPlanSetupResponse>(
    `/production-orders/${encodeURIComponent(productionOrderId)}/plan-setup`,
    body,
  );
}

export async function updateProductionOrder(
  id: string,
  body: {
    priority?: ProductionPriority | string;
    requiredDeliveryDate?: string;
    plannedStartDate?: string;
    plannedCompletionDate?: string;
    notes?: string;
  },
) {
  return apiPatch<ProductionOrderDetail>(
    `/production-orders/${encodeURIComponent(id)}`,
    body,
  );
}

/** Save production start date and run smart scheduling for task windows. */
export async function suggestPlanSchedule(
  id: string,
  body: { plannedStartDate: string },
) {
  return apiPost<ProductionOrderDetail>(
    `/production-orders/${encodeURIComponent(id)}/suggest-plan-schedule`,
    body,
  );
}

export async function listAssignableWorkers(
  q?: string,
  stageDefinitionId?: string,
  opts?: {
    taskId?: string;
    plannedStart?: string;
    plannedCompletion?: string;
  },
) {
  const qs = toSearchParams({
    q,
    stageDefinitionId,
    taskId: opts?.taskId,
    plannedStart: opts?.plannedStart,
    plannedCompletion: opts?.plannedCompletion,
  });
  return apiGet<AssignableWorker[]>(`/production-orders/assignable-workers${qs}`);
}

export async function assignTask(
  taskId: string,
  body: {
    employeeId: string;
    priority?: ProductionPriority | string;
    plannedStart?: string;
    plannedCompletion?: string;
    estimatedMinutes?: number;
    overrideConflict?: boolean;
  },
) {
  return apiPost(`/tasks/${encodeURIComponent(taskId)}/assign`, body);
}

export async function unblockTask(taskId: string) {
  return apiPost(`/tasks/${encodeURIComponent(taskId)}/unblock`);
}

export async function blockProductionTask(
  taskId: string,
  body: { category: string; reason: string },
) {
  return apiPost(`/tasks/${encodeURIComponent(taskId)}/block`, body);
}

export async function pauseProductionTask(taskId: string) {
  return apiPost(`/tasks/${encodeURIComponent(taskId)}/pause`);
}

export async function updateProductionTaskNotes(taskId: string, notes: string) {
  return apiPatch(`/tasks/${encodeURIComponent(taskId)}/notes`, { notes });
}

export type ProductionMaterialLine = {
  inventoryItem: {
    id: string;
    sku: string;
    nameEn: string;
    nameAr: string;
    nameHe?: string | null;
    unit: string;
    imageUrl?: string | null;
  };
  issuedQty: number;
  returnedQty: number;
  returnableQty: number;
  warehouseId: string | null;
};

export type ProductionMaterialTransaction = {
  id: string;
  number: string;
  type: string;
  quantity: number;
  createdAt: string;
  notes?: string | null;
  inventoryItem: {
    id: string;
    sku: string;
    nameEn: string;
    nameAr: string;
    nameHe?: string | null;
    unit: string;
    imageUrl?: string | null;
  };
  warehouse: {
    id: string;
    code: string;
    nameEn: string;
    nameAr: string;
    nameHe?: string | null;
    type: string;
  } | null;
};

export type ProductionMaterialsActivity = {
  materials: ProductionMaterialLine[];
  transactions: ProductionMaterialTransaction[];
};

export type ProductionMaterialUsageStatus =
  | 'ON_TARGET'
  | 'OVER'
  | 'UNDER'
  | 'EXTRA'
  | 'UNUSED';

export type ProductionMaterialUsageLine = {
  inventoryItemId: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  unit: string;
  imageUrl?: string | null;
  itemClass?: string | null;
  assignedQty: number;
  usedQty: number;
  returnedQty: number;
  scrapQty: number;
  varianceQty: number;
  status: ProductionMaterialUsageStatus;
  isExtra?: boolean;
  tasks?: Array<{
    taskId: string;
    taskNumber: string;
    stageCode?: string | null;
    stageNameEn?: string | null;
    stageNameAr?: string | null;
    stageNameHe?: string | null;
    actualQty: number;
    expectedQty: number;
    returnedQty?: number;
    issueWarehouse?: {
      id: string;
      code: string;
      nameEn: string;
      nameAr: string;
      nameHe?: string | null;
    } | null;
    returnWarehouse?: {
      id: string;
      code: string;
      nameEn: string;
      nameAr: string;
      nameHe?: string | null;
    } | null;
    /** Proven recorder — omit attribution in UI when null. */
    recordedBy?: {
      id: string;
      firstName: string;
      lastName: string;
    } | null;
    /** Proven task assignee — omit when null. */
    assignedEmployee?: {
      id: string;
      firstName: string;
      lastName: string;
    } | null;
    recordedAt?: string | null;
  }>;
};

export async function getProductionOrderMaterialUsage(id: string) {
  return apiGet<{ materials: ProductionMaterialUsageLine[] }>(
    `/production-orders/${encodeURIComponent(id)}/material-usage`,
  );
}

export async function getProductionOrderMaterials(id: string) {
  return apiGet<ProductionMaterialsActivity>(
    `/production-orders/${encodeURIComponent(id)}/materials`,
  );
}

export async function returnProductionUnusedMaterial(
  id: string,
  body: { inventoryItemId: string; quantity: number; idempotencyKey?: string },
) {
  return apiPost(`/production-orders/${encodeURIComponent(id)}/materials/return`, body);
}
