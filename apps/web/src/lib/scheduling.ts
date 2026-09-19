/** Shared types + date helpers for the Production Scheduling UI (calendar, capacity, order detail). */

export interface ScheduleOrderCard {
  /** Production order id — used as the card key and for navigation/actions. */
  id: string;
  productionOrderId: string;
  /** Latest ProductionSchedule id backing this card, when available. */
  scheduleId?: string | null;
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
  /** Factory-local YMDs with working-minute overlap. Gaps inside min–max are omitted. */
  occupiedDates?: string[] | null;
  /** ScheduleStatus (DRAFT | PROPOSED | APPROVED | SUPERSEDED | CANCELLED | NEEDS_REVIEW | PROVISIONAL) */
  status?: string | null;
  /** SchedulePromiseState */
  promiseState?: string | null;
  materialRisk?: boolean | null;
  hasConflict?: boolean | null;
  conflictReason?: string | null;
  /** Schedule version — required when approving/pinning this order. */
  version?: number | null;
}

export interface ScheduleAllocationSummary {
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
}

/** Latest ProductionSchedule snapshot for an order, as returned by GET /scheduling/orders/:id. */
export interface ProductionScheduleSnapshot {
  id: string;
  version: number;
  status: string;
  promiseState: string;
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
}

export interface ProductionScheduleDetail {
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
  promiseState: string;
  schedule: ProductionScheduleSnapshot | null;
}

export interface CapacityRow {
  departmentId: string;
  code?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
  capacityMinutes: number;
  bookedMinutes: number;
}

export function allocationPersonLabel(locale: string, allocation: ScheduleAllocationSummary): string {
  if (allocation.employee) {
    const name = `${allocation.employee.firstName ?? ''} ${allocation.employee.lastName ?? ''}`.trim();
    if (name) return name;
  }
  if (allocation.department) {
    if (locale === 'ar') return allocation.department.nameAr || allocation.department.nameEn || '—';
    return allocation.department.nameEn || allocation.department.nameAr || '—';
  }
  return '—';
}

export interface SchedulingDashboard {
  todayCount: number;
  weekCount: number;
  approvalsWaiting: number;
  alerts: number;
  awaitingApproval?: number;
  needsReview?: number;
  approvedActive?: number;
  atRisk?: number;
  conflicts?: number;
}

export interface CalendarDay {
  date: string;
  isWorking: boolean;
  intervals: Array<{ start: string; end: string }>;
}

export interface CalendarResponse {
  calendar?: FactoryCalendarSettings | null;
  days: CalendarDay[];
  orders: ScheduleOrderCard[];
}

export interface AtRiskOrder {
  productionOrderId: string;
  number: string;
  status: string;
  priority: string;
  scheduleStatus: string;
  reason: string | null;
  reasonLabel?: string | null;
  reasonCode?: string | null;
  materialRisk: boolean;
  requiresAdminEstimateReview: boolean;
  requiredDeliveryDate: string | null;
  suggestedDeliveryDate: string | null;
  productName?: string | null;
  productNameAr?: string | null;
  productNameHe?: string | null;
  imageUrl?: string | null;
  dealerName?: string | null;
  dealerNameAr?: string | null;
  dealerNameHe?: string | null;
}

export interface ProductStageEstimateRow {
  id?: string;
  stageDefinitionId: string;
  stageCode?: string;
  setupMinutes: number;
  minutesPerUnit: number;
  fixedMinutes: number;
  quantityScalingMode: string;
  batchSize?: number | null;
  batchMinutes?: number | null;
  maxParallelUnits?: number | null;
  workerCountRequired: number;
  overrideDepartmentId?: string | null;
  isRequired: boolean;
}

export interface ProductProductionProfile {
  totalStandardMinutes?: number | null;
  setupMinutes: number;
  complexityFactor: number;
  defaultBatchSize: number;
  minimumLeadTimeDays?: number | null;
  bufferPercent: number;
  isSchedulingEnabled: boolean;
}

export interface FactoryCalendarException {
  id: string;
  date: string;
  type: 'HOLIDAY' | 'SHUTDOWN' | 'EXTRA_SHIFT';
  shiftStart?: string | null;
  shiftEnd?: string | null;
  note?: string | null;
}

export interface FactoryCalendarSettings {
  timezone: string;
  workingWeekdays: number[];
  shiftStart: string;
  shiftEnd: string;
  deliveryBufferWorkingDays?: number;
  maxProductionEarlyWorkingDays?: number;
  targetFactoryUtilizationPercent?: number;
  exceptions?: FactoryCalendarException[];
  replanned?: number;
}

export const QUANTITY_SCALING_MODES = [
  'LINEAR',
  'FIXED',
  'SETUP_PLUS_LINEAR',
  'BATCH',
  'PARALLEL_CAPACITY',
] as const;

export function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseYmd(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Week starts Sunday (matches factory calendar: Fri closed, Sat open by default). */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function dateFromValue(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtTime(value?: string | null, locale = 'en'): string {
  const d = dateFromValue(value);
  if (!d) return '—';
  return d.toLocaleTimeString(locale === 'ar' ? 'ar' : locale === 'he' ? 'he' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fmtDate(value?: string | null): string {
  const d = dateFromValue(value);
  if (!d) return '—';
  return ymd(d);
}
