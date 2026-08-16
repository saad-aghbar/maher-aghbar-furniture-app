/** Shared pure-domain types for the finite-capacity scheduler. */

export type QuantityScalingMode =
  | 'LINEAR'
  | 'FIXED'
  | 'SETUP_PLUS_LINEAR'
  | 'BATCH'
  | 'PARALLEL_CAPACITY';

export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type ScheduleStatus =
  | 'DRAFT'
  | 'PROPOSED'
  | 'APPROVED'
  | 'SUPERSEDED'
  | 'CANCELLED'
  | 'NEEDS_REVIEW'
  | 'PROVISIONAL';

export type SchedulePromiseState =
  | 'ESTIMATED'
  | 'AWAITING_APPROVAL'
  | 'CONFIRMED'
  | 'AT_RISK'
  | 'LATE'
  | 'RESCHEDULED'
  | 'COMPLETED';

export type ProductionOrderStatus =
  | 'DRAFT'
  | 'PLANNED'
  | 'WAITING_FOR_MATERIALS'
  | 'READY'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'QUALITY_CHECK'
  | 'READY_FOR_PACKAGING'
  | 'READY_FOR_DELIVERY'
  | 'COMPLETED'
  | 'CANCELLED';

export type FactoryCalendarExceptionType = 'HOLIDAY' | 'SHUTDOWN' | 'EXTRA_SHIFT';

export type ValidationSeverity = 'VALID' | 'WARNING' | 'CONFLICT';

export type ScheduleResourceType = 'EMPLOYEE' | 'DEPARTMENT';

export type SchedulingResourceMode = 'WORKER_CONSTRAINED' | 'RESOURCE_CONSTRAINED';

export type SchedulePlanningMode = 'FORWARD' | 'BACKWARD' | 'BACKWARD_FALLBACK_FORWARD';

export type DealerChangeAction = 'canUpdateDirect' | 'canChangeRequest' | 'locked';

export interface TimeOfDayRange {
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

export interface CalendarExceptionInput {
  /** Calendar date (UTC midnight or any instant on that local day). */
  date: Date;
  type: FactoryCalendarExceptionType;
  shiftStart?: string | null;
  shiftEnd?: string | null;
  note?: string | null;
}

export interface FactoryCalendarInput {
  timezone: string;
  /** 0=Sunday .. 6=Saturday */
  workingWeekdays: number[];
  shiftStart: string;
  shiftEnd: string;
  breaks?: TimeOfDayRange[] | null;
  exceptions?: CalendarExceptionInput[];
}

export interface DurationEstimateInput {
  quantityScalingMode: QuantityScalingMode;
  quantity: number;
  setupMinutes?: number;
  minutesPerUnit?: number;
  fixedMinutes?: number;
  batchSize?: number | null;
  batchMinutes?: number | null;
  maxParallelUnits?: number | null;
}

export interface StageGraphNode {
  code: string;
  dependsOnCodes: string[];
  id?: string;
}

export interface OccupancyInterval {
  employeeId: string;
  start: Date;
  end: Date;
  allocationId?: string;
  productionOrderId?: string;
}

export interface WorkerCandidate {
  id: string;
  isActive: boolean;
  departmentCode: string | null;
  /** Stage definition ids the worker is skilled for. Empty/undefined = no skill filter required. */
  skillStageDefinitionIds?: string[];
  /** Optional precomputed load in minutes for least-loaded selection. */
  loadedMinutes?: number;
}

export interface BomDefaults {
  fabricMeters?: number;
  woodUnits?: number;
  foamBlocks?: number;
}

export type InventoryKey = 'fabricMeters' | 'woodUnits' | 'foamBlocks';

export interface IncomingSupply {
  qty: number;
  /** Known arrival instant. Incoming without a date does not cover a deficit. */
  readyAt: Date;
}

export interface InventoryAvailability {
  available: number;
  /** Pool reservedQty. Used to credit this order's own reservation at generate. */
  reserved?: number;
  /** Legacy single known date. Prefer `incoming` when dated receipts exist. */
  readyAt?: Date | null;
  incoming?: IncomingSupply[];
}

export interface MaterialReadinessResult {
  ready: boolean;
  materialReadyAt: Date | null;
  risk: boolean;
}

export interface PrioritySortItem {
  id: string;
  customerId: string;
  isPinned: boolean;
  priority: Priority;
  committedDeliveryDate?: Date | null;
  requestedDeliveryDate?: Date | null;
  createdAt: Date;
}

export interface PlannerStageInput {
  code: string;
  stageDefinitionId: string;
  dependsOnCodes: string[];
  estimatedMinutes: number;
  departmentCode: string | null;
  /** Optional task/stage instance ids for allocation output. */
  productionTaskId?: string | null;
  stageInstanceId?: string | null;
  isPinned?: boolean;
  pinnedStart?: Date | null;
  pinnedEnd?: Date | null;
  preferredEmployeeId?: string | null;
  schedulingResourceMode?: SchedulingResourceMode;
  /** Parallel slots when RESOURCE_CONSTRAINED. 0 or missing → unschedulable. */
  resourceSlots?: number | null;
  /** Stage-level notBefore (materials / WIP). */
  notBefore?: Date | null;
}

export interface PlannerOrderInput {
  id: string;
  customerId: string;
  priority: Priority;
  isPinned?: boolean;
  committedDeliveryDate?: Date | null;
  requestedDeliveryDate?: Date | null;
  /** End-of-shift after delivery working-day buffer; backward target before bufferPercent. */
  latestCompletionTarget?: Date | null;
  createdAt: Date;
  materialReadyAt?: Date | null;
  productionReadyAt?: Date | null;
  stages: PlannerStageInput[];
  bufferMinutes?: number;
}

export interface PlannedAllocation {
  orderId: string;
  stageCode: string;
  stageDefinitionId: string;
  productionTaskId?: string | null;
  stageInstanceId?: string | null;
  resourceType: ScheduleResourceType;
  employeeId: string | null;
  departmentCode: string | null;
  plannedStart: Date;
  plannedEnd: Date;
  estimatedMinutes: number;
  isPinned: boolean;
  resourceSlot?: number | null;
}

export interface SchedulePlanResult {
  allocations: PlannedAllocation[];
  earliestCompletion: Date | null;
  requestedDateFeasible: boolean;
  usedBackward: boolean;
  planningMode: SchedulePlanningMode;
  unschedulableReason?: string | null;
}

export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  message: string;
  allocationKey?: string;
}

export interface ScheduleValidationResult {
  severity: ValidationSeverity;
  issues: ValidationIssue[];
}

export interface AllocationToValidate {
  key: string;
  orderId: string;
  stageCode: string;
  dependsOnCodes: string[];
  employeeId: string | null;
  plannedStart: Date;
  plannedEnd: Date;
  isPinned: boolean;
  /** Prior pinned window; movement of pinned work is a CONFLICT unless overridden. */
  previousPinnedStart?: Date | null;
  previousPinnedEnd?: Date | null;
}
