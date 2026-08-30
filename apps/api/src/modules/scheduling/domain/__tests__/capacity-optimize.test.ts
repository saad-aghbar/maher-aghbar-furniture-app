import {
  blockedSimOrders,
  deriveOptimizeOutcome,
  emptyDayCauseI18nKey,
  isOptimizeChangeType,
  movableSimOrders,
} from '../capacity-optimize';
import type { OrderSimResult, PolicyMetrics } from '../pull-forward-sim';

function metrics(orders: OrderSimResult[]): PolicyMetrics {
  return {
    policy: 'N_DAY',
    nWorkingDays: 10,
    avgOccupancyUtilPct: 0,
    emptyDays: 0,
    daysLt25: 0,
    daysGt85: 0,
    ordersFinishedEarlier: orders.length,
    meanDaysEarly: 0,
    maxDaysEarly: 0,
    materialViolations: 0,
    wipUnknown: 0,
    placedOrders: orders.filter((o) => o.placed).length,
    blockedOrders: orders.filter((o) => !o.placed).length,
    movedOrderCount: 0,
    occupancyUtilAtTargets: {},
    days: [],
    orders,
    allocations: [],
  };
}

function order(partial: Partial<OrderSimResult> & Pick<OrderSimResult, 'orderId'>): OrderSimResult {
  return {
    number: partial.orderId,
    placed: true,
    blockReason: null,
    materialReadyAt: null,
    materialReady: true,
    materialRisk: false,
    scarceHeld: false,
    earliestCompletion: new Date('2026-08-20T12:00:00.000Z'),
    currentCompletion: new Date('2026-08-27T12:00:00.000Z'),
    allocations: [],
    skippedStages: [],
    ...partial,
  };
}

describe('capacity optimize policy', () => {
  it('treats same-type change types and rejects Sync/calendar names', () => {
    expect(isOptimizeChangeType('capacity-optimize-preview')).toBe(true);
    expect(isOptimizeChangeType('capacity-optimize')).toBe(true);
    expect(isOptimizeChangeType('manual-sync')).toBe(false);
  });

  it('is UP_TO_DATE when nothing moves and FAILED when new conflicts appear', () => {
    expect(
      deriveOptimizeOutcome({ moved: 0, failures: 0, collisionsSkipped: 0, newConflictCount: 0 }),
    ).toBe('UP_TO_DATE');
    expect(
      deriveOptimizeOutcome({ moved: 3, failures: 0, collisionsSkipped: 0, newConflictCount: 0 }),
    ).toBe('CHANGED');
    expect(
      deriveOptimizeOutcome({ moved: 2, failures: 1, collisionsSkipped: 0, newConflictCount: 0 }),
    ).toBe('PARTIAL');
    expect(
      deriveOptimizeOutcome({ moved: 2, failures: 0, collisionsSkipped: 0, newConflictCount: 1 }),
    ).toBe('FAILED');
  });

  it('maps empty-day causes to human i18n keys, never raw engine codes', () => {
    expect(emptyDayCauseI18nKey('MATERIAL_ETA')).toBe(
      'mobile.adminScheduling.optimize.emptyDay.materialEta',
    );
    expect(emptyDayCauseI18nKey('CAPACITY_POLICY')).toBe(
      'mobile.adminScheduling.optimize.emptyDay.capacityPolicy',
    );
    expect(emptyDayCauseI18nKey(null)).toBe('mobile.adminScheduling.optimize.emptyDay.other');
  });

  it('selects orders that finish at least a minute earlier and keeps blocked separate', () => {
    const nDay = metrics([
      order({ orderId: 'a' }),
      order({
        orderId: 'b',
        earliestCompletion: new Date('2026-08-27T12:00:00.000Z'),
        currentCompletion: new Date('2026-08-27T12:00:00.000Z'),
      }),
      order({
        orderId: 'c',
        placed: false,
        blockReason: 'NOT_READY_MATERIAL',
        earliestCompletion: null,
        currentCompletion: new Date('2026-08-27T12:00:00.000Z'),
      }),
    ]);
    expect(movableSimOrders(nDay).map((o) => o.orderId)).toEqual(['a']);
    expect(blockedSimOrders(nDay).map((o) => o.orderId)).toEqual(['c']);
  });
});
