/**
 * Capacity optimize outcome shaping. Preview/apply persist lives on the
 * scheduling service occupancy loop — this file stays policy-only.
 */
import type { EmptyDayCause, OrderSimResult, PolicyMetrics } from './pull-forward-sim';

export const OPTIMIZE_PREVIEW_CHANGE_TYPE = 'capacity-optimize-preview';
export const OPTIMIZE_APPLY_CHANGE_TYPE = 'capacity-optimize';

export const OPTIMIZE_CHANGE_TYPES = [
  OPTIMIZE_PREVIEW_CHANGE_TYPE,
  OPTIMIZE_APPLY_CHANGE_TYPE,
] as const;

export type OptimizeChangeType = (typeof OPTIMIZE_CHANGE_TYPES)[number];

export function isOptimizeChangeType(value: string | null | undefined): value is OptimizeChangeType {
  return value === OPTIMIZE_PREVIEW_CHANGE_TYPE || value === OPTIMIZE_APPLY_CHANGE_TYPE;
}

export type OptimizeOutcome = 'UP_TO_DATE' | 'CHANGED' | 'PARTIAL' | 'FAILED';

export function deriveOptimizeOutcome(args: {
  moved: number;
  failures: number;
  collisionsSkipped: number;
  newConflictCount: number;
}): OptimizeOutcome {
  if (args.newConflictCount > 0) return 'FAILED';
  if (args.moved === 0 && args.failures === 0 && args.collisionsSkipped === 0) {
    return 'UP_TO_DATE';
  }
  if (args.failures > 0 || args.collisionsSkipped > 0) {
    return args.moved > 0 ? 'PARTIAL' : 'FAILED';
  }
  return 'CHANGED';
}

export function emptyDayCauseI18nKey(cause: EmptyDayCause | null | undefined): string {
  switch (cause) {
    case 'NO_ORDERS':
      return 'mobile.adminScheduling.optimize.emptyDay.noOrders';
    case 'CAPACITY_POLICY':
      return 'mobile.adminScheduling.optimize.emptyDay.capacityPolicy';
    case 'MATERIAL_SHORTAGE':
      return 'mobile.adminScheduling.optimize.emptyDay.materialShortage';
    case 'MATERIAL_ETA':
      return 'mobile.adminScheduling.optimize.emptyDay.materialEta';
    case 'WIP':
      return 'mobile.adminScheduling.optimize.emptyDay.wip';
    case 'WORKER_BOTTLENECK':
      return 'mobile.adminScheduling.optimize.emptyDay.workerBottleneck';
    case 'RESOURCE_BOTTLENECK':
      return 'mobile.adminScheduling.optimize.emptyDay.resourceBottleneck';
    case 'CLOSED':
      return 'mobile.adminScheduling.optimize.emptyDay.closed';
    default:
      return 'mobile.adminScheduling.optimize.emptyDay.other';
  }
}

export function movableSimOrders(nDay: PolicyMetrics): OrderSimResult[] {
  return nDay.orders.filter((order) => {
    if (!order.placed || !order.earliestCompletion || !order.currentCompletion) return false;
    return order.earliestCompletion.getTime() + 60_000 < order.currentCompletion.getTime();
  });
}

export function blockedSimOrders(nDay: PolicyMetrics): OrderSimResult[] {
  return nDay.orders.filter((order) => Boolean(order.blockReason) && !order.placed);
}
