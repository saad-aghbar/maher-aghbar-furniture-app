import type { FactoryDayWorker, UnscheduledOrderCard } from '@/api/modules/scheduling';
import {
  canScheduleOrder,
  filterUnscheduledCards,
  minutesLabel,
  selectTowerStats,
  selectWorkerWeek,
  uniqueDealers,
} from '../selectFactoryTower';

function card(overrides: Partial<UnscheduledOrderCard> = {}): UnscheduledOrderCard {
  return {
    id: 'po-1',
    number: 'PO-0001',
    status: 'PREPARING',
    productDescription: 'Dining table',
    planningState: 'READY_TO_SCHEDULE',
    dealerName: 'Acme',
    salesOrderNumber: 'SO-9',
    stages: [],
    workflowReady: true,
    durationsReady: true,
    ...overrides,
  };
}

describe('selectTowerStats', () => {
  it('maps the six server summary cells', () => {
    const stats = selectTowerStats({
      today: 1,
      thisWeek: 2,
      unscheduled: 3,
      atRisk: 4,
      conflicts: 5,
      overtime: 6,
      timezone: 'Asia/Amman',
      todayYmd: '2026-09-07',
      weekFrom: '2026-09-06',
      weekTo: '2026-09-12',
    });
    expect(stats.map((s) => s.key)).toEqual([
      'today',
      'week',
      'unscheduled',
      'atRisk',
      'conflicts',
      'overtime',
    ]);
    expect(stats.find((s) => s.key === 'unscheduled')?.tone).toBe('warning');
  });
});

describe('filterUnscheduledCards', () => {
  const rows = [
    card(),
    card({
      id: 'po-2',
      number: 'PO-0002',
      planningState: 'NEEDS_PLANNING',
      dealerName: 'Birch',
      productDescription: 'Chair',
    }),
  ];

  it('hides needs-planning when readiness is ready', () => {
    expect(filterUnscheduledCards(rows, { readiness: 'ready' })).toHaveLength(1);
  });

  it('searches SO / product / dealer', () => {
    expect(filterUnscheduledCards(rows, { q: 'chair' })).toHaveLength(1);
    expect(filterUnscheduledCards(rows, { dealer: 'Acme' })).toHaveLength(1);
    expect(filterUnscheduledCards(rows, { dealerNames: ['أكمي', 'Acme'] })).toHaveLength(1);
  });
});

describe('planning helpers', () => {
  it('lists unique dealers and blocks NEEDS_PLANNING from schedule', () => {
    expect(uniqueDealers([card(), card({ dealerName: 'Birch' })])).toEqual(['Acme', 'Birch']);
    expect(canScheduleOrder('NEEDS_PLANNING')).toBe(false);
    expect(canScheduleOrder('READY_TO_SCHEDULE')).toBe(true);
    expect(minutesLabel(90)).toBe('1.5h');
  });
});

function worker(overrides: Partial<FactoryDayWorker> = {}): FactoryDayWorker {
  return {
    employeeId: 'w1',
    firstName: 'Waleed',
    lastName: 'Ghazzawi',
    name: 'Waleed Ghazzawi',
    availableMinutes: 420,
    scheduledMinutes: 0,
    freeMinutes: 420,
    loadPercent: 0,
    overtime: false,
    overtimeAfter: null,
    closed: false,
    intervals: [],
    busy: [],
    freeWindows: [],
    ...overrides,
  };
}

describe('selectWorkerWeek', () => {
  it('keeps loading days out of week totals and marks the selected day', () => {
    const week = selectWorkerWeek(
      [
        { date: '2026-09-06', day: { closed: true, workers: [worker({ closed: true, availableMinutes: 0 })] } },
        { date: '2026-09-07' },
        {
          date: '2026-09-10',
          day: {
            closed: false,
            workers: [worker({ scheduledMinutes: 1146, availableMinutes: 420, overtime: true })],
          },
        },
      ],
      'w1',
      '2026-09-10',
    );
    expect(week.rows[0]?.factoryClosed).toBe(true);
    expect(week.rows[1]?.status).toBe('loading');
    expect(week.rows[2]?.isSelected).toBe(true);
    expect(week.plannedMinutes).toBe(1146);
    expect(week.capacityMinutes).toBe(420);
    expect(week.overtime).toBe(true);
  });
});
