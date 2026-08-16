import { apiDelete, apiGet, apiPatch, apiPost } from '../client';
import { toSearchParams } from '../pagination';

export type ScheduleEstimateStatus = 'UNAVAILABLE' | 'PRELIMINARY' | 'CALCULATED';
export type ScheduleEstimateConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

export type SchedulePromiseState =
  | 'ESTIMATED'
  | 'AWAITING_APPROVAL'
  | 'CONFIRMED'
  | 'AT_RISK'
  | 'LATE'
  | 'RESCHEDULED'
  | 'COMPLETED';

export type ScheduleStatus =
  | 'DRAFT'
  | 'PROPOSED'
  | 'APPROVED'
  | 'SUPERSEDED'
  | 'CANCELLED'
  | 'NEEDS_REVIEW'
  | 'PROVISIONAL';

export type DealerChangeAction = 'canUpdateDirect' | 'canChangeRequest' | 'locked';

export type AvailabilityItemInput = {
  productId: string;
  quantity: number;
  customSpecifications?: string;
};

export type AvailabilityRequest = {
  items: AvailabilityItemInput[];
  /** ISO date the dealer wants delivery by. */
  requestedDeliveryDate?: string;
  /** Admin-only: check availability on behalf of a specific dealer. */
  customerId?: string;
};

export type AvailabilityResult = {
  estimateStatus: ScheduleEstimateStatus;
  earliestAvailableDate: string | null;
  requestedDateFeasible: boolean;
  suggestedDeliveryDate: string | null;
  /** Up to a few candidate dates (ISO) further out than the earliest date. */
  alternativeDates: string[];
  estimateConfidence: ScheduleEstimateConfidence;
  requiresAdminEstimateReview: boolean;
};

/** Dealer-safe check for whether items can be delivered by a target date. */
export async function postAvailability(body: AvailabilityRequest): Promise<AvailabilityResult> {
  return apiPost<AvailabilityResult>('/scheduling/availability', body);
}

export type ScheduleAllocationSummary = {
  id: string;
  productionTaskId?: string | null;
  task?: { id: string; name?: string | null; number?: string | null; status?: string | null } | null;
  resourceType?: string | null;
  employee?: { id: string; firstName?: string | null; lastName?: string | null } | null;
  department?: { id: string; code?: string | null; nameEn?: string | null; nameAr?: string | null } | null;
  plannedStart: string;
  plannedEnd: string;
  estimatedMinutes: number;
  isPinned?: boolean | null;
  manuallyAdjusted?: boolean | null;
};

/** Latest ProductionSchedule snapshot for an order, as returned by GET /scheduling/orders/:id. */
export type ProductionScheduleSnapshot = {
  id: string;
  version: number;
  status: ScheduleStatus | string;
  promiseState: SchedulePromiseState | string;
  requestedDeliveryDate?: string | null;
  earliestAvailableDate?: string | null;
  suggestedDeliveryDate?: string | null;
  committedCompletionDate?: string | null;
  committedDeliveryDate?: string | null;
  reason?: string | null;
  generatedAt?: string | null;
  approvedAt?: string | null;
  approvedById?: string | null;
  materialRisk?: boolean | null;
  requiresAdminEstimateReview?: boolean | null;
  estimateConfidence?: string | null;
  allocations: ScheduleAllocationSummary[];
  requestedDateFeasible?: boolean | null;
  planningMode?: string | null;
  unschedulableReason?: string | null;
  materialReadyAt?: string | null;
  productionDeadline?: string | null;
  deliveryBufferWorkingDays?: number | null;
};

export type CanonicalRiskStatus = 'LATE' | 'AT_RISK' | 'BLOCKED' | 'AWAITING_APPROVAL' | 'ON_TRACK';

/** Admin — GET /scheduling/orders/:productionOrderId */
export type ProductionScheduleDetail = {
  productionOrder: {
    id: string;
    number: string;
    status: string;
    requiredDeliveryDate?: string | null;
    committedDeliveryDate?: string | null;
    priority?: string | null;
    customerId?: string | null;
  };
  /** Order-level promise state, computed even when no schedule exists yet. */
  promiseState: SchedulePromiseState | string;
  riskStatus?: CanonicalRiskStatus | string;
  stillAtRisk?: boolean;
  planUnchanged?: boolean;
  schedule: ProductionScheduleSnapshot | null;
};

/** Dealer-safe — GET /scheduling/orders/:productionOrderId (own order). */
export type CustomerDeliveryStatus =
  | 'AWAITING_CONFIRMATION'
  | 'CONFIRMED_ON_TRACK'
  | 'IN_PRODUCTION'
  | 'READY_FOR_DELIVERY'
  | 'OUT_FOR_DELIVERY'
  | 'MAY_BE_DELAYED'
  | 'DELAYED'
  | 'DELIVERED'
  | 'CANCELLED';

export type OwnOrderSchedule = {
  productionOrderId: string;
  salesOrderId?: string | null;
  number: string;
  promiseState: SchedulePromiseState | string;
  requestedDeliveryDate: string | null;
  suggestedDeliveryDate: string | null;
  committedDeliveryDate: string | null;
  projectedDeliveryDate?: string | null;
  actualDeliveryDate?: string | null;
  calendarDate?: string | null;
  customerStatus?: CustomerDeliveryStatus | string;
  requiresDealerAttention?: boolean;
  customerSafeReason?: string | null;
  compactDates?: boolean;
  delayDays?: number | null;
  canUpdateDeliveryDate: boolean;
  canRequestDateChange: boolean;
  dateChangeLocked: boolean;
  dateChangeReason: string;
};

export type DealerDeliveryDto = {
  salesOrderId: string;
  salesOrderNumber: string;
  productionOrderId: string | null;
  productionOrderNumber: string | null;
  productName: {
    name: string;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
  };
  imageUrl?: string | null;
  quantity?: number | null;
  deliveryAddress?: string | null;
  requestedDeliveryDate: string | null;
  suggestedDeliveryDate: string | null;
  committedDeliveryDate: string | null;
  projectedDeliveryDate: string | null;
  actualDeliveryDate: string | null;
  calendarDate: string | null;
  customerStatus: CustomerDeliveryStatus | string;
  requiresDealerAttention: boolean;
  customerSafeReason: string | null;
  compactDates: boolean;
  delayDays: number | null;
  canUpdateDeliveryDate: boolean;
  canRequestDateChange: boolean;
  dateChangeLocked: boolean;
  dateChangeReason: string;
};

export type OwnDeliveriesResponse = {
  summary: {
    upcoming: number;
    thisWeek: number;
    awaitingConfirmation: number;
    mayBeDelayed: number;
  };
  data: DealerDeliveryDto[];
  todayYmd?: string;
};

export async function getOwnDeliveries(params?: {
  from?: string;
  to?: string;
}): Promise<OwnDeliveriesResponse> {
  const qs = toSearchParams({
    ...(params?.from ? { from: params.from } : {}),
    ...(params?.to ? { to: params.to } : {}),
  });
  return apiGet(`/scheduling/own-deliveries${qs}`);
}

export async function getOrderSchedule(
  productionOrderId: string,
): Promise<ProductionScheduleDetail | OwnOrderSchedule> {
  return apiGet(`/scheduling/orders/${encodeURIComponent(productionOrderId)}`);
}

/** True when the response is the dealer-safe shape (no factory internals). */
export function isOwnOrderSchedule(
  value: ProductionScheduleDetail | OwnOrderSchedule,
): value is OwnOrderSchedule {
  return typeof (value as OwnOrderSchedule).canUpdateDeliveryDate === 'boolean';
}

export async function approveSchedule(
  productionOrderId: string,
  body: { version: number; idempotencyKey?: string },
): Promise<ProductionScheduleDetail> {
  return apiPost<ProductionScheduleDetail>(
    `/scheduling/orders/${encodeURIComponent(productionOrderId)}/approve`,
    body,
  );
}

export async function recalculateSchedule(
  productionOrderId: string,
  body: { mode?: 'forward' | 'backward'; reason?: string } = {},
): Promise<ProductionScheduleDetail> {
  return apiPost<ProductionScheduleDetail>(
    `/scheduling/orders/${encodeURIComponent(productionOrderId)}/recalculate`,
    body,
  );
}

export type DealerDateChangeResult = {
  ok: true;
  action: 'updated' | 'requested';
};

export async function dealerDateChange(
  productionOrderId: string,
  body: { requestedDeliveryDate: string; reason?: string; idempotencyKey?: string },
): Promise<DealerDateChangeResult> {
  return apiPost<DealerDateChangeResult>(
    `/scheduling/orders/${encodeURIComponent(productionOrderId)}/dealer-date`,
    body,
  );
}

export type SchedulingDashboard = {
  awaitingApproval: number;
  needsReview: number;
  approvedActive: number;
  atRisk: number;
  conflicts: number;
  todayCount: number;
  weekCount: number;
  approvalsWaiting: number;
  alerts: number;
};

export async function getDashboard(): Promise<SchedulingDashboard> {
  return apiGet<SchedulingDashboard>('/scheduling/dashboard');
}

export type AtRiskRecommendedAction =
  | 'RECALCULATE'
  | 'REVIEW_ESTIMATES'
  | 'VIEW_PRODUCTION'
  | 'MANAGE_WORKERS'
  | 'REVIEW_COMMITMENT'
  | 'VIEW_MATERIALS'
  | 'NONE';

export type AtRiskOrder = {
  productionOrderId: string;
  number: string;
  status: string;
  priority: string;
  scheduleStatus: string;
  scheduleVersion?: number | null;
  version?: number | null;
  reason: string | null;
  materialRisk: boolean;
  requiresAdminEstimateReview: boolean;
  requiredDeliveryDate: string | null;
  requestedDeliveryDate?: string | null;
  committedDeliveryDate?: string | null;
  suggestedDeliveryDate: string | null;
  earliestAvailableDate?: string | null;
  projectedCompletion?: string | null;
  requestedDateFeasible?: boolean | null;
  unschedulableReason?: string | null;
  planningMode?: string | null;
  materialReadyAt?: string | null;
  committedCompletionDate?: string | null;
  productionDeadline?: string | null;
  deliveryBufferWorkingDays?: number | null;
  productId?: string | null;
  productName?: string | null;
  productNameAr?: string | null;
  productNameHe?: string | null;
  imageUrl?: string | null;
  dealerName?: string | null;
  dealerNameAr?: string | null;
  dealerNameHe?: string | null;
  riskStatus?: CanonicalRiskStatus | string | null;
  reasonCode?: string | null;
  reasonCodes?: string[];
  reasonLabel?: string | null;
  recoverableAutomatically?: boolean;
  recommendedAction?: AtRiskRecommendedAction | string | null;
  earliestFeasibleDate?: string | null;
  stageId?: string | null;
  stageName?: string | null;
  requiredWip?: string | null;
  producedBy?: string | null;
  currentStage?: string | null;
  missingMaterial?: string | null;
  stageAtCapacity?: string | null;
  earliestSlot?: string | null;
};

export async function getAtRisk(): Promise<{ data: AtRiskOrder[] }> {
  return apiGet<{ data: AtRiskOrder[] }>('/scheduling/at-risk');
}

export type ResolveAtRiskResult = {
  productionOrderId: string;
  number?: string;
  action: string;
  riskStatus?: CanonicalRiskStatus | string;
  reasonCode?: string | null;
  reasonLabel?: string | null;
  recommendedAction?: AtRiskRecommendedAction | string | null;
  recoverableAutomatically?: boolean;
  earliestFeasibleDate?: string | null;
  stillAtRisk?: boolean;
  resolvedAutomatically: boolean;
  stillNeedsAttention: boolean;
  alreadyOnTrack?: boolean;
  code?: string;
  beforeRiskStatus?: string;
};

export type ResolveAllAtRiskResult = {
  resolvedAutomatically: number;
  stillNeedsAttention: number;
  alreadyOnTrack: number;
  remaining: number;
  results: ResolveAtRiskResult[];
};

export async function resolveAtRisk(productionOrderId: string): Promise<ResolveAtRiskResult> {
  return apiPost<ResolveAtRiskResult>(
    `/scheduling/at-risk/${encodeURIComponent(productionOrderId)}/resolve`,
    {},
    { timeoutMs: 90_000 },
  );
}

export async function resolveAllAtRisk(): Promise<ResolveAllAtRiskResult> {
  return apiPost<ResolveAllAtRiskResult>('/scheduling/at-risk/resolve-all', {}, { timeoutMs: 90_000 });
}

export type CapacityWorkerRow = {
  employeeId: string;
  firstName?: string | null;
  lastName?: string | null;
  eligible?: boolean;
  availableMinutes: number;
  allocatedMinutes: number;
  remainingMinutes: number;
};

export type CapacityRow = {
  departmentId: string;
  stageDefinitionId?: string;
  code: string;
  nameEn: string;
  nameAr?: string | null;
  nameHe?: string | null;
  bookedMinutes: number;
  capacityMinutes: number;
  allocatedMinutes?: number;
  availableMinutes?: number;
  remainingMinutes?: number;
  eligibleWorkerCount: number;
  workers?: CapacityWorkerRow[];
  ineligibleWorkers?: CapacityWorkerRow[];
  unassignedAllocatedMinutes?: number;
};

export type CapacityDay = {
  date: string;
  isWorking: boolean;
  shiftMinutes: number;
  pinnedOnClosedDayCount?: number;
};

export type CapacityByDay = {
  date: string;
  isWorking: boolean;
  pinnedOnClosedDayCount?: number;
  data: CapacityRow[];
};

export type CapacityResponse = {
  from?: string;
  to?: string;
  data: CapacityRow[];
  days?: CapacityDay[];
  byDay?: CapacityByDay[];
};

export type CapacityQueryParams = {
  from: string;
  to: string;
  granularity?: 'day' | 'range';
  includeWorkers?: boolean;
};

/** Admin — GET /scheduling/capacity. Backend is authoritative; do not recompute hours on device. */
export async function getCapacity(params: CapacityQueryParams): Promise<CapacityResponse> {
  const qs = toSearchParams({
    from: params.from,
    to: params.to,
    granularity: params.granularity,
    includeWorkers: params.includeWorkers ? true : undefined,
  });
  return apiGet<CapacityResponse>(`/scheduling/capacity${qs}`);
}

export type ConflictSide = {
  allocationId: string;
  productionOrderId: string;
  orderNumber: string;
  productName: string | null;
  stageName: string | null;
  stageDefinitionId?: string | null;
  start: string;
  end: string;
  priority: string;
  requestedDeliveryDate: string | null;
  committedDeliveryDate: string | null;
  isPinned: boolean;
  taskStatus: string | null;
};

export type ScheduleConflict = {
  conflictId: string;
  type: string;
  worker: { id: string; name: string } | null;
  resource: { stageDefinitionId: string; stageName: string | null; slot: number } | null;
  overlapStart: string;
  overlapEnd: string;
  overlapMinutes: number;
  allocationA: ConflictSide;
  allocationB: ConflictSide;
};

export type ConflictsResponse = {
  data: ScheduleConflict[];
  count: number;
  affectedOrderCount: number;
};

/** Admin — GET /scheduling/conflicts. Unique active operational overlaps. */
export async function getConflicts(): Promise<ConflictsResponse> {
  return apiGet<ConflictsResponse>('/scheduling/conflicts');
}

export type ResolveConflictResult = {
  resolved: boolean;
  action: 'REASSIGNED' | 'RESCHEDULED' | 'ALREADY_RESOLVED';
  conflictId: string;
  affectedOrderIds: string[];
  updatedAllocations: Array<{
    allocationId: string;
    productionOrderId: string;
    employeeId: string;
    start: string;
    end: string;
  }>;
  remainingConflictCount: number;
  moved: {
    productionOrderId: string;
    orderNumber: string;
    employeeId: string;
    employeeName: string;
    start: string;
    end: string;
  } | null;
};

export async function resolveConflict(conflictId: string): Promise<ResolveConflictResult> {
  return apiPost<ResolveConflictResult>(
    '/scheduling/conflicts/resolve',
    { conflictId },
    { timeoutMs: 90_000 },
  );
}

export type ResolveAllConflictsResult = {
  resolvedCount: number;
  failedCount: number;
  alreadyResolvedCount: number;
  remainingConflictCount: number;
  results: Array<ResolveConflictResult | { resolved: false; conflictId: string; code: string }>;
};

export async function resolveAllConflicts(): Promise<ResolveAllConflictsResult> {
  return apiPost<ResolveAllConflictsResult>('/scheduling/conflicts/resolve-all', {}, { timeoutMs: 90_000 });
}

/** Order-level cards (PO#, product, dealer, planned window, status) for calendar views. */
export type ScheduleOrderCard = {
  id: string;
  productionOrderId: string;
  scheduleId?: string | null;
  version?: number | null;
  number: string;
  productName?: string | null;
  productNameAr?: string | null;
  productNameHe?: string | null;
  imageUrl?: string | null;
  dealerName?: string | null;
  dealerNameAr?: string | null;
  dealerNameHe?: string | null;
  quantity?: number | null;
  priority?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  status?: string | null;
  promiseState?: string | null;
  materialRisk?: boolean | null;
  hasConflict?: boolean | null;
  conflictReason?: string | null;
  requestedDeliveryDate?: string | null;
  suggestedDeliveryDate?: string | null;
  committedDeliveryDate?: string | null;
  earliestAvailableDate?: string | null;
  requestedDateFeasible?: boolean | null;
  unschedulableReason?: string | null;
  planningMode?: string | null;
  requiresAdminEstimateReview?: boolean | null;
  materialReadyAt?: string | null;
  committedCompletionDate?: string | null;
  productionDeadline?: string | null;
  deliveryBufferWorkingDays?: number | null;
};

export type CalendarDay = {
  date: string;
  isWorking: boolean;
  intervals: Array<{ start: string; end: string }>;
  pinnedOnClosedDayCount?: number;
};

export type CalendarResponse = {
  calendar: {
    shiftStart?: string;
    shiftEnd?: string;
    deliveryBufferWorkingDays?: number | null;
    exceptions?: Array<{
      date: string;
      type: string;
      shiftStart?: string | null;
      shiftEnd?: string | null;
    }>;
  } | unknown;
  days: CalendarDay[];
  orders: ScheduleOrderCard[];
};

export async function getCalendar(params: {
  from: string;
  to: string;
  view?: 'day' | 'week' | 'month';
}): Promise<CalendarResponse> {
  const qs = toSearchParams(params);
  return apiGet<CalendarResponse>(`/scheduling/calendar${qs}`);
}

export type CalendarExceptionType = 'HOLIDAY' | 'SHUTDOWN' | 'EXTRA_SHIFT';

export type CalendarExceptionInput = {
  date: string;
  type: CalendarExceptionType;
  shiftStart?: string;
  shiftEnd?: string;
  note?: string;
};

export type CalendarExceptionResult = {
  id?: string;
  date?: string;
  type?: CalendarExceptionType;
  deleted?: boolean;
  replanned?: number;
  calendarUpdated?: boolean;
  replanQueued?: boolean;
  replanJobId?: string;
};

/** Open day / overtime / close day — persists immediately and queues factory replan. */
export async function addCalendarException(
  body: CalendarExceptionInput,
): Promise<CalendarExceptionResult> {
  return apiPost<CalendarExceptionResult>('/scheduling/calendar-settings/exceptions', body, {
    timeoutMs: 90_000,
  });
}

/** Clear a day exception — persists immediately and queues factory replan. */
export async function deleteCalendarException(dateYmd: string): Promise<CalendarExceptionResult> {
  return apiDelete<CalendarExceptionResult>(
    `/scheduling/calendar-settings/exceptions/${encodeURIComponent(dateYmd)}`,
    undefined,
    { timeoutMs: 90_000 },
  );
}

export type ReplanRunStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export type ReplanRunResult = {
  capacityDelta?: 'increase' | 'decrease' | 'none';
  considered?: number;
  candidateOrders?: number;
  replannedOrders?: number;
  moved?: number;
  movedEarlier?: number;
  movedLater?: number;
  unchanged?: number;
  recoveredAtRisk?: number;
  atRiskResolved?: number;
  stillNeedsAttention?: number;
  pinnedIssueCount?: number;
  pinnedIssues?: Array<{ productionOrderId: string; allocationId: string; orderNumber: string; ymd: string }>;
  failures?: Array<{ productionOrderId: string; message: string }>;
};

export type ReplanRun = {
  id: string;
  status: ReplanRunStatus;
  changeType?: string;
  result?: ReplanRunResult | null;
  completedAt?: string | null;
};

export async function getReplanRun(id: string): Promise<ReplanRun> {
  return apiGet<ReplanRun>(`/scheduling/replan-runs/${encodeURIComponent(id)}`, {
    timeoutMs: 15_000,
  });
}

export type QuantityScalingMode =
  | 'LINEAR'
  | 'FIXED'
  | 'SETUP_PLUS_LINEAR'
  | 'BATCH'
  | 'PARALLEL_CAPACITY';

export type ProductProductionProfile = {
  productId: string;
  totalStandardMinutes?: number | null;
  setupMinutes?: number;
  complexityFactor?: number | string;
  defaultBatchSize?: number;
  minimumLeadTimeDays?: number | null;
  bufferPercent?: number;
  isSchedulingEnabled?: boolean;
};

export type ProductStageEstimate = {
  id?: string;
  productId?: string;
  stageDefinitionId: string;
  setupMinutes: number;
  minutesPerUnit: number;
  fixedMinutes: number;
  quantityScalingMode: QuantityScalingMode | string;
  workerCountRequired?: number;
  isRequired?: boolean;
  stageDefinition?: {
    id: string;
    code: string;
    nameEn: string;
    nameAr: string;
    nameHe?: string | null;
    sortOrder: number;
  };
};

export type ProductStageEstimateInput = {
  stageDefinitionId: string;
  setupMinutes?: number;
  minutesPerUnit?: number;
  fixedMinutes?: number;
  quantityScalingMode?: QuantityScalingMode;
  workerCountRequired?: number;
  isRequired?: boolean;
};

export async function getProductProductionProfile(
  productId: string,
): Promise<ProductProductionProfile> {
  return apiGet(`/scheduling/products/${encodeURIComponent(productId)}/production-profile`);
}

export async function patchProductProductionProfile(
  productId: string,
  body: Partial<ProductProductionProfile>,
): Promise<ProductProductionProfile> {
  return apiPatch(`/scheduling/products/${encodeURIComponent(productId)}/production-profile`, body);
}

export async function listProductStageEstimates(
  productId: string,
): Promise<ProductStageEstimate[]> {
  return apiGet(`/scheduling/products/${encodeURIComponent(productId)}/stage-estimates`);
}

export async function patchProductStageEstimates(
  productId: string,
  items: ProductStageEstimateInput[],
): Promise<ProductStageEstimate[]> {
  return apiPatch(`/scheduling/products/${encodeURIComponent(productId)}/stage-estimates`, {
    items,
  });
}

/** Qty=1 baseline minutes from a stage estimate row. */
export function stageEstimateMinutes(row: {
  quantityScalingMode?: string | null;
  setupMinutes?: number | null;
  minutesPerUnit?: number | null;
  fixedMinutes?: number | null;
}): number {
  const mode = row.quantityScalingMode ?? 'SETUP_PLUS_LINEAR';
  const setup = Number(row.setupMinutes ?? 0);
  const perUnit = Number(row.minutesPerUnit ?? 0);
  const fixed = Number(row.fixedMinutes ?? 0);
  if (mode === 'FIXED') return fixed;
  if (mode === 'LINEAR') return perUnit;
  if (fixed > 0 && setup === 0 && perUnit === 0) return fixed;
  return setup + perUnit;
}
