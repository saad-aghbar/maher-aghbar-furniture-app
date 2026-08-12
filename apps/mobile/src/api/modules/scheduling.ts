import { apiDelete, apiGet, apiPost } from '../client';
import { toSearchParams } from '../pagination';

export type ScheduleEstimateStatus = 'UNAVAILABLE' | 'PRELIMINARY' | 'CALCULATED';
export type ScheduleEstimateConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

export type SchedulePromiseState =
  | 'ESTIMATED'
  | 'AWAITING_APPROVAL'
  | 'CONFIRMED'
  | 'AT_RISK'
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
};

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
  schedule: ProductionScheduleSnapshot | null;
};

/** Dealer-safe — GET /scheduling/orders/:productionOrderId (own order). */
export type OwnOrderSchedule = {
  productionOrderId: string;
  number: string;
  promiseState: SchedulePromiseState | string;
  requestedDeliveryDate: string | null;
  suggestedDeliveryDate: string | null;
  committedDeliveryDate: string | null;
  canUpdateDeliveryDate: boolean;
  canRequestDateChange: boolean;
  dateChangeLocked: boolean;
  dateChangeReason: string;
};

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

export type AtRiskOrder = {
  productionOrderId: string;
  number: string;
  status: string;
  priority: string;
  scheduleStatus: string;
  reason: string | null;
  materialRisk: boolean;
  requiresAdminEstimateReview: boolean;
  requiredDeliveryDate: string | null;
  suggestedDeliveryDate: string | null;
};

export async function getAtRisk(): Promise<{ data: AtRiskOrder[] }> {
  return apiGet<{ data: AtRiskOrder[] }>('/scheduling/at-risk');
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
};

export type CalendarDay = {
  date: string;
  isWorking: boolean;
  intervals: Array<{ start: string; end: string }>;
};

export type CalendarResponse = {
  calendar: unknown;
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
};

/** Open day / overtime / close day — triggers server-side replan. */
export async function addCalendarException(
  body: CalendarExceptionInput,
): Promise<CalendarExceptionResult> {
  return apiPost<CalendarExceptionResult>('/scheduling/calendar-settings/exceptions', body);
}

/** Clear a day exception — triggers server-side replan. */
export async function deleteCalendarException(dateYmd: string): Promise<CalendarExceptionResult> {
  return apiDelete<CalendarExceptionResult>(
    `/scheduling/calendar-settings/exceptions/${encodeURIComponent(dateYmd)}`,
  );
}
