import type { Priority } from './types';

export type CanonicalScheduleStatus =
  | 'LATE'
  | 'AT_RISK'
  | 'BLOCKED'
  | 'AWAITING_APPROVAL'
  | 'ON_TRACK';

export type AtRiskReasonCode =
  | 'NO_ELIGIBLE_WORKER'
  | 'MATERIAL_NOT_READY'
  | 'WIP_NOT_READY'
  | 'DURATION_ESTIMATE_REVIEW'
  | 'NO_RESOURCE_CAPACITY'
  | 'COMMITTED_DATE_TOO_EARLY'
  | 'LATE'
  | 'LATE_TASK'
  | 'WORKER_UNAVAILABLE'
  | 'CLOSED_DAY_CHANGE'
  | 'MANUAL_SCHEDULE_CHANGE'
  | 'OTHER';

export type RecommendedAction =
  | 'RECALCULATE'
  | 'REVIEW_ESTIMATES'
  | 'VIEW_PRODUCTION'
  | 'MANAGE_WORKERS'
  | 'REVIEW_COMMITMENT'
  | 'VIEW_MATERIALS'
  | 'NONE';

export type ClassifyScheduleRiskInput = {
  productionOrderStatus: string;
  scheduleStatus: string | null;
  committedDeliveryDate?: Date | null;
  requestedDeliveryDate?: Date | null;
  projectedCompletion?: Date | null;
  requestedDateFeasible?: boolean | null;
  unschedulableReason?: string | null;
  requiresAdminEstimateReview?: boolean;
  materialRisk?: boolean;
  now?: Date;
};

export type ScheduleRiskClassification = {
  primaryStatus: CanonicalScheduleStatus;
  reasonCodes: AtRiskReasonCode[];
  reasonCode: AtRiskReasonCode | null;
  recoverableAutomatically: boolean;
  recommendedAction: RecommendedAction;
  contributesToMayBeLate: boolean;
  contributesToAwaitingApproval: boolean;
  contributesToDashboard: boolean;
  projectedAfterCommitted: boolean;
  committedAlreadyPast: boolean;
};

const TERMINAL = new Set(['CANCELLED', 'COMPLETED']);
const ACTIVE_SCHEDULE = new Set(['APPROVED', 'PROPOSED', 'NEEDS_REVIEW']);

const REASON_FROM_UNSCHEDULABLE: Record<string, AtRiskReasonCode> = {
  NO_ELIGIBLE_WORKER: 'NO_ELIGIBLE_WORKER',
  MATERIAL_NOT_READY: 'MATERIAL_NOT_READY',
  WIP_NOT_READY: 'WIP_NOT_READY',
  NO_RESOURCE_CAPACITY: 'NO_RESOURCE_CAPACITY',
  NO_SLOT: 'NO_RESOURCE_CAPACITY',
  WORKER_UNAVAILABLE: 'WORKER_UNAVAILABLE',
  CLOSED_DAY: 'CLOSED_DAY_CHANGE',
  CLOSED_DAY_CHANGE: 'CLOSED_DAY_CHANGE',
  MANUAL_SCHEDULE_CHANGE: 'MANUAL_SCHEDULE_CHANGE',
  LATE_TASK: 'LATE_TASK',
};

export function isTerminalProductionStatus(status: string | null | undefined): boolean {
  return TERMINAL.has(status ?? '');
}

export function isActiveScheduleStatus(status: string | null | undefined): boolean {
  return ACTIVE_SCHEDULE.has(status ?? '');
}

export function isMayBeLateStatus(status: CanonicalScheduleStatus): boolean {
  return status === 'LATE' || status === 'AT_RISK' || status === 'BLOCKED';
}

export function reasonLabelKey(code: AtRiskReasonCode | null): string {
  switch (code) {
    case 'NO_ELIGIBLE_WORKER':
      return 'mobile.adminScheduling.reasons.noEligibleWorker';
    case 'MATERIAL_NOT_READY':
      return 'mobile.adminScheduling.reasons.materialNotReady';
    case 'WIP_NOT_READY':
      return 'mobile.adminScheduling.reasons.wipNotReady';
    case 'DURATION_ESTIMATE_REVIEW':
      return 'mobile.adminScheduling.reasons.estimateReview';
    case 'NO_RESOURCE_CAPACITY':
      return 'mobile.adminScheduling.reasons.capacity';
    case 'COMMITTED_DATE_TOO_EARLY':
      return 'mobile.adminScheduling.atRisk.committedCannotBeMet';
    case 'LATE':
      return 'mobile.adminScheduling.atRisk.statusLate';
    case 'LATE_TASK':
      return 'mobile.adminScheduling.reasons.unknown';
    case 'WORKER_UNAVAILABLE':
      return 'mobile.adminScheduling.reasons.skill';
    case 'CLOSED_DAY_CHANGE':
      return 'mobile.adminScheduling.reasons.closedDay';
    case 'MANUAL_SCHEDULE_CHANGE':
      return 'mobile.adminScheduling.reasons.unknown';
    case 'OTHER':
      return 'mobile.adminScheduling.reasons.unknown';
    default:
      return 'mobile.adminScheduling.reasons.unknown';
  }
}

export function recommendedActionLabelKey(action: RecommendedAction): string {
  switch (action) {
    case 'RECALCULATE':
      return 'mobile.adminScheduling.sheets.recalculateTitle';
    case 'REVIEW_ESTIMATES':
      return 'mobile.adminScheduling.atRisk.reviewEstimates';
    case 'VIEW_PRODUCTION':
      return 'mobile.adminScheduling.atRisk.viewProduction';
    case 'MANAGE_WORKERS':
      return 'mobile.adminScheduling.atRisk.manageWorkers';
    case 'REVIEW_COMMITMENT':
      return 'mobile.adminScheduling.atRisk.reviewCommitment';
    case 'VIEW_MATERIALS':
      return 'mobile.adminScheduling.atRisk.viewMaterials';
    default:
      return 'mobile.adminScheduling.atRisk.recommendedAction';
  }
}

export function mapUnschedulableReason(reason?: string | null): AtRiskReasonCode | null {
  if (!reason) return null;
  return REASON_FROM_UNSCHEDULABLE[reason] ?? 'OTHER';
}

function utcYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isPastYmd(target: Date, now: Date): boolean {
  return utcYmd(now) > utcYmd(target);
}

function hasValidPlan(input: ClassifyScheduleRiskInput): boolean {
  const status = input.scheduleStatus;
  if (status !== 'PROPOSED' && status !== 'APPROVED') return false;
  return Boolean(input.projectedCompletion);
}

export function classifyScheduleRisk(input: ClassifyScheduleRiskInput): ScheduleRiskClassification {
  const now = input.now ?? new Date();
  const committed = input.committedDeliveryDate ?? null;
  const requested = input.requestedDeliveryDate ?? null;
  const projected = input.projectedCompletion ?? null;
  const unschedulable = mapUnschedulableReason(input.unschedulableReason);
  const estimateReview = Boolean(input.requiresAdminEstimateReview);
  const materialRisk = Boolean(input.materialRisk);
  const terminal = isTerminalProductionStatus(input.productionOrderStatus);
  const projectedAfterCommitted = Boolean(
    committed && projected && projected.getTime() > committed.getTime(),
  );
  const committedAlreadyPast = Boolean(committed && isPastYmd(committed, now));

  const reasons: AtRiskReasonCode[] = [];
  if (unschedulable) reasons.push(unschedulable);
  if (materialRisk && !reasons.includes('MATERIAL_NOT_READY')) reasons.push('MATERIAL_NOT_READY');
  if (estimateReview) reasons.push('DURATION_ESTIMATE_REVIEW');

  const blocked =
    !terminal &&
    (input.scheduleStatus === 'NEEDS_REVIEW' ||
      Boolean(input.unschedulableReason) ||
      (estimateReview && !hasValidPlan(input)) ||
      (materialRisk && !hasValidPlan(input)));

  let primary: CanonicalScheduleStatus = 'ON_TRACK';
  if (terminal) {
    primary = 'ON_TRACK';
  } else if (blocked) {
    primary = 'BLOCKED';
  } else if (committed && (committedAlreadyPast || projectedAfterCommitted)) {
    primary = committedAlreadyPast ? 'LATE' : 'AT_RISK';
    if (committedAlreadyPast) reasons.push('LATE');
    else reasons.push('COMMITTED_DATE_TOO_EARLY');
  } else if (input.scheduleStatus === 'PROPOSED') {
    primary = 'AWAITING_APPROVAL';
  } else if (materialRisk || estimateReview) {
    primary = 'AT_RISK';
  } else {
    primary = 'ON_TRACK';
  }

  if (primary === 'AT_RISK' && !reasons.length) reasons.push('OTHER');
  if (primary === 'BLOCKED' && !reasons.length) reasons.push('OTHER');

  const reasonCode = reasons[0] ?? null;
  const { recoverableAutomatically, recommendedAction } = resolveAction({
    primary,
    reasonCode,
    estimateReview,
    hasPlan: hasValidPlan(input),
    projectedAfterCommitted,
  });

  const contributesToMayBeLate = !terminal && isMayBeLateStatus(primary);
  const contributesToAwaitingApproval = !terminal && primary === 'AWAITING_APPROVAL';

  return {
    primaryStatus: primary,
    reasonCodes: [...new Set(reasons)],
    reasonCode,
    recoverableAutomatically,
    recommendedAction,
    contributesToMayBeLate,
    contributesToAwaitingApproval,
    contributesToDashboard: !terminal,
    projectedAfterCommitted,
    committedAlreadyPast,
  };
}

function resolveAction(input: {
  primary: CanonicalScheduleStatus;
  reasonCode: AtRiskReasonCode | null;
  estimateReview: boolean;
  hasPlan: boolean;
  projectedAfterCommitted: boolean;
}): { recoverableAutomatically: boolean; recommendedAction: RecommendedAction } {
  const { primary, reasonCode, estimateReview, hasPlan } = input;
  if (primary === 'ON_TRACK' || primary === 'AWAITING_APPROVAL') {
    if (estimateReview) return { recoverableAutomatically: false, recommendedAction: 'REVIEW_ESTIMATES' };
    return { recoverableAutomatically: false, recommendedAction: 'NONE' };
  }
  if (reasonCode === 'NO_ELIGIBLE_WORKER' || reasonCode === 'WORKER_UNAVAILABLE') {
    return { recoverableAutomatically: false, recommendedAction: 'MANAGE_WORKERS' };
  }
  if (reasonCode === 'MATERIAL_NOT_READY') {
    return { recoverableAutomatically: true, recommendedAction: 'VIEW_MATERIALS' };
  }
  if (reasonCode === 'WIP_NOT_READY') {
    return { recoverableAutomatically: true, recommendedAction: 'VIEW_PRODUCTION' };
  }
  if (reasonCode === 'DURATION_ESTIMATE_REVIEW' || (estimateReview && !hasPlan)) {
    return { recoverableAutomatically: false, recommendedAction: 'REVIEW_ESTIMATES' };
  }
  if (primary === 'LATE') {
    return { recoverableAutomatically: false, recommendedAction: 'REVIEW_COMMITMENT' };
  }
  if (reasonCode === 'COMMITTED_DATE_TOO_EARLY') {
    return { recoverableAutomatically: true, recommendedAction: 'RECALCULATE' };
  }
  if (reasonCode === 'NO_RESOURCE_CAPACITY') {
    return { recoverableAutomatically: true, recommendedAction: 'RECALCULATE' };
  }
  if (primary === 'AT_RISK' || primary === 'BLOCKED') {
    return { recoverableAutomatically: true, recommendedAction: 'RECALCULATE' };
  }
  return { recoverableAutomatically: false, recommendedAction: 'NONE' };
}

const PRIORITY_RANK: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

export function compareAtRiskPriority(
  a: { priority?: Priority | string | null; number?: string | null; productionOrderId: string },
  b: { priority?: Priority | string | null; number?: string | null; productionOrderId: string },
): number {
  const pr = (PRIORITY_RANK[a.priority ?? 'NORMAL'] ?? 2) - (PRIORITY_RANK[b.priority ?? 'NORMAL'] ?? 2);
  if (pr !== 0) return pr;
  const n = (a.number ?? '').localeCompare(b.number ?? '');
  if (n !== 0) return n;
  return a.productionOrderId.localeCompare(b.productionOrderId);
}

export function promisedTarget(
  committed?: Date | null,
  requested?: Date | null,
): Date | null {
  return committed ?? requested ?? null;
}

export function isProjectedLate(
  completion: Date | null | undefined,
  requested: Date | null | undefined,
  committed: Date | null | undefined,
): boolean {
  const target = committed ?? requested;
  if (!completion || !target) return false;
  return completion.getTime() > target.getTime();
}
