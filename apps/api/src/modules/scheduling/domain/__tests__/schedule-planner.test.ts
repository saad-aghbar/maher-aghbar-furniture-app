import { forwardSchedule, backwardSchedule } from '../schedule-planner';
import { WorkingCalendar, zonedLocalToUtc } from '../working-calendar';
import type { PlannerOrderInput, WorkerCandidate } from '../types';

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
  { id: 'w1', isActive: true, departmentCode: 'CARPENTRY', skillStageDefinitionIds: ['stg-cut'] },
  { id: 'w2', isActive: true, departmentCode: 'CARPENTRY', skillStageDefinitionIds: ['stg-cut', 'stg-asm'] },
];

function order(partial: Partial<PlannerOrderInput> & Pick<PlannerOrderInput, 'id'>): PlannerOrderInput {
  return {
    customerId: 'cust-a',
    priority: 'NORMAL',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    stages: [
      {
        code: 'CUT',
        stageDefinitionId: 'stg-cut',
        dependsOnCodes: [],
        estimatedMinutes: 60,
        departmentCode: 'CARPENTRY',
      },
      {
        code: 'ASSEMBLY',
        stageDefinitionId: 'stg-asm',
        dependsOnCodes: ['CUT'],
        estimatedMinutes: 60,
        departmentCode: 'CARPENTRY',
      },
    ],
    ...partial,
  };
}

describe('schedule-planner', () => {
  const now = amman(2026, 8, 9, 8, 0); // Sunday open

  it('forwardSchedule places stages in dependency order without worker overlap', () => {
    const result = forwardSchedule(
      [
        order({ id: 'o1' }),
        order({
          id: 'o2',
          customerId: 'cust-b',
          createdAt: new Date('2026-08-01T01:00:00.000Z'),
        }),
      ],
      { calendar, workers, now },
    );

    expect(result.allocations).toHaveLength(4);
    expect(result.usedBackward).toBe(false);

    const byKey = new Map(
      result.allocations.map((a) => [`${a.orderId}:${a.stageCode}`, a]),
    );

    const o1Cut = byKey.get('o1:CUT')!;
    const o1Asm = byKey.get('o1:ASSEMBLY')!;
    expect(o1Asm.plannedStart.getTime()).toBeGreaterThanOrEqual(o1Cut.plannedEnd.getTime());

    // No worker double-booking
    const booked = result.allocations.filter((a) => a.employeeId);
    for (let i = 0; i < booked.length; i++) {
      for (let j = i + 1; j < booked.length; j++) {
        const a = booked[i]!;
        const b = booked[j]!;
        if (a.employeeId !== b.employeeId) continue;
        const overlap =
          a.plannedStart.getTime() < b.plannedEnd.getTime() &&
          b.plannedStart.getTime() < a.plannedEnd.getTime();
        expect(overlap).toBe(false);
      }
    }
  });

  it('forwardSchedule waits for material readiness', () => {
    const materialReadyAt = amman(2026, 8, 10, 8, 0); // Monday
    const result = forwardSchedule([order({ id: 'o1', materialReadyAt })], {
      calendar,
      workers,
      now,
    });
    const cut = result.allocations.find((a) => a.stageCode === 'CUT')!;
    expect(cut.plannedStart.getTime()).toBeGreaterThanOrEqual(materialReadyAt.getTime());
  });

  it('backwardSchedule meets a feasible requested date', () => {
    const requested = amman(2026, 8, 12, 17, 0); // Wednesday end of shift
    const result = backwardSchedule(
      [order({ id: 'o1', requestedDeliveryDate: requested, bufferMinutes: 0 })],
      { calendar, workers, now },
    );

    expect(result.requestedDateFeasible).toBe(true);
    expect(result.usedBackward).toBe(true);
    const last = result.allocations.reduce((max, a) =>
      a.plannedEnd.getTime() > max.plannedEnd.getTime() ? a : max,
    );
    expect(last.plannedEnd.getTime()).toBeLessThanOrEqual(requested.getTime());
  });

  it('backwardSchedule falls back to forward when requested date is impossible', () => {
    const requested = amman(2026, 8, 9, 9, 0); // same morning — too soon for 120m + deps
    const result = backwardSchedule(
      [
        order({
          id: 'o1',
          requestedDeliveryDate: requested,
          bufferMinutes: 0,
          stages: [
            {
              code: 'CUT',
              stageDefinitionId: 'stg-cut',
              dependsOnCodes: [],
              estimatedMinutes: 240,
              departmentCode: 'CARPENTRY',
            },
            {
              code: 'ASSEMBLY',
              stageDefinitionId: 'stg-asm',
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
    expect(result.allocations.length).toBe(2);
    const cut = result.allocations.find((a) => a.stageCode === 'CUT')!;
    expect(cut.plannedStart.getTime()).toBeGreaterThanOrEqual(now.getTime());
  });

  it('respects parallel merge: child starts after both parents', () => {
    const result = forwardSchedule(
      [
        order({
          id: 'o1',
          stages: [
            {
              code: 'CUT',
              stageDefinitionId: 'stg-cut',
              dependsOnCodes: [],
              estimatedMinutes: 120,
              departmentCode: 'CARPENTRY',
            },
            {
              code: 'FOAM',
              stageDefinitionId: 'stg-cut',
              dependsOnCodes: [],
              estimatedMinutes: 60,
              departmentCode: 'CARPENTRY',
            },
            {
              code: 'UPHOLSTERY',
              stageDefinitionId: 'stg-asm',
              dependsOnCodes: ['CUT', 'FOAM'],
              estimatedMinutes: 60,
              departmentCode: 'CARPENTRY',
            },
          ],
        }),
      ],
      { calendar, workers, now },
    );

    const byCode = new Map(result.allocations.map((a) => [a.stageCode, a]));
    const uph = byCode.get('UPHOLSTERY')!;
    expect(uph.plannedStart.getTime()).toBeGreaterThanOrEqual(byCode.get('CUT')!.plannedEnd.getTime());
    expect(uph.plannedStart.getTime()).toBeGreaterThanOrEqual(byCode.get('FOAM')!.plannedEnd.getTime());
  });
});
