import type {
  AtRiskOrder,
  CalendarDay,
  ScheduleOrderCard,
  SchedulingDashboard,
} from '@/api/modules/scheduling';
import {
  selectApprovalsWaiting,
  selectAtRiskCards,
  selectAvailableActions,
  selectDashboardStats,
  selectMonthDayMeta,
  selectOrdersForDay,
  selectWeekStrip,
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

  it('filters to PROPOSED/NEEDS_REVIEW statuses only', () => {
    const orders = [
      orderCard({ status: 'PROPOSED' }),
      orderCard({ id: 'sc-2', productionOrderId: 'po-2', status: 'APPROVED' }),
      orderCard({ id: 'sc-3', productionOrderId: 'po-3', status: 'NEEDS_REVIEW' }),
    ];
    const result = selectApprovalsWaiting(orders);
    expect(result.map((r) => r.productionOrderId)).toEqual(['po-1', 'po-3']);
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

  it('maps at-risk orders including reason and suggested date', () => {
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
      },
    ];
    const result = selectAtRiskCards(atRisk);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      productionOrderId: 'po-9',
      materialRisk: true,
      reason: 'Material shortage',
      requiredDeliveryDate: '2026-09-01',
      suggestedDeliveryDate: '2026-09-05',
      scheduleVersion: null,
    });
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

  it('offers approve when a schedule version exists and status needs approval', () => {
    expect(selectAvailableActions(card())).toEqual(['approve', 'changeDate', 'recalculate']);
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

  it('applies closed / empty / light / half / busy load thresholds', () => {
    const orders = [
      orderCard({ id: 'a', productionOrderId: 'po-a', plannedStart: '2026-08-11', plannedEnd: '2026-08-11' }),
      orderCard({ id: 'b', productionOrderId: 'po-b', plannedStart: '2026-08-11', plannedEnd: '2026-08-11' }),
      // half day: 4 orders
      ...[1, 2, 3, 4].map((n) =>
        orderCard({
          id: `h-${n}`,
          productionOrderId: `po-h-${n}`,
          plannedStart: '2026-08-13',
          plannedEnd: '2026-08-13',
        }),
      ),
    ];
    const meta = selectMonthDayMeta(days, orders);
    expect(meta['2026-08-10']?.load).toBe('empty');
    expect(meta['2026-08-11']?.load).toBe('light');
    expect(meta['2026-08-11']?.orderCount).toBe(2);
    expect(meta['2026-08-12']?.load).toBe('closed');
    expect(meta['2026-08-12']?.dayMeta.disabled).toBe(true);
    expect(meta['2026-08-13']?.load).toBe('half');
  });

  it('marks busy at 6+ orders', () => {
    const orders = [1, 2, 3, 4, 5, 6].map((n) =>
      orderCard({
        id: `b-${n}`,
        productionOrderId: `po-b-${n}`,
        plannedStart: '2026-08-10',
        plannedEnd: '2026-08-10',
      }),
    );
    expect(selectMonthDayMeta(days, orders)['2026-08-10']?.load).toBe('busy');
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

  it('de-duplicates by productionOrderId', () => {
    const orders = [
      orderCard({ id: 'a', productionOrderId: 'po-1', plannedStart: '2026-08-11' }),
      orderCard({ id: 'b', productionOrderId: 'po-1', plannedStart: '2026-08-11' }),
    ];
    expect(selectOrdersForDay(orders, '2026-08-11')).toHaveLength(1);
  });
});
