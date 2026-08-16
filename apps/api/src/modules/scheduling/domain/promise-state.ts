import type {
  ProductionOrderStatus,
  SchedulePromiseState,
  ScheduleStatus,
} from './types';

export interface PromiseStateInput {
  scheduleStatus: ScheduleStatus;
  productionOrderStatus?: ProductionOrderStatus | null;
  /** Explicit risk flag from material/capacity analysis. */
  atRisk?: boolean;
  /** Projected completion is after committed/requested delivery. */
  late?: boolean;
  /** True when an approved promise was moved after commit. */
  wasRescheduled?: boolean;
}

/**
 * Map internal schedule/production status to a dealer-safe promise state.
 * Never exposes factory internals — only the commercial promise lens.
 */
export function mapPromiseState(input: PromiseStateInput): SchedulePromiseState {
  const { scheduleStatus, productionOrderStatus, atRisk, late, wasRescheduled } = input;

  if (productionOrderStatus === 'COMPLETED') {
    return 'COMPLETED';
  }

  if (scheduleStatus === 'CANCELLED' || productionOrderStatus === 'CANCELLED') {
    return 'ESTIMATED';
  }

  if (scheduleStatus === 'APPROVED') {
    if (late) return 'LATE';
    if (atRisk) return 'AT_RISK';
    if (wasRescheduled) return 'RESCHEDULED';
    return 'CONFIRMED';
  }

  if (scheduleStatus === 'NEEDS_REVIEW') {
    return 'AT_RISK';
  }

  if (scheduleStatus === 'SUPERSEDED') {
    return wasRescheduled ? 'RESCHEDULED' : 'ESTIMATED';
  }

  if (scheduleStatus === 'PROPOSED') {
    return 'AWAITING_APPROVAL';
  }

  // DRAFT | PROVISIONAL
  return 'ESTIMATED';
}
