import type { PaginatedResponse } from '@maher/types';
import { apiDelete, apiGet, apiPost, apiPatch, apiPut } from '../client';
import { toSearchParams, type PageParams } from '../pagination';

export type TaskStatus =
  | 'NOT_STARTED'
  | 'READY'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'BLOCKED'
  | 'READY_FOR_INSPECTION'
  | 'COMPLETED'
  | 'CANCELLED';

export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type TaskBlockerCategory =
  | 'MATERIAL_MISSING'
  | 'MATERIAL_DEFECT'
  | 'MACHINE_PROBLEM'
  | 'MEASUREMENT_ISSUE'
  | 'DESIGN_ISSUE'
  | 'PREVIOUS_STAGE_DEFECT'
  | 'STAFFING'
  | 'SAFETY'
  | 'OTHER';

export type TaskFile = {
  id: string;
  fileName: string;
  mimeType?: string | null;
  category?: string | null;
  createdAt: string;
  downloadPath?: string;
};

export type TaskTimingSummary = {
  status: 'running' | 'stopped' | 'idle' | 'done';
  actualMinutes: number;
  /** Closed sessions in whole seconds when the API can compute them. */
  actualSeconds?: number;
  openStartedAt: string | null;
  estimatedMinutes: number | null;
  plannedCompletion: string | null;
  /** Scheduler allocation start, when this task has been scheduled. */
  plannedStart?: string | null;
  elapsedMinutes: number;
};

export type TaskListItem = {
  id: string;
  number: string;
  name: string;
  description?: string | null;
  status: TaskStatus | string;
  priority: TaskPriority | string;
  plannedCompletion?: string | null;
  /** Scheduler allocation start, when this task has been scheduled. */
  plannedStart?: string | null;
  estimatedMinutes?: number | null;
  actualMinutes?: number | null;
  timing?: TaskTimingSummary;
  productImageUrl?: string | null;
  /** Product hero + gallery (task detail). */
  productImageUrls?: string[] | null;
  factoryOrderNumber?: string | null;
  salesOrderNumber?: string | null;
  /** Piece 8 floor enrichment when list API provides it. */
  floorHint?: FloorTaskHint | null;
  needsWipReceive?: boolean | null;
  /** Piece 9 — rework task created from QC fail. */
  isRework?: boolean;
  productionOrder?: {
    id: string;
    number: string;
    productDescription?: string | null;
      product?: {
      id?: string;
      imageUrl?: string | null;
      galleryUrls?: string[] | null;
      nameEn?: string | null;
      nameAr?: string | null;
      nameHe?: string | null;
    } | null;
    salesOrder?: { id: string; number: string } | null;
  };
  stageDefinition?: {
    id?: string;
    code?: string;
    nameEn?: string;
    nameAr?: string | null;
    nameHe?: string | null;
    requiresPhotos?: boolean;
    /** PRODUCTION | QUALITY | LOGISTICS */
    executionKind?: string | null;
  } | null;
  blockers?: Array<{ id: string; reason: string; resolvedAt?: string | null }>;
};

export type TaskDetail = TaskListItem & {
  notes?: string | null;
  photos?: TaskFile[];
  attachments?: TaskFile[];
  productionOrder?: TaskListItem['productionOrder'] & {
    id: string;
    quantity?: string | number | null;
    specifications?: string | null;
  };
  stageDefinition?: TaskListItem['stageDefinition'] & {
    dependsOnCodes?: string[];
    requiresPhotos?: boolean;
    executionKind?: string | null;
  };
  /** Snapshot: stage produces semi-finished WIP kit pieces. */
  producesSemiFinished?: boolean;
  /** Soft target piece count from workflow snapshot (produce-semi only). */
  expectedPieceCount?: number | null;
  /** Prefer snapshot requiresPhotos when present on detail payload. */
  requiresPhotos?: boolean;
  isRework?: boolean;
};

export type TaskListFilters = PageParams & {
  status?: TaskStatus | string;
  scope?: 'open' | 'completed' | 'all';
  dueToday?: boolean;
  mine?: boolean;
  q?: string;
  customerId?: string;
  completedFrom?: string;
  completedTo?: string;
};

export type CompletedDealerOption = {
  id: string;
  code: string;
  name: string;
  nameEn?: string | null;
  nameAr?: string | null;
  nameHe?: string | null;
};

export async function listTasks(filters: TaskListFilters = {}) {
  const qs = toSearchParams(filters);
  return apiGet<PaginatedResponse<TaskListItem>>(`/tasks${qs}`);
}

export async function listCompletedDealers() {
  return apiGet<{ data: CompletedDealerOption[] }>('/tasks/completed-dealers');
}

export async function getTask(id: string) {
  return apiGet<TaskDetail>(`/tasks/${encodeURIComponent(id)}`);
}

export async function startTask(id: string) {
  return apiPost<TaskDetail>(`/tasks/${encodeURIComponent(id)}/start`);
}

export async function pauseTask(id: string) {
  return apiPost<TaskDetail>(`/tasks/${encodeURIComponent(id)}/pause`);
}

export async function resumeTask(id: string) {
  return apiPost<TaskDetail>(`/tasks/${encodeURIComponent(id)}/resume`);
}

export async function completeTask(
  id: string,
  body: {
    notes?: string;
    photoDocumentIds?: string[];
    idempotencyKey?: string;
    qtyDelta?: number;
    /** Piece 9 — packaging expected labels the worker confirmed (manual N of N). */
    confirmedPackageLabels?: string[];
    packagingProblem?: boolean;
  } = {},
) {
  return apiPost<TaskDetail>(`/tasks/${encodeURIComponent(id)}/complete`, body);
}

export type TaskMaterialUsageWarehouse = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  availableQty?: number;
  isDefault?: boolean;
};

export type TaskMaterialUsageLine = {
  id: string;
  inventoryItemId: string;
  sku: string;
  expectedQty: number | string;
  actualQty?: number | string | null;
  returnedQty?: number | string;
  scrapQty?: number | string;
  varianceQty?: number | string | null;
  scrapReason?: string | null;
  reasonNotes?: string | null;
  isExtra?: boolean;
  issueWarehouseId?: string | null;
  returnWarehouseId?: string | null;
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
  warehouses?: TaskMaterialUsageWarehouse[];
  finalizedAt?: string | null;
  inventoryItem?: {
    id: string;
    sku: string;
    nameEn: string;
    nameAr: string;
    nameHe?: string | null;
    unit?: string;
    imageUrl?: string | null;
    itemClass?: string | null;
  } | null;
};

export type TaskMaterialIdentifyResult =
  | {
      status: 'MATCH';
      inventoryItemId: string;
      sku: string;
      nameEn: string;
      nameAr: string;
      nameHe: string | null;
      imageUrl: string | null;
      unit: string;
      expectedQty: number;
      actualQty: number | null;
      returnedQty: number;
      scrapQty: number;
      usageId: string | null;
    }
  | {
      status: 'WRONG';
      scannedSku: string;
      scannedNameEn: string;
      scannedNameAr: string;
      expectedSkus: string[];
    }
  | {
      status: 'EXTRA';
      inventoryItemId: string;
      sku: string;
      nameEn: string;
      nameAr: string;
      nameHe: string | null;
      imageUrl: string | null;
      unit: string;
      message: string;
    }
  | { status: 'NOT_FOUND'; code: string };

export async function listTaskMaterialUsage(id: string) {
  return apiGet<TaskMaterialUsageLine[]>(
    `/tasks/${encodeURIComponent(id)}/material-usage`,
  );
}

export async function identifyTaskMaterial(id: string, code: string) {
  return apiPost<TaskMaterialIdentifyResult>(
    `/tasks/${encodeURIComponent(id)}/material-usage/identify`,
    { code },
  );
}

export async function saveTaskMaterialUsage(
  id: string,
  lines: Array<{
    inventoryItemId: string;
    actualQty: number;
    returnedQty?: number;
    scrapQty?: number;
    scrapReason?: string | null;
    reasonNotes?: string | null;
    isExtra?: boolean;
    sku?: string;
    issueWarehouseId?: string | null;
    returnWarehouseId?: string | null;
  }>,
) {
  return apiPut<TaskMaterialUsageLine[]>(
    `/tasks/${encodeURIComponent(id)}/material-usage`,
    { lines },
  );
}

export async function blockTask(
  id: string,
  body: { category: TaskBlockerCategory; reason: string; idempotencyKey?: string },
) {
  return apiPost<TaskDetail>(`/tasks/${encodeURIComponent(id)}/block`, body);
}

export async function updateTaskNotes(
  id: string,
  notes: string,
  idempotencyKey?: string,
) {
  return apiPatch<TaskDetail>(`/tasks/${encodeURIComponent(id)}/notes`, {
    notes,
    ...(idempotencyKey ? { idempotencyKey } : {}),
  });
}

export type WipClaimRequirements = {
  required: boolean;
  allClaimed?: boolean;
  allReceived?: boolean;
  kits: Array<{ id: string; qrCode: string; status: string }>;
  unclaimed: Array<{ id: string; qrCode: string; status: string }>;
  lines?: WipIncomingLine[];
};

export type WipIncomingStatusKey =
  | 'WAITING_PRODUCTION'
  | 'READY_TO_COLLECT'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED';

export type WipIncomingLine = {
  predecessorSnapshotNodeId: string | null;
  predecessorStageInstanceId: string | null;
  fromStageCode: string;
  fromStageNameEn: string;
  fromStageNameAr: string;
  fromStageNameHe: string | null;
  kitId: string | null;
  qrCode: string | null;
  kitStatus: string | null;
  expected: number;
  produced: number;
  available: number;
  received: number;
  outstanding: number;
  statusKey: WipIncomingStatusKey;
  outputNameEn?: string | null;
  outputNameAr?: string | null;
  outputNameHe?: string | null;
  thumbDocumentId?: string | null;
  productionOrderNumber?: string | null;
  salesOrderNumber?: string | null;
  yourStageCode?: string | null;
  yourStageNameEn?: string | null;
  yourStageNameAr?: string | null;
  yourStageNameHe?: string | null;
};

export type FloorTaskPhase =
  | 'WAITING_PREVIOUS'
  | 'READY_TO_RECEIVE'
  | 'READY_TO_START'
  | 'IN_PROGRESS'
  | 'OUTPUT_READY'
  | 'COMPLETED'
  | 'ATTENTION';

export type FloorTaskPrimaryAction = 'RECEIVE_SEMI' | 'START' | 'COMPLETE' | 'NONE';

export type FloorTaskHint = {
  phase: FloorTaskPhase;
  labelKey: string;
  primaryAction: FloorTaskPrimaryAction;
};

export type WipIncomingLane = {
  fromStageCode: string;
  fromStageNameEn: string;
  fromStageNameAr: string | null;
  fromStageNameHe: string | null;
  statusKey: WipIncomingStatusKey;
  expected: number;
  received: number;
  produced: number;
  lines: WipIncomingLine[];
};

export type WipWhereHint = {
  kitId: string | null;
  fromStageCode: string;
  locationName: string | null;
};

export type WipDiscrepancyCategory =
  | 'MISSING_COMPONENT'
  | 'WRONG_COMPONENT'
  | 'DAMAGED'
  | 'QUANTITY_MISMATCH'
  | 'OTHER';

export type WipIncomingBoard = {
  required: boolean;
  allReceived: boolean;
  lines: WipIncomingLine[];
  lanes?: WipIncomingLane[];
  whereHints?: WipWhereHint[];
  floorHint?: FloorTaskHint;
  consumer?: {
    snapshotNodeId: string;
    stageCode: string;
    nameEn: string;
    nameAr: string;
    nameHe: string | null;
  };
};

export type WipEligibleKit = {
  kitId: string;
  qrCode: string | null;
  fromStageCode: string;
  fromStageNameEn: string;
  fromStageNameAr: string;
  fromStageNameHe: string | null;
  available: number;
  produced: number;
  received: number;
  status: string;
};

export async function getTaskWipClaimRequirements(taskId: string) {
  return apiGet<WipClaimRequirements>(
    `/tasks/${encodeURIComponent(taskId)}/wip-claim-requirements`,
  );
}

export async function getTaskWipIncoming(taskId: string) {
  return apiGet<WipIncomingBoard>(`/tasks/${encodeURIComponent(taskId)}/wip-incoming`);
}

export async function getTaskWipOutgoing(taskId: string) {
  return apiGet<{
    produces: boolean;
    kits: Array<{ id: string; qrCode: string; status: string; waitingPickup?: number }>;
  }>(`/tasks/${encodeURIComponent(taskId)}/wip-outgoing`);
}

export async function getTaskWipEligible(taskId: string) {
  return apiGet<{ kits: WipEligibleKit[] }>(
    `/tasks/${encodeURIComponent(taskId)}/wip-eligible`,
  );
}

export async function receiveTaskWip(
  taskId: string,
  body: { scanCode?: string; kitId?: string; quantity?: number; idempotencyKey?: string },
) {
  return apiPost(`/tasks/${encodeURIComponent(taskId)}/wip-receive`, body);
}

export async function reportTaskWipDiscrepancy(
  taskId: string,
  body: {
    category: WipDiscrepancyCategory;
    notes?: string;
    kitId?: string;
    predecessorStageCode?: string;
    idempotencyKey?: string;
  },
) {
  return apiPost(`/tasks/${encodeURIComponent(taskId)}/wip-discrepancy`, body);
}

export async function claimTaskWipKit(taskId: string, scanCode: string) {
  return apiPost(`/tasks/${encodeURIComponent(taskId)}/wip-claim`, { scanCode });
}

export type TaskWipOutputPiece = {
  id: string;
  sortOrder: number;
  label: string | null;
  qrCode: string | null;
  photoDocumentId: string | null;
  photoDocument?: {
    id: string;
    fileName: string;
    storageKey: string;
    mimeType?: string | null;
  } | null;
};

export type TaskWipOutput = {
  producesSemiFinished: boolean;
  expectedPieceCount: number;
  requiresPhotos: boolean;
  kitId: string | null;
  qrCode: string | null;
  status: string | null;
  completedPieceCount?: number;
  stageCode?: string | null;
  stageNameEn?: string | null;
  stageNameAr?: string | null;
  stageNameHe?: string | null;
  outputNameEn?: string | null;
  outputNameAr?: string | null;
  outputNameHe?: string | null;
  nextStages?: Array<{
    id: string;
    stageCode: string;
    nameEn: string;
    nameAr: string;
    nameHe: string | null;
  }>;
  pieces: TaskWipOutputPiece[];
};

export async function getTaskWipOutput(taskId: string) {
  return apiGet<TaskWipOutput>(`/tasks/${encodeURIComponent(taskId)}/wip-output`);
}

export async function addTaskWipPiece(
  taskId: string,
  body: { photoDocumentId: string; label?: string | null },
) {
  return apiPost<TaskWipOutput>(
    `/tasks/${encodeURIComponent(taskId)}/wip-output/pieces`,
    body,
  );
}

export async function updateTaskWipPiece(
  taskId: string,
  pieceId: string,
  body: { photoDocumentId?: string; label?: string | null },
) {
  return apiPatch<TaskWipOutput>(
    `/tasks/${encodeURIComponent(taskId)}/wip-output/pieces/${encodeURIComponent(pieceId)}`,
    body,
  );
}

export async function deleteTaskWipPiece(taskId: string, pieceId: string) {
  return apiDelete<TaskWipOutput>(
    `/tasks/${encodeURIComponent(taskId)}/wip-output/pieces/${encodeURIComponent(pieceId)}`,
  );
}
