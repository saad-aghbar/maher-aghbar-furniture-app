import { invalidateKeys } from '@/api/queryKeys';
import type {
  AtRiskOrder,
  CalendarDay,
  ScheduleOrderCard,
  SchedulingDashboard,
} from '@/api/modules/scheduling';
import {
  selectApprovalsWaiting,
  selectAtRiskCards,
  selectAtRiskReasonGroups,
  selectAtRiskStatusKey,
  selectAvailableActions,
  selectDaysLate,
  selectApprovableScheduleTargets,
  selectConflictBarCount,
  selectConflictCards,
  selectDashboardStats,
  selectMonthDayMeta,
  selectOrdersForDay,
  selectOrdersInRange,
  selectWeekStrip,
  weekRangeFromYmd,
  filterScheduleCards,
  type AdminScheduleCardModel,
} from '../selectAdminScheduling';

const dashboard: SchedulingDashboard = {
  awaitingApproval: 3,
  needsReview: 1,
  approvedActive: 10,
  atRisk: 2,
  conflicts: 0,
  todayCount: 4,
  weekCount: 20,
  approvalsWaiting: 3,
  alerts: 0,
};

function orderCard(overrides: Partial<ScheduleOrderCard> = {}): ScheduleOrderCard {
  return {
    id: 'sc-1',
    productionOrderId: 'po-1',
    number: 'PO-0001',
    productName: 'Dining Table',
    dealerName: 'Acme Furniture',
    plannedStart: '2026-08-11T08:00:00.000Z',
    plannedEnd: '2026-08-11T12:00:00.000Z',
    status: 'PROPOSED',
    promiseState: 'AWAITING_APPROVAL',
    materialRisk: false,
    hasConflict: false,
    conflictReason: null,
    version: 2,
    ...overrides,
  };
}

describe('selectDashboardStats', () => {
  it('returns an empty list when there is no dashboard yet', () => {
    expect(selectDashboardStats(undefined)).toEqual([]);
  });

  it('maps counts to stat chips with warning/danger tones', () => {
    const stats = selectDashboardStats(dashboard);
    expect(stats).toHaveLength(5);
    expect(stats.find((s) => s.key === 'today')).toMatchObject({ value: 4, tone: 'neutral' });
    expect(stats.find((s) => s.key === 'awaitingApproval')).toMatchObject({
      value: 3,
      tone: 'warning',
    });
    expect(stats.find((s) => s.key === 'atRisk')).toMatchObject({ value: 2, tone: 'danger' });
    expect(stats.find((s) => s.key === 'conflicts')).toMatchObject({ value: 0, tone: 'neutral' });
  });

  it('prefers at-risk, conflict, and awaiting-approval list lengths for chip counts', () => {
    const stats = selectDashboardStats(dashboard, {
      atRiskCount: 4,
      conflictCount: 3,
      awaitingApprovalCount: 23,
    });
    expect(stats.find((s) => s.key === 'atRisk')).toMatchObject({ value: 4, tone: 'danger' });
    expect(stats.find((s) => s.key === 'conflicts')).toMatchObject({ value: 3, tone: 'danger' });
    expect(stats.find((s) => s.key === 'awaitingApproval')).toMatchObject({
      value: 23,
      tone: 'warning',
    });
  });

  it('counts unique active conflicts only — never orders plus pairs', () => {
    expect(selectConflictBarCount([{}, {}, {}])).toBe(3);
    expect(selectConflictBarCount(3)).toBe(3);
    expect(selectConflictBarCount(undefined)).toBe(0);
    expect(selectConflictBarCount([])).toBe(0);
  });
});

describe('selectWeekStrip', () => {
  const days: CalendarDay[] = [
    { date: '2026-08-10', isWorking: true, intervals: [] },
    { date: '2026-08-11', isWorking: true, intervals: [] },
    { date: '2026-08-12', isWorking: false, intervals: [] },
  ];

  it('returns an empty list with no calendar days', () => {
    expect(selectWeekStrip(undefined, [], '2026-08-11T00:00:00.000Z')).toEqual([]);
  });

  it('counts orders per planned-start day and flags today', () => {
    const orders = [
      orderCard({ plannedStart: '2026-08-11T08:00:00.000Z' }),
      orderCard({ id: 'sc-2', plannedStart: '2026-08-11T10:00:00.000Z' }),
      orderCard({ id: 'sc-3', plannedStart: '2026-08-10T09:00:00.000Z' }),
      orderCard({ id: 'sc-4', plannedStart: null }),
    ];
    const strip = selectWeekStrip(days, orders, '2026-08-11T06:00:00.000Z');
    expect(strip).toHaveLength(3);
    expect(strip.find((d) => d.date === '2026-08-11')).toMatchObject({
      isToday: true,
      isWorking: true,
      orderCount: 2,
    });
    expect(strip.find((d) => d.date === '2026-08-10')).toMatchObject({
      isToday: false,
      orderCount: 1,
    });
    expect(strip.find((d) => d.date === '2026-08-12')).toMatchObject({
      isToday: false,
      isWorking: false,
      orderCount: 0,
    });
  });
});

describe('selectApprovalsWaiting', () => {
  it('returns an empty list with no orders', () => {
    expect(selectApprovalsWaiting(undefined)).toEqual([]);
  });

  it('filters to PROPOSED schedules only', () => {
    const orders = [
      orderCard({ status: 'PROPOSED' }),
      orderCard({ id: 'sc-2', productionOrderId: 'po-2', status: 'APPROVED' }),
      orderCard({ id: 'sc-3', productionOrderId: 'po-3', status: 'NEEDS_REVIEW' }),
    ];
    const result = selectApprovalsWaiting(orders);
    expect(result.map((r) => r.productionOrderId)).toEqual(['po-1']);
  });

  it('deduplicates by productionOrderId, keeping the first occurrence', () => {
    const orders = [
      orderCard({ id: 'sc-1a', productionOrderId: 'po-1', status: 'PROPOSED' }),
      orderCard({ id: 'sc-1b', productionOrderId: 'po-1', status: 'PROPOSED' }),
    ];
    const result = selectApprovalsWaiting(orders);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('sc-1a');
  });

  it('sorts by plannedStart ascending', () => {
    const orders = [
      orderCard({ id: 'sc-1', productionOrderId: 'po-1', status: 'PROPOSED', plannedStart: '2026-08-12T08:00:00.000Z' }),
      orderCard({ id: 'sc-2', productionOrderId: 'po-2', status: 'PROPOSED', plannedStart: '2026-08-10T08:00:00.000Z' }),
    ];
    const result = selectApprovalsWaiting(orders);
    expect(result.map((r) => r.productionOrderId)).toEqual(['po-2', 'po-1']);
  });

  it('localizes product and dealer names for the requested locale', () => {
    const orders = [
      orderCard({
        status: 'PROPOSED',
        productName: 'Dining Table',
        productNameAr: 'طاولة طعام',
        dealerName: 'Acme',
        dealerNameAr: 'أكمي',
      }),
    ];
    const result = selectApprovalsWaiting(orders, 'ar');
    expect(result[0]!.title).toBe('طاولة طعام');
    expect(result[0]!.dealerName).toBe('أكمي');
  });
});

describe('selectAtRiskCards', () => {
  it('returns an empty list with no at-risk orders', () => {
    expect(selectAtRiskCards(undefined)).toEqual([]);
  });

  it('maps at-risk orders including reason, product, and image', () => {
    const atRisk: AtRiskOrder[] = [
      {
        productionOrderId: 'po-9',
        number: 'PO-0009',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        scheduleStatus: 'NEEDS_REVIEW',
        reason: 'Material shortage',
        materialRisk: true,
        requiresAdminEstimateReview: true,
        requiredDeliveryDate: '2026-09-01',
        suggestedDeliveryDate: '2026-09-05',
        productName: 'Armchair',
        productNameAr: 'كرسي',
        imageUrl: '/api/v1/files/armchair.jpg',
        dealerName: 'Acme',
        scheduleVersion: 4,
        riskStatus: 'BLOCKED',
        recommendedAction: 'VIEW_MATERIALS',
      },
    ];
    const result = selectAtRiskCards(atRisk, 'en');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      productionOrderId: 'po-9',
      title: 'Armchair',
      dealerName: 'Acme',
      imageUrl: '/api/v1/files/armchair.jpg',
      priority: 'HIGH',
      materialRisk: true,
      reason: 'Material shortage',
      requiredDeliveryDate: '2026-09-01',
      suggestedDeliveryDate: '2026-09-05',
      scheduleVersion: 4,
      riskStatus: 'BLOCKED',
      recommendedAction: 'VIEW_MATERIALS',
    });
  });
});

describe('weekRangeFromYmd', () => {
  it('returns Sunday–Saturday for a midweek anchor', () => {
    // 2026-08-12 is Wednesday
    expect(weekRangeFromYmd('2026-08-12')).toEqual({ from: '2026-08-09', to: '2026-08-15' });
  });
});

describe('selectOrdersInRange / selectConflictCards', () => {
  it('includes orders whose planned window overlaps the range', () => {
    const orders = [
      orderCard({ id: 'a', productionOrderId: 'po-a', plannedStart: '2026-08-10T08:00:00.000Z' }),
      orderCard({ id: 'b', productionOrderId: 'po-b', plannedStart: '2026-08-16T08:00:00.000Z' }),
      orderCard({
        id: 'c',
        productionOrderId: 'po-c',
        plannedStart: '2026-08-08T08:00:00.000Z',
        plannedEnd: '2026-08-12T12:00:00.000Z',
      }),
    ];
    const result = selectOrdersInRange(orders, '2026-08-09', '2026-08-15');
    expect(result.map((o) => o.productionOrderId).sort()).toEqual(['po-a', 'po-c']);
  });

  it('returns only conflict-flagged orders', () => {
    const orders = [
      orderCard({ id: 'a', productionOrderId: 'po-a', hasConflict: true }),
      orderCard({ id: 'b', productionOrderId: 'po-b', hasConflict: false }),
      orderCard({ id: 'c', productionOrderId: 'po-c', hasConflict: true }),
    ];
    expect(selectConflictCards(orders).map((o) => o.productionOrderId).sort()).toEqual([
      'po-a',
      'po-c',
    ]);
  });

  it('passes imageUrl through to schedule cards', () => {
    const orders = [
      orderCard({
        id: 'a',
        productionOrderId: 'po-a',
        imageUrl: '/api/v1/files/table.jpg',
        plannedStart: '2026-08-11T08:00:00.000Z',
      }),
    ];
    expect(selectOrdersForDay(orders, '2026-08-11')[0]?.imageUrl).toBe('/api/v1/files/table.jpg');
  });

  it('passes schedule dates through instead of zeroing them', () => {
    const orders = [
      orderCard({
        plannedStart: '2026-08-11T08:00:00.000Z',
        requestedDeliveryDate: '2026-08-20',
        suggestedDeliveryDate: '2026-08-22',
        committedDeliveryDate: '2026-08-21',
        earliestAvailableDate: '2026-08-22',
        requestedDateFeasible: false,
        unschedulableReason: null,
        planningMode: 'BACKWARD',
        materialReadyAt: '2026-08-18',
        productionDeadline: '2026-08-19T16:00:00.000Z',
        deliveryBufferWorkingDays: 1,
      }),
    ];
    const card = selectOrdersForDay(orders, '2026-08-11')[0]!;
    expect(card.requiredDeliveryDate).toBe('2026-08-20');
    expect(card.suggestedDeliveryDate).toBe('2026-08-22');
    expect(card.committedDeliveryDate).toBe('2026-08-21');
    expect(card.productionDeadline).toBe('2026-08-19T16:00:00.000Z');
    expect(card.deliveryBufferWorkingDays).toBe(1);
  });
});

describe('filterScheduleCards', () => {
  const cards: AdminScheduleCardModel[] = [
    {
      id: '1',
      productionOrderId: 'po-1',
      number: 'PO-1001',
      title: 'Dining Table',
      dealerName: 'Acme Furniture',
      imageUrl: null,
      priority: 'HIGH',
      quantity: 1,
      plannedStart: null,
      plannedEnd: null,
      status: 'PROPOSED',
      promiseState: null,
      materialRisk: false,
      hasConflict: false,
      reason: null,
      scheduleVersion: 1,
      requiredDeliveryDate: null,
      suggestedDeliveryDate: null,
    },
    {
      id: '2',
      productionOrderId: 'po-2',
      number: 'PO-2002',
      title: 'Armchair',
      dealerName: 'Nile Interiors',
      imageUrl: null,
      priority: null,
      quantity: null,
      plannedStart: null,
      plannedEnd: null,
      status: 'APPROVED',
      promiseState: null,
      materialRisk: false,
      hasConflict: false,
      reason: 'Material delay',
      scheduleVersion: null,
      requiredDeliveryDate: null,
      suggestedDeliveryDate: null,
    },
  ];

  it('returns all cards when query is empty', () => {
    expect(filterScheduleCards(cards, '  ')).toHaveLength(2);
  });

  it('matches order number, product name, dealer, and reason', () => {
    expect(filterScheduleCards(cards, '1001').map((c) => c.id)).toEqual(['1']);
    expect(filterScheduleCards(cards, 'armchair').map((c) => c.id)).toEqual(['2']);
    expect(filterScheduleCards(cards, 'nile').map((c) => c.id)).toEqual(['2']);
    expect(filterScheduleCards(cards, 'material').map((c) => c.id)).toEqual(['2']);
  });
});

describe('selectAvailableActions', () => {
  function card(overrides: Partial<AdminScheduleCardModel> = {}): AdminScheduleCardModel {
    return {
      id: 'sc-1',
      productionOrderId: 'po-1',
      number: 'PO-0001',
      title: 'Dining Table',
      dealerName: 'Acme',
      imageUrl: null,
      priority: null,
      quantity: null,
      plannedStart: null,
      plannedEnd: null,
      status: 'PROPOSED',
      promiseState: 'AWAITING_APPROVAL',
      materialRisk: false,
      hasConflict: false,
      reason: null,
      scheduleVersion: 2,
      requiredDeliveryDate: null,
      suggestedDeliveryDate: null,
      ...overrides,
    };
  }

  it('hides approve without schedule.approve and mutations without schedule.manage', () => {
    expect(selectAvailableActions(card(), { canApprove: false, canManage: true })).toEqual([
      'changeDate',
      'recalculate',
    ]);
    expect(selectAvailableActions(card(), { canApprove: true, canManage: false })).toEqual([
      'approve',
    ]);
  });

  it('offers approve when a schedule version exists and status needs approval', () => {
    expect(selectAvailableActions(card())).toEqual(['approve', 'changeDate', 'recalculate']);
  });

  it('targets only PROPOSED cards that have a version for approve-all', () => {
    const targets = selectApprovableScheduleTargets([
      card({ status: 'PROPOSED', scheduleVersion: 2, productionOrderId: 'po-1' }),
      card({ status: 'NEEDS_REVIEW', scheduleVersion: 3, productionOrderId: 'po-2', id: '2' }),
      card({ status: 'APPROVED', scheduleVersion: 4, productionOrderId: 'po-3', id: '3' }),
      card({ status: 'PROPOSED', scheduleVersion: null, productionOrderId: 'po-4', id: '4' }),
    ]);
    expect(targets).toEqual([{ productionOrderId: 'po-1', version: 2 }]);
  });

  it('maps display status and days late for at-risk cards', () => {
    expect(selectAtRiskStatusKey('LATE')).toBe('mobile.adminScheduling.atRisk.statusLate');
    expect(selectAtRiskStatusKey('BLOCKED')).toBe('mobile.adminScheduling.blocked.title');
    expect(selectDaysLate('2026-08-29', '2026-09-01')).toBe(3);
    expect(selectDaysLate('2026-09-01', '2026-08-29')).toBeNull();
  });

  it('groups duplicate resolve-all reasons with unique keys', () => {
    expect(
      selectAtRiskReasonGroups([
        { stillNeedsAttention: true, reasonLabel: 'mobile.adminScheduling.atRisk.committedCannotBeMet' },
        { stillNeedsAttention: true, reasonLabel: 'mobile.adminScheduling.atRisk.committedCannotBeMet' },
        { stillNeedsAttention: true, reasonLabel: 'mobile.adminScheduling.reasons.wipNotReady' },
        { stillNeedsAttention: false, reasonLabel: 'mobile.adminScheduling.atRisk.committedCannotBeMet' },
        { stillNeedsAttention: true, reasonLabel: null },
      ]),
    ).toEqual([
      { key: 'mobile.adminScheduling.atRisk.committedCannotBeMet', count: 2 },
      { key: 'mobile.adminScheduling.reasons.wipNotReady', count: 1 },
    ]);
  });

  it('limits at-risk card actions to the recommended action', () => {
    expect(
      selectAvailableActions(card({ riskStatus: 'AT_RISK', recommendedAction: 'RECALCULATE' })),
    ).toEqual(['approve', 'recalculate']);
    expect(
      selectAvailableActions(
        card({ status: 'APPROVED', riskStatus: 'LATE', recommendedAction: 'REVIEW_COMMITMENT' }),
      ),
    ).toEqual(['changeDate']);
  });

  it('omits approve when there is no schedule version yet (at-risk cards)', () => {
    expect(selectAvailableActions(card({ scheduleVersion: null }))).toEqual([
      'changeDate',
      'recalculate',
    ]);
  });

  it('omits approve once the schedule is already approved', () => {
    expect(selectAvailableActions(card({ status: 'APPROVED' }))).toEqual([
      'changeDate',
      'recalculate',
    ]);
  });
});

describe('selectMonthDayMeta', () => {
  const days: CalendarDay[] = [
    { date: '2026-08-10', isWorking: true, intervals: [] },
    { date: '2026-08-11', isWorking: true, intervals: [] },
    { date: '2026-08-12', isWorking: false, intervals: [] },
    { date: '2026-08-13', isWorking: true, intervals: [] },
  ];

  it('returns empty map without calendar days', () => {
    expect(selectMonthDayMeta(undefined, [])).toEqual({});
  });

  it('colors days from factory load %, not order count', () => {
    const orders = [
      orderCard({ id: 'a', productionOrderId: 'po-a', plannedStart: '2026-08-11', plannedEnd: '2026-08-11' }),
      orderCard({ id: 'b', productionOrderId: 'po-b', plannedStart: '2026-08-11', plannedEnd: '2026-08-11' }),
      ...[1, 2, 3, 4, 5, 6].map((n) =>
        orderCard({
          id: `h-${n}`,
          productionOrderId: `po-h-${n}`,
          plannedStart: '2026-08-13',
          plannedEnd: '2026-08-13',
        }),
      ),
    ];
    const meta = selectMonthDayMeta(days, orders, {
      '2026-08-10': 0,
      '2026-08-11': 29,
      '2026-08-12': null,
      '2026-08-13': 50,
    });
    expect(meta['2026-08-10']?.load).toBe('empty');
    expect(meta['2026-08-11']?.load).toBe('light');
    expect(meta['2026-08-11']?.orderCount).toBe(2);
    expect(meta['2026-08-12']?.load).toBe('closed');
    expect(meta['2026-08-12']?.dayMeta.disabled).toBe(true);
    expect(meta['2026-08-12']?.pinnedOnClosedDayCount).toBe(0);
    expect(meta['2026-08-13']?.load).toBe('half');
    expect(meta['2026-08-13']?.orderCount).toBe(6);
  });

  it('does not color from order count while factory load is unknown', () => {
    const orders = [1, 2, 3, 4, 5, 6].map((n) =>
      orderCard({
        id: `b-${n}`,
        productionOrderId: `po-b-${n}`,
        plannedStart: '2026-08-10',
        plannedEnd: '2026-08-10',
      }),
    );
    expect(selectMonthDayMeta(days, orders)['2026-08-10']?.load).toBe('empty');
  });

  it('marks busy at 85% factory load even with few orders', () => {
    const orders = [
      orderCard({
        id: 'b-1',
        productionOrderId: 'po-b-1',
        plannedStart: '2026-08-10',
        plannedEnd: '2026-08-10',
      }),
    ];
    expect(selectMonthDayMeta(days, orders, { '2026-08-10': 85 })['2026-08-10']?.load).toBe(
      'busy',
    );
  });

  it('passes pinned-on-closed-day counts through for attention UI', () => {
    const withPinned: CalendarDay[] = [
      { date: '2026-08-30', isWorking: false, intervals: [], pinnedOnClosedDayCount: 3 },
    ];
    expect(selectMonthDayMeta(withPinned, [])['2026-08-30']?.pinnedOnClosedDayCount).toBe(3);
  });
});

describe('selectOrdersForDay', () => {
  it('includes multi-day spans that intersect the day', () => {
    const orders = [
      orderCard({
        id: 'sc-span',
        productionOrderId: 'po-span',
        plannedStart: '2026-08-10T08:00:00.000Z',
        plannedEnd: '2026-08-12T17:00:00.000Z',
      }),
      orderCard({
        id: 'sc-out',
        productionOrderId: 'po-out',
        plannedStart: '2026-08-13T08:00:00.000Z',
        plannedEnd: '2026-08-13T12:00:00.000Z',
      }),
    ];
    const on11 = selectOrdersForDay(orders, '2026-08-11');
    expect(on11.map((o) => o.productionOrderId)).toEqual(['po-span']);
    expect(selectOrdersForDay(orders, '2026-08-13')).toHaveLength(1);
  });

  it('does not place an order on an empty working day inside its min-max window', () => {
    const orders = [
      orderCard({
        id: 'sc-gap',
        productionOrderId: 'po-gap',
        plannedStart: '2026-08-16T08:00:00.000Z',
        plannedEnd: '2026-08-23T12:00:00.000Z',
        occupiedDates: ['2026-08-16', '2026-08-23'],
      }),
    ];
    expect(selectOrdersForDay(orders, '2026-08-16')).toHaveLength(1);
    expect(selectOrdersForDay(orders, '2026-08-22')).toHaveLength(0);
    expect(selectOrdersForDay(orders, '2026-08-23')).toHaveLength(1);
    expect(selectOrdersInRange(orders, '2026-08-22', '2026-08-22')).toHaveLength(0);
    expect(selectOrdersInRange(orders, '2026-08-16', '2026-08-22')).toHaveLength(1);
  });

  it('de-duplicates by productionOrderId', () => {
    const orders = [
      orderCard({ id: 'a', productionOrderId: 'po-1', plannedStart: '2026-08-11' }),
      orderCard({ id: 'b', productionOrderId: 'po-1', plannedStart: '2026-08-11' }),
    ];
    expect(selectOrdersForDay(orders, '2026-08-11')).toHaveLength(1);
  });
});

describe('schedule cache invalidation', () => {
  it('invalidates at-risk, dashboard, calendar, and order detail without restart', () => {
    const keys = invalidateKeys.afterScheduleMutation('po-59');
    const serialized = keys.map((key) => key.join(':'));
    expect(serialized.some((key) => key.includes('at-risk'))).toBe(true);
    expect(serialized.some((key) => key.includes('dashboard'))).toBe(true);
    expect(serialized.some((key) => key.includes('scheduling'))).toBe(true);
    expect(serialized.some((key) => key.includes('po-59'))).toBe(true);
  });
});
