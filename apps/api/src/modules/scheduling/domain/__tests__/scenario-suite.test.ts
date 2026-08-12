/**
 * Deterministic multi-scenario suite over pure domain exports (no DB).
 */
import {
  backwardSchedule,
  forwardSchedule,
  sortWithFairness,
  validateSchedule,
  WorkingCalendar,
  zonedLocalToUtc,
} from '../index';
import type { AllocationToValidate, PlannerOrderInput, PrioritySortItem, WorkerCandidate } from '../types';

const TZ = 'Asia/Amman';

function amman(y: number, m: number, d: number, hh: number, mm: number): Date {
  return zonedLocalToUtc(y, m, d, hh, mm, 0, TZ);
}

const calendar = new WorkingCalendar({
  timezone: TZ,
  workingWeekdays: [0, 1, 2, 3, 4],
  shiftStart: '08:00',
  shiftEnd: '17:00',
  breaks: [{ start: '12:00', end: '13:00' }],
  exceptions: [],
});

const workers: WorkerCandidate[] = [
  { id: 'w1', isActive: true, departmentCode: 'CARPENTRY', skillStageDefinitionIds: ['stg-c', 'stg-d', 'stg-m'] },
  { id: 'w2', isActive: true, departmentCode: 'CARPENTRY', skillStageDefinitionIds: ['stg-c', 'stg-d', 'stg-m'] },
];

function sortItem(
  partial: Partial<PrioritySortItem> & Pick<PrioritySortItem, 'id' | 'customerId'>,
): PrioritySortItem {
  return {
    isPinned: false,
    priority: 'NORMAL',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    ...partial,
  };
}

function linearOrder(
  partial: Partial<PlannerOrderInput> & Pick<PlannerOrderInput, 'id'>,
): PlannerOrderInput {
  return {
    customerId: 'cust-a',
    priority: 'NORMAL',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    stages: [
      {
        code: 'CUT',
        stageDefinitionId: 'stg-c',
        dependsOnCodes: [],
        estimatedMinutes: 60,
        departmentCode: 'CARPENTRY',
      },
      {
        code: 'ASSEMBLY',
        stageDefinitionId: 'stg-m',
        dependsOnCodes: ['CUT'],
        estimatedMinutes: 60,
        departmentCode: 'CARPENTRY',
      },
    ],
    ...partial,
  };
}

describe('scheduling domain scenario suite', () => {
  const now = amman(2026, 8, 9, 8, 0); // Sunday open

  it('interleaves equal-priority orders across 3 dealers (fairness)', () => {
    const items = [
      sortItem({ id: 'a1', customerId: 'A', createdAt: new Date('2026-08-01T01:00:00.000Z') }),
      sortItem({ id: 'a2', customerId: 'A', createdAt: new Date('2026-08-01T02:00:00.000Z') }),
      sortItem({ id: 'b1', customerId: 'B', createdAt: new Date('2026-08-01T01:10:00.000Z') }),
      sortItem({ id: 'b2', customerId: 'B', createdAt: new Date('2026-08-01T02:10:00.000Z') }),
      sortItem({ id: 'c1', customerId: 'C', createdAt: new Date('2026-08-01T01:20:00.000Z') }),
      sortItem({ id: 'c2', customerId: 'C', createdAt: new Date('2026-08-01T02:20:00.000Z') }),
    ];

    const sorted = sortWithFairness(items).map((x) => x.id);
    // Customer ids sort A,B,C then round-robin — not all of one dealer first
    expect(sorted).toEqual(['a1', 'b1', 'c1', 'a2', 'b2', 'c2']);
    expect(sortWithFairness(items).map((x) => x.id)).toEqual(sorted);
  });

  it('backward meets a feasible date; forward ignores deadline pressure', () => {
    const requested = amman(2026, 8, 12, 17, 0);
    const order = linearOrder({
      id: 'o1',
      requestedDeliveryDate: requested,
      bufferMinutes: 0,
    });

    const backward = backwardSchedule([order], { calendar, workers, now });
    expect(backward.usedBackward).toBe(true);
    expect(backward.requestedDateFeasible).toBe(true);
    const lastEnd = backward.allocations.reduce(
      (max, a) => (a.plannedEnd.getTime() > max.getTime() ? a.plannedEnd : max),
      backward.allocations[0]!.plannedEnd,
    );
    expect(lastEnd.getTime()).toBeLessThanOrEqual(requested.getTime());

    const forward = forwardSchedule([order], { calendar, workers, now });
    expect(forward.usedBackward).toBe(false);
    expect(forward.allocations).toHaveLength(2);
    // Forward starts from now; completion may still finish before the request, but mode differs
    expect(forward.earliestCompletion).not.toBeNull();
    expect(forward.earliestCompletion!.getTime()).toBeGreaterThanOrEqual(now.getTime());
  });

  it('impossible short deadline → requestedDateFeasible false (completion after request)', () => {
    const requested = amman(2026, 8, 9, 9, 0); // same morning
    const result = backwardSchedule(
      [
        linearOrder({
          id: 'o1',
          requestedDeliveryDate: requested,
          bufferMinutes: 0,
          stages: [
            {
              code: 'CUT',
              stageDefinitionId: 'stg-c',
              dependsOnCodes: [],
              estimatedMinutes: 240,
              departmentCode: 'CARPENTRY',
            },
            {
              code: 'ASSEMBLY',
              stageDefinitionId: 'stg-m',
              dependsOnCodes: ['CUT'],
              estimatedMinutes: 240,
              departmentCode: 'CARPENTRY',
            },
          ],
        }),
      ],
      { calendar, workers, now },
    );

    expect(result.requestedDateFeasible).toBe(false);
    expect(result.earliestCompletion).not.toBeNull();
    expect(result.earliestCompletion!.getTime()).toBeGreaterThan(requested.getTime());
  });

  it('parallel branches C∥D merge into M after both parents', () => {
    const result = forwardSchedule(
      [
        linearOrder({
          id: 'o1',
          stages: [
            {
              code: 'C',
              stageDefinitionId: 'stg-c',
              dependsOnCodes: [],
              estimatedMinutes: 120,
              departmentCode: 'CARPENTRY',
            },
            {
              code: 'D',
              stageDefinitionId: 'stg-d',
              dependsOnCodes: [],
              estimatedMinutes: 60,
              departmentCode: 'CARPENTRY',
            },
            {
              code: 'M',
              stageDefinitionId: 'stg-m',
              dependsOnCodes: ['C', 'D'],
              estimatedMinutes: 60,
              departmentCode: 'CARPENTRY',
            },
          ],
        }),
      ],
      { calendar, workers, now },
    );

    const byCode = new Map(result.allocations.map((a) => [a.stageCode, a]));
    const merge = byCode.get('M')!;
    expect(merge.plannedStart.getTime()).toBeGreaterThanOrEqual(byCode.get('C')!.plannedEnd.getTime());
    expect(merge.plannedStart.getTime()).toBeGreaterThanOrEqual(byCode.get('D')!.plannedEnd.getTime());
  });

  it('validator reports CONFLICT on worker overlap', () => {
    const start = amman(2026, 8, 10, 8, 0);
    const mid = amman(2026, 8, 10, 10, 0);
    const end = amman(2026, 8, 10, 12, 0);

    const allocations: AllocationToValidate[] = [
      {
        key: 'a',
        orderId: 'o1',
        stageCode: 'CUT',
        dependsOnCodes: [],
        plannedStart: start,
        plannedEnd: mid,
        employeeId: 'w1',
        isPinned: false,
      },
      {
        key: 'b',
        orderId: 'o2',
        stageCode: 'CUT',
        dependsOnCodes: [],
        plannedStart: amman(2026, 8, 10, 9, 0),
        plannedEnd: end,
        employeeId: 'w1',
        isPinned: false,
      },
    ];

    const validation = validateSchedule({ allocations, calendar });
    expect(validation.severity).toBe('CONFLICT');
    expect(validation.issues.some((i) => i.code === 'WORKER_OVERLAP')).toBe(true);
  });

  it('pinned allocations sort first (preserved ahead of unpinned peers)', () => {
    const items = [
      sortItem({ id: 'u-urgent', customerId: 'A', priority: 'URGENT' }),
      sortItem({ id: 'p-low', customerId: 'B', priority: 'LOW', isPinned: true }),
      sortItem({ id: 'u-normal', customerId: 'C', priority: 'NORMAL' }),
    ];
    expect(sortWithFairness(items).map((x) => x.id)).toEqual(['p-low', 'u-urgent', 'u-normal']);
  });
});
