import type {
  DealerChangeAction,
  ProductionOrderStatus,
  SchedulePromiseState,
} from './types';

const NOT_STARTED: ReadonlySet<ProductionOrderStatus> = new Set([
  'DRAFT',
  'PLANNED',
  'WAITING_FOR_MATERIALS',
  'READY',
]);

const IN_PRODUCTION: ReadonlySet<ProductionOrderStatus> = new Set([
  'IN_PROGRESS',
  'ON_HOLD',
  'QUALITY_CHECK',
  'READY_FOR_PACKAGING',
  'READY_FOR_DELIVERY',
  'COMPLETED',
]);

const APPROVED_PROMISE: ReadonlySet<SchedulePromiseState> = new Set([
  'CONFIRMED',
  'AT_RISK',
  'RESCHEDULED',
]);

export interface DealerChangePolicyInput {
  promiseState: SchedulePromiseState;
  productionOrderStatus: ProductionOrderStatus;
}

export interface DealerChangePolicyResult {
  action: DealerChangeAction;
  canUpdateDirect: boolean;
  canChangeRequest: boolean;
  locked: boolean;
  reason: string;
}

/**
 * Dealer preferred-date change policy:
 * - Not approved + not started → direct update
 * - Approved + not started → change request only
 * - In production / completed / cancelled → locked
 */
export function resolveDealerChangePolicy(
  input: DealerChangePolicyInput,
): DealerChangePolicyResult {
  const { promiseState, productionOrderStatus } = input;

  if (productionOrderStatus === 'CANCELLED') {
    return locked('Production order is cancelled');
  }

  if (promiseState === 'COMPLETED' || productionOrderStatus === 'COMPLETED') {
    return locked('Order is completed');
  }

  if (IN_PRODUCTION.has(productionOrderStatus)) {
    return locked('Order is in production');
  }

  const notStarted = NOT_STARTED.has(productionOrderStatus);
  const approved = APPROVED_PROMISE.has(promiseState);

  if (approved && notStarted) {
    return {
      action: 'canChangeRequest',
      canUpdateDirect: false,
      canChangeRequest: true,
      locked: false,
      reason: 'Schedule is approved; dealer may submit a change request',
    };
  }

  if (!approved && notStarted) {
    return {
      action: 'canUpdateDirect',
      canUpdateDirect: true,
      canChangeRequest: false,
      locked: false,
      reason: 'Schedule not yet approved; dealer may update preferred date directly',
    };
  }

  return locked('Dealer date changes are not allowed in the current state');
}

function locked(reason: string): DealerChangePolicyResult {
  return {
    action: 'locked',
    canUpdateDirect: false,
    canChangeRequest: false,
    locked: true,
    reason,
  };
}
