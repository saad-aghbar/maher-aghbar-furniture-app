import type { PaginatedResponse } from '@maher/types';
import { apiGet, apiPatch, apiPost } from '../client';
import { toSearchParams, type PageParams } from '../pagination';

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
  } | null;
  salesOrder?: {
    id: string;
    number: string;
    externalOrderNumber?: string | null;
  } | null;
  currentStage?: {
    code: string;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
  } | null;
  readiness?: ProductionReadiness | null;
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
  });
  return apiGet<PaginatedResponse<ProductionOrderListItem>>(`/production-orders${qs}`);
}

export async function getProductionOrder(id: string) {
  return apiGet<ProductionOrderDetail>(`/production-orders/${encodeURIComponent(id)}`);
}

export async function startProductionOrder(id: string) {
  return apiPost<ProductionOrderDetail>(`/production-orders/${encodeURIComponent(id)}/start`);
}

/** Repair missing floor tasks from stage instances (legacy demos / partial releases). */
export async function ensureProductionPlanTasks(id: string) {
  return apiPost<{ created: number }>(
    `/production-orders/${encodeURIComponent(id)}/ensure-plan-tasks`,
  );
}

export async function updateProductionOrder(
  id: string,
  body: {
    priority?: ProductionPriority | string;
    requiredDeliveryDate?: string;
    plannedCompletionDate?: string;
    notes?: string;
  },
) {
  return apiPatch<ProductionOrderDetail>(
    `/production-orders/${encodeURIComponent(id)}`,
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
