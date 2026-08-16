/**
 * Capacity UAT A–Z against the real domain planner (no DB).
 * Assertions record actual engine behavior. Intended factory gaps are
 * documented in docs/scheduling-worker-capacity-uat.md — this file must
 * stay green so CI remains an evidence harness, not a redesign.
 */
import { calculateDurationMinutes } from '../duration-calculator';
import { assessMaterialReadiness } from '../material-readiness';
import { sortWithFairness } from '../priority-fairness';
import { backwardSchedule, forwardSchedule } from '../schedule-planner';
import {
  NOW,
  STG,
  amman,
  assertNoWorkerOverlap,
  carpentryOnly,
  ctx,
  eightHourCalendar,
  sevenHourCalendar,
  employeeIds,
  forkMergeStages,
  linearCua,
  localHour,
  localYmd,
  maxEnd,
  minStart,
  nOrders,
  occupancy,
  order,
  sequentialPlan,
  stage,
  tasksStartingOn,
  worker,
} from './scheduling-capacity-uat.fixtures';
import type { PlannerOrderInput, PrioritySortItem, WorkerCandidate } from '../types';

const SUN = '2026-08-09';
const MON = '2026-08-10';

describe('scheduling capacity UAT A–Z', () => {
  describe('A — one worker capacity', () => {
    it('packs at most two 4h carpentry tasks per 8h day and never overlaps', () => {
      const workers = [worker('w-carp-1', [STG.carpentry])];
      const orders = nOrders(6);
      const result = forwardSchedule(orders, ctx(workers));
      assertNoWorkerOverlap(result.allocations);
      expect(result.allocations).toHaveLength(6);
      expect(employeeIds(result.allocations)).toEqual(['w-carp-1']);
      expect(tasksStartingOn(result.allocations, SUN)).toHaveLength(2);
      expect(tasksStartingOn(result.allocations, MON)).toHaveLength(2);
      expect(localYmd(maxEnd(result.allocations))).toBe('2026-08-11');
    });
  });

  describe('I — 7h lunch calendar finite foam day', () => {
    it('does not pack more than 14 working foam hours onto 2 workers on Sunday', () => {
      const calendar = sevenHourCalendar();
      const workers = [worker('foam-a', [STG.foam]), worker('foam-b', [STG.foam])];
      const orders = Array.from({ length: 4 }, (_, i) =>
        order({
          id: `po-foam-${i}`,
          stages: [stage('FOAM', STG.foam, 360)],
        }),
      );
      const result = forwardSchedule(orders, ctx(workers, { calendar }));
      assertNoWorkerOverlap(result.allocations);
      const sundayMinutes = result.allocations.reduce(
        (sum, allocation) =>
          sum +
          calendar.overlapWorkingMinutesOnLocalDay(
            allocation.plannedStart,
            allocation.plannedEnd,
            SUN,
          ),
        0,
      );
      expect(sundayMinutes).toBeLessThanOrEqual(840);
      const laterMinutes = result.allocations.reduce(
        (sum, allocation) =>
          sum +
          calendar.overlapWorkingMinutesOnLocalDay(
            allocation.plannedStart,
            allocation.plannedEnd,
            MON,
          ),
        0,
      );
      expect(laterMinutes).toBeGreaterThan(0);
    });
  });

  describe('B — two workers capacity', () => {
    it('doubles same-day carpentry throughput versus one worker', () => {
      const one = forwardSchedule(nOrders(8), ctx([worker('w1', [STG.carpentry])]));
      const two = forwardSchedule(
        nOrders(8),
        ctx([worker('w1', [STG.carpentry]), worker('w2', [STG.carpentry])]),
      );
      assertNoWorkerOverlap(two.allocations);
      expect(tasksStartingOn(one.allocations, SUN)).toHaveLength(2);
      expect(tasksStartingOn(two.allocations, SUN)).toHaveLength(4);
      expect(maxEnd(two.allocations).getTime()).toBeLessThan(maxEnd(one.allocations).getTime());
    });
  });

  describe('C — 50 employees / 2 skilled', () => {
    it('assigns carpentry only to the two skilled workers', () => {
      const workers: WorkerCandidate[] = [
        worker('carp-a', [STG.carpentry]),
        worker('carp-b', [STG.carpentry]),
        ...Array.from({ length: 48 }, (_, i) => worker(`other-${i}`, [STG.other], { departmentCode: 'PACK' })),
      ];
      const result = forwardSchedule(nOrders(8), ctx(workers));
      assertNoWorkerOverlap(result.allocations);
      expect(employeeIds(result.allocations).sort()).toEqual(['carp-a', 'carp-b']);
      expect(tasksStartingOn(result.allocations, SUN)).toHaveLength(4);
      expect(localYmd(maxEnd(result.allocations))).toBe(MON);
    });

    it('does not fabricate DEPARTMENT capacity when zero workers are skilled', () => {
      const unskilled = Array.from({ length: 50 }, (_, i) =>
        worker(`u-${i}`, [STG.other], { departmentCode: 'CARPENTRY' }),
      );
      expect(() => forwardSchedule(nOrders(3), ctx(unskilled))).toThrow(/NO_ELIGIBLE_WORKER/);
    });
  });

  describe('D — adding skilled workers changes feasibility', () => {
    const requested = amman(2026, 8, 12, 16, 0); // Wednesday EOD — 4 working days
    const heavy = nOrders(20, { requestedDeliveryDate: requested });

    it('is infeasible with 2 carpentry workers and earlier with 4', () => {
      const two = sequentialPlan(heavy, ctx([worker('a', [STG.carpentry]), worker('b', [STG.carpentry])]));
      const four = sequentialPlan(
        heavy,
        ctx([
          worker('a', [STG.carpentry]),
          worker('b', [STG.carpentry]),
          worker('c', [STG.carpentry]),
          worker('d', [STG.carpentry]),
        ]),
      );
      expect(two.results.every((r) => r.requestedDateFeasible)).toBe(false);
      expect(four.results.every((r) => r.requestedDateFeasible)).toBe(true);
      expect(maxEnd(four.allocations).getTime()).toBeLessThan(maxEnd(two.allocations).getTime());
    });
  });

  describe('E — existing workload', () => {
    it('uses only the unbooked worker when three of four are fully occupied', () => {
      const workers = [1, 2, 3, 4].map((n) => worker(`w${n}`, [STG.carpentry]));
      const booked = [
        occupancy('w1', amman(2026, 8, 9, 8, 0), amman(2026, 8, 9, 16, 0), 'busy-1'),
        occupancy('w2', amman(2026, 8, 9, 8, 0), amman(2026, 8, 9, 16, 0), 'busy-2'),
        occupancy('w3', amman(2026, 8, 9, 8, 0), amman(2026, 8, 9, 16, 0), 'busy-3'),
      ];
      const result = forwardSchedule(nOrders(2), ctx(workers, { existingOccupancy: booked }));
      assertNoWorkerOverlap(result.allocations);
      const sunday = tasksStartingOn(result.allocations, SUN);
      expect(sunday).toHaveLength(2);
      expect(employeeIds(sunday)).toEqual(['w4']);
    });
  });

  describe('F — multi-stage bottleneck', () => {
    it('upholstery (2 workers) gates throughput, not the 14-person headcount', () => {
      const mixed: WorkerCandidate[] = [
        ...[1, 2, 3, 4].map((n) => worker(`c${n}`, [STG.carpentry])),
        ...[1, 2].map((n) => worker(`u${n}`, [STG.upholstery])),
        ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => worker(`a${n}`, [STG.assembly])),
      ];
      const allSkilled: WorkerCandidate[] = mixed.map((w, i) =>
        worker(`flex-${i}`, [STG.carpentry, STG.upholstery, STG.assembly]),
      );
      const orders = nOrders(4, { stages: linearCua });
      const bottlenecked = forwardSchedule(orders, ctx(mixed));
      const unconstrained = forwardSchedule(orders, ctx(allSkilled));
      assertNoWorkerOverlap(bottlenecked.allocations);
      const uph = bottlenecked.allocations.filter((a) => a.stageCode === 'UPHOLSTERY');
      expect(employeeIds(uph).every((id) => id.startsWith('u'))).toBe(true);
      expect(employeeIds(uph).length).toBeLessThanOrEqual(2);
      expect(maxEnd(bottlenecked.allocations).getTime()).toBeGreaterThan(
        maxEnd(unconstrained.allocations).getTime(),
      );
    });
  });

  describe('G / H / I — parallel branches', () => {
    const graphOrder = (id: string): PlannerOrderInput => order({ id, stages: forkMergeStages });

    it('G: Foam and Painting overlap when separate workers exist; Upholstery waits for both', () => {
      const workers = [
        worker('carp', [STG.carpentry]),
        worker('foam', [STG.foam]),
        worker('paint', [STG.painting]),
        worker('uph', [STG.upholstery]),
      ];
      const result = forwardSchedule([graphOrder('g1')], ctx(workers));
      const by = new Map(result.allocations.map((a) => [a.stageCode, a]));
      const foam = by.get('FOAM')!;
      const paint = by.get('PAINTING')!;
      const uph = by.get('UPHOLSTERY')!;
      expect(foam.plannedStart.getTime() < paint.plannedEnd.getTime()).toBe(true);
      expect(paint.plannedStart.getTime() < foam.plannedEnd.getTime()).toBe(true);
      expect(uph.plannedStart.getTime()).toBeGreaterThanOrEqual(foam.plannedEnd.getTime());
      expect(uph.plannedStart.getTime()).toBeGreaterThanOrEqual(paint.plannedEnd.getTime());
    });

    it('H: one shared Foam+Painting worker serializes logically parallel work', () => {
      const workers = [
        worker('carp', [STG.carpentry]),
        worker('shared', [STG.foam, STG.painting]),
        worker('uph', [STG.upholstery]),
      ];
      const result = forwardSchedule([graphOrder('h1')], ctx(workers));
      const foam = result.allocations.find((a) => a.stageCode === 'FOAM')!;
      const paint = result.allocations.find((a) => a.stageCode === 'PAINTING')!;
      expect(foam.employeeId).toBe('shared');
      expect(paint.employeeId).toBe('shared');
      expect(
        foam.plannedStart.getTime() < paint.plannedEnd.getTime() &&
          paint.plannedStart.getTime() < foam.plannedEnd.getTime(),
      ).toBe(false);
    });

    it('I: separate branch workers finish earlier than the shared-worker case', () => {
      const shared = forwardSchedule(
        [graphOrder('h1')],
        ctx([
          worker('carp', [STG.carpentry]),
          worker('shared', [STG.foam, STG.painting]),
          worker('uph', [STG.upholstery]),
        ]),
      );
      const split = forwardSchedule(
        [graphOrder('i1')],
        ctx([
          worker('carp', [STG.carpentry]),
          worker('foam', [STG.foam]),
          worker('paint', [STG.painting]),
          worker('uph', [STG.upholstery]),
        ]),
      );
      expect(maxEnd(split.allocations).getTime()).toBeLessThan(maxEnd(shared.allocations).getTime());
    });
  });

  describe('J — requested date far in the future', () => {
    it('backward places ~2-day work near the requested date, not tomorrow morning', () => {
      const calendar = eightHourCalendar();
      const requested = calendar.addWorkingMinutes(NOW, 20 * 8 * 60);
      const stages = [stage('CARPENTRY', STG.carpentry, 8 * 60), stage('FINISH', STG.assembly, 8 * 60, ['CARPENTRY'])];
      const o = order({
        id: 'far',
        requestedDeliveryDate: requested,
        stages,
        bufferMinutes: 0,
      });
      const workers = [worker('w1', [STG.carpentry, STG.assembly])];
      const backward = backwardSchedule([o], ctx(workers, { calendar }));
      const forward = forwardSchedule([o], ctx(workers, { calendar }));
      expect(backward.usedBackward).toBe(true);
      expect(backward.requestedDateFeasible).toBe(true);
      expect(maxEnd(backward.allocations).getTime()).toBeLessThanOrEqual(requested.getTime());
      expect(minStart(backward.allocations).getTime()).toBeGreaterThan(amman(2026, 8, 20).getTime());
      expect(minStart(forward.allocations).getTime()).toBeLessThan(amman(2026, 8, 12).getTime());
    });
  });

  describe('K — requested Friday with busy Wed/Thu', () => {
    const calendar = eightHourCalendar({ workingWeekdays: [1, 2, 3, 4, 5] });
    const now = amman(2026, 8, 10, 8, 0); // Monday
    const requested = amman(2026, 8, 14, 16, 0); // Friday
    const workers = [worker('w1', [STG.carpentry])];
    const o = order({
      id: 'k1',
      requestedDeliveryDate: requested,
      stages: carpentryOnly(8 * 60),
    });

    it('with buffer 0, uses Friday itself when that day is still empty', () => {
      const booked = [
        occupancy('w1', amman(2026, 8, 12, 8, 0), amman(2026, 8, 12, 16, 0), 'wed'),
        occupancy('w1', amman(2026, 8, 13, 8, 0), amman(2026, 8, 13, 16, 0), 'thu'),
      ];
      const result = backwardSchedule([o], ctx(workers, { calendar, now, existingOccupancy: booked }));
      assertNoWorkerOverlap(result.allocations);
      expect(result.requestedDateFeasible).toBe(true);
      expect(localYmd(minStart(result.allocations))).toBe('2026-08-14');
    });

    it('walks earlier when Friday plus Wed/Thu are already full', () => {
      const booked = [
        occupancy('w1', amman(2026, 8, 12, 8, 0), amman(2026, 8, 12, 16, 0), 'wed'),
        occupancy('w1', amman(2026, 8, 13, 8, 0), amman(2026, 8, 13, 16, 0), 'thu'),
        occupancy('w1', amman(2026, 8, 14, 8, 0), amman(2026, 8, 14, 16, 0), 'fri'),
      ];
      const result = backwardSchedule([o], ctx(workers, { calendar, now, existingOccupancy: booked }));
      assertNoWorkerOverlap(result.allocations);
      expect(result.requestedDateFeasible).toBe(true);
      expect(localYmd(minStart(result.allocations))).toBe('2026-08-11');
      expect(localYmd(maxEnd(result.allocations))).toBe('2026-08-11');
    });
  });

  describe('L — impossible requested date', () => {
    it('sets requestedDateFeasible false and still returns a forward earliest completion', () => {
      const requested = amman(2026, 8, 9, 12, 0);
      const o = order({
        id: 'late',
        requestedDeliveryDate: requested,
        stages: carpentryOnly(3 * 8 * 60),
      });
      const result = backwardSchedule([o], ctx([worker('w1', [STG.carpentry])]));
      expect(result.requestedDateFeasible).toBe(false);
      expect(result.usedBackward).toBe(false);
      expect(result.earliestCompletion).not.toBeNull();
      expect(result.earliestCompletion!.getTime()).toBeGreaterThan(requested.getTime());
    });
  });

  describe('M — earliest available / no requested date', () => {
    it('places from now when no date is set; usedBackward is false', () => {
      const result = forwardSchedule(nOrders(1), ctx([worker('w1', [STG.carpentry])]));
      expect(result.usedBackward).toBe(false);
      expect(result.planningMode).toBe('FORWARD');
      expect(localYmd(minStart(result.allocations))).toBe(SUN);
      const mixed = backwardSchedule(
        [order({ id: 'no-date' })],
        ctx([worker('w1', [STG.carpentry])]),
      );
      expect(mixed.usedBackward).toBe(false);
      expect(mixed.planningMode).toBe('FORWARD');
      expect(localYmd(minStart(mixed.allocations))).toBe(SUN);
    });
  });

  describe('N — quantity scaling', () => {
    it('LINEAR duration scales qty 1 vs 10 and the planner consumes the scaled minutes', () => {
      expect(
        calculateDurationMinutes({ quantityScalingMode: 'LINEAR', quantity: 1, minutesPerUnit: 60 }),
      ).toBe(60);
      expect(
        calculateDurationMinutes({ quantityScalingMode: 'LINEAR', quantity: 10, minutesPerUnit: 60 }),
      ).toBe(600);
      expect(
        calculateDurationMinutes({ quantityScalingMode: 'FIXED', quantity: 10, fixedMinutes: 45 }),
      ).toBe(45);

      const w = [worker('w1', [STG.carpentry])];
      const qty1 = forwardSchedule(
        [order({ id: 'q1', stages: carpentryOnly(60) })],
        ctx(w),
      );
      const qty10 = forwardSchedule(
        [order({ id: 'q10', stages: carpentryOnly(600) })],
        ctx(w),
      );
      expect(qty1.allocations[0]!.estimatedMinutes).toBe(60);
      expect(qty10.allocations[0]!.estimatedMinutes).toBe(600);
      expect(qty10.allocations[0]!.plannedEnd.getTime() - qty10.allocations[0]!.plannedStart.getTime()).toBeGreaterThan(
        qty1.allocations[0]!.plannedEnd.getTime() - qty1.allocations[0]!.plannedStart.getTime(),
      );
    });
  });

  describe('O — working hours', () => {
    it('a 10h task spills into the next working day instead of 08:00–18:00', () => {
      const result = forwardSchedule(
        [order({ id: 'long', stages: carpentryOnly(10 * 60) })],
        ctx([worker('w1', [STG.carpentry])]),
      );
      const a = result.allocations[0]!;
      expect(localYmd(a.plannedStart)).toBe(SUN);
      expect(localHour(a.plannedStart)).toBe(8);
      expect(localYmd(a.plannedEnd)).toBe(MON);
      expect(localHour(a.plannedEnd)).toBe(10);
    });
  });

  describe('P — closed days / holidays', () => {
    it('does not start work on a HOLIDAY; backward skips the closed day', () => {
      const calendar = eightHourCalendar({
        exceptions: [{ date: amman(2026, 8, 9, 12, 0), type: 'HOLIDAY' }],
      });
      const forward = forwardSchedule(
        [order({ id: 'p1', stages: carpentryOnly(240) })],
        ctx([worker('w1', [STG.carpentry])], { calendar }),
      );
      expect(localYmd(minStart(forward.allocations))).toBe(MON);

      const calendar2 = eightHourCalendar({
        exceptions: [{ date: amman(2026, 8, 11, 12, 0), type: 'SHUTDOWN' }],
      });
      const requested = amman(2026, 8, 12, 16, 0);
      const backward = backwardSchedule(
        [
          order({
            id: 'p2',
            requestedDeliveryDate: requested,
            stages: carpentryOnly(8 * 60),
          }),
        ],
        ctx([worker('w1', [STG.carpentry])], { calendar: calendar2 }),
      );
      expect(backward.requestedDateFeasible).toBe(true);
      for (const a of backward.allocations) {
        expect(localYmd(a.plannedStart)).not.toBe('2026-08-11');
        expect(localYmd(a.plannedEnd)).not.toBe('2026-08-11');
      }
    });
  });

  describe('Q — material readiness (domain)', () => {
    it('delays start until materialReadyAt when the planner is given the date', () => {
      const ready = amman(2026, 8, 12, 8, 0);
      const result = forwardSchedule(
        [order({ id: 'mat', materialReadyAt: ready })],
        ctx([worker('w1', [STG.carpentry])]),
      );
      expect(minStart(result.allocations).getTime()).toBeGreaterThanOrEqual(ready.getTime());
      const risk = assessMaterialReadiness({ woodUnits: 10 }, { woodUnits: { available: 0 } });
      expect(risk.ready).toBe(false);
      expect(risk.risk).toBe(true);
      expect(risk.materialReadyAt).toBeNull();
    });
  });

  describe('R — WIP readiness (domain)', () => {
    it('order-level productionReadyAt still delays the whole job when set', () => {
      const ready = amman(2026, 8, 12, 8, 0);
      const result = forwardSchedule(
        [order({ id: 'wip', productionReadyAt: ready, stages: linearCua })],
        ctx([
          worker('c', [STG.carpentry]),
          worker('u', [STG.upholstery]),
          worker('a', [STG.assembly]),
        ]),
      );
      expect(minStart(result.allocations).getTime()).toBeGreaterThanOrEqual(ready.getTime());
    });
  });

  describe('S / T — deactivate and add workers', () => {
    it('S: inactive workers are not allocated; remaining capacity shrinks', () => {
      const activeTwo = [worker('a', [STG.carpentry]), worker('b', [STG.carpentry])];
      const afterDeactivate = [worker('a', [STG.carpentry]), worker('b', [STG.carpentry], { isActive: false })];
      const orders = nOrders(4);
      const before = forwardSchedule(orders, ctx(activeTwo));
      const after = forwardSchedule(orders, ctx(afterDeactivate));
      expect(employeeIds(after.allocations)).toEqual(['a']);
      expect(maxEnd(after.allocations).getTime()).toBeGreaterThan(maxEnd(before.allocations).getTime());
    });

    it('T: adding a skilled worker increases same-day capacity', () => {
      const one = forwardSchedule(nOrders(4), ctx([worker('a', [STG.carpentry])]));
      const two = forwardSchedule(
        nOrders(4),
        ctx([worker('a', [STG.carpentry]), worker('b', [STG.carpentry])]),
      );
      expect(tasksStartingOn(one.allocations, SUN)).toHaveLength(2);
      expect(tasksStartingOn(two.allocations, SUN)).toHaveLength(4);
    });
  });

  describe('U — 50-worker mixed factory', () => {
    it('distributes by skill, respects deps, and never double-books', () => {
      const workers: WorkerCandidate[] = [
        ...Array.from({ length: 10 }, (_, i) => worker(`carp-${i}`, [STG.carpentry])),
        ...Array.from({ length: 8 }, (_, i) => worker(`foam-${i}`, [STG.foam])),
        ...Array.from({ length: 6 }, (_, i) => worker(`paint-${i}`, [STG.painting])),
        ...Array.from({ length: 12 }, (_, i) => worker(`uph-${i}`, [STG.upholstery])),
        ...Array.from({ length: 8 }, (_, i) => worker(`asm-${i}`, [STG.assembly])),
        ...Array.from({ length: 6 }, (_, i) => worker(`oth-${i}`, [STG.other])),
      ];
      const orders: PlannerOrderInput[] = [
        ...nOrders(3, { prefix: 'a', customerId: 'dealer-a', stages: linearCua }),
        ...nOrders(3, { prefix: 'b', customerId: 'dealer-b', stages: forkMergeStages }),
        ...nOrders(2, { prefix: 'c', customerId: 'dealer-c', stages: carpentryOnly(240) }),
      ];
      const result = forwardSchedule(orders, ctx(workers));
      assertNoWorkerOverlap(result.allocations);
      expect(employeeIds(result.allocations).some((id) => id.startsWith('oth-'))).toBe(false);
      for (const o of orders.filter((x) => x.stages === linearCua || x.id.startsWith('a'))) {
        const mine = result.allocations.filter((a) => a.orderId === o.id);
        if (mine.some((a) => a.stageCode === 'UPHOLSTERY')) {
          const c = mine.find((a) => a.stageCode === 'CARPENTRY')!;
          const u = mine.find((a) => a.stageCode === 'UPHOLSTERY')!;
          const asm = mine.find((a) => a.stageCode === 'ASSEMBLY')!;
          expect(u.plannedStart.getTime()).toBeGreaterThanOrEqual(c.plannedEnd.getTime());
          expect(asm.plannedStart.getTime()).toBeGreaterThanOrEqual(u.plannedEnd.getTime());
        }
      }
    });
  });

  describe('V — multiple dealers / same requested date', () => {
    it('sequential generate consumes capacity so later orders can miss the shared date', () => {
      const requested = amman(2026, 8, 10, 16, 0); // Monday EOD — 2 working days
      const workers = [worker('w1', [STG.carpentry]), worker('w2', [STG.carpentry])];
      const a = nOrders(5, { prefix: 'A', customerId: 'dealer-a', requestedDeliveryDate: requested });
      const b = nOrders(8, { prefix: 'B', customerId: 'dealer-b', requestedDeliveryDate: requested });
      const c = nOrders(3, {
        prefix: 'C',
        customerId: 'dealer-c',
        requestedDeliveryDate: amman(2026, 8, 9, 16, 0),
      });
      const planned = sequentialPlan([...a, ...b, ...c], ctx(workers));
      assertNoWorkerOverlap(planned.allocations);
      const feasible = planned.results.filter((r) => r.requestedDateFeasible).length;
      const infeasible = planned.results.filter((r) => !r.requestedDateFeasible).length;
      expect(feasible).toBeGreaterThan(0);
      expect(infeasible).toBeGreaterThan(0);
    });
  });

  describe('W — priority / sequence', () => {
    it('tie-breaks pinned → priority → committed → requested → createdAt → id; batch interleaves dealers', () => {
      const items: PrioritySortItem[] = [
        {
          id: 'a2',
          customerId: 'A',
          isPinned: false,
          priority: 'NORMAL',
          createdAt: new Date('2026-08-01T02:00:00.000Z'),
        },
        {
          id: 'b1',
          customerId: 'B',
          isPinned: false,
          priority: 'NORMAL',
          createdAt: new Date('2026-08-01T01:00:00.000Z'),
        },
        {
          id: 'a1',
          customerId: 'A',
          isPinned: false,
          priority: 'NORMAL',
          createdAt: new Date('2026-08-01T01:00:00.000Z'),
        },
        {
          id: 'urgent',
          customerId: 'C',
          isPinned: false,
          priority: 'URGENT',
          createdAt: new Date('2026-08-01T03:00:00.000Z'),
        },
        {
          id: 'pinned',
          customerId: 'A',
          isPinned: true,
          priority: 'LOW',
          createdAt: new Date('2026-08-01T04:00:00.000Z'),
        },
      ];
      expect(sortWithFairness(items).map((x) => x.id)).toEqual(['pinned', 'urgent', 'a1', 'b1', 'a2']);
    });
  });

  describe('X — manual occupancy is respected', () => {
    it('does not overwrite a reserved slot from another order', () => {
      const workers = [worker('w1', [STG.carpentry])];
      const manual = [
        occupancy('w1', amman(2026, 8, 9, 8, 0), amman(2026, 8, 9, 12, 0), 'manual-slot'),
      ];
      const result = forwardSchedule(nOrders(1), ctx(workers, { existingOccupancy: manual }));
      const a = result.allocations[0]!;
      expect(a.plannedStart.getTime()).toBeGreaterThanOrEqual(amman(2026, 8, 9, 12, 0).getTime());
    });
  });

  describe('Y — late task / replan (domain cannot auto-replan)', () => {
    it('planner has no late-complete hook; a longer actual duration only applies if re-invoked', () => {
      const workers = [worker('w1', [STG.carpentry]), worker('w2', [STG.assembly])];
      const planned = forwardSchedule(
        [order({ id: 'y1', stages: [stage('CARPENTRY', STG.carpentry, 240), stage('ASSEMBLY', STG.assembly, 120, ['CARPENTRY'])] })],
        ctx(workers),
      );
      const carp = planned.allocations.find((a) => a.stageCode === 'CARPENTRY')!;
      const lateEnd = new Date(carp.plannedEnd.getTime() + 4 * 60 * 60 * 1000);
      const replanned = forwardSchedule(
        [
          order({
            id: 'y1',
            stages: [
              {
                ...stage('CARPENTRY', STG.carpentry, 240),
                isPinned: true,
                pinnedStart: carp.plannedStart,
                pinnedEnd: lateEnd,
                preferredEmployeeId: carp.employeeId,
              },
              stage('ASSEMBLY', STG.assembly, 120, ['CARPENTRY']),
            ],
          }),
        ],
        ctx(workers),
      );
      const asm = replanned.allocations.find((a) => a.stageCode === 'ASSEMBLY')!;
      expect(asm.plannedStart.getTime()).toBeGreaterThanOrEqual(lateEnd.getTime());
    });
  });

  describe('Z — requested date + capacity + parallelism', () => {
    it('decides feasibility from remaining worker slots on a fork-merge job', () => {
      const requested = amman(2026, 8, 11, 16, 0); // Tuesday EOD
      const workers = [
        worker('carp', [STG.carpentry]),
        worker('foam', [STG.foam]),
        worker('paint', [STG.painting]),
        worker('uph', [STG.upholstery]),
      ];
      const booked = [
        occupancy('foam', amman(2026, 8, 9, 8, 0), amman(2026, 8, 10, 16, 0), 'foam-busy'),
      ];
      const o = order({
        id: 'z1',
        requestedDeliveryDate: requested,
        stages: forkMergeStages,
      });
      const result = backwardSchedule([o], ctx(workers, { existingOccupancy: booked }));
      assertNoWorkerOverlap(result.allocations);
      const by = new Map(result.allocations.map((a) => [a.stageCode, a]));
      expect(by.get('UPHOLSTERY')!.plannedStart.getTime()).toBeGreaterThanOrEqual(
        Math.max(by.get('FOAM')!.plannedEnd.getTime(), by.get('PAINTING')!.plannedEnd.getTime()),
      );
      expect(typeof result.requestedDateFeasible).toBe('boolean');
      expect(result.earliestCompletion).not.toBeNull();
    });
  });

  describe('AA — finite shared resource slots', () => {
    it('never overlaps a single-slot RESOURCE_CONSTRAINED stage', () => {
      const stageDef = STG.carpentry;
      const orders = nOrders(3, {
        stages: [
          {
            ...stage('CNC', stageDef, 240),
            schedulingResourceMode: 'RESOURCE_CONSTRAINED',
            resourceSlots: 1,
          },
        ],
      });
      const result = forwardSchedule(orders, ctx([]));
      expect(result.allocations).toHaveLength(3);
      const sorted = [...result.allocations].sort((a, b) => a.plannedStart.getTime() - b.plannedStart.getTime());
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i]!.plannedStart.getTime()).toBeGreaterThanOrEqual(sorted[i - 1]!.plannedEnd.getTime());
      }
      expect(sorted.every((a) => a.employeeId === null && a.resourceSlot === 0)).toBe(true);
    });

    it('fails closed when RESOURCE_CONSTRAINED has zero slots', () => {
      expect(() =>
        forwardSchedule(
          nOrders(1, {
            stages: [
              {
                ...stage('CNC', STG.carpentry, 60),
                schedulingResourceMode: 'RESOURCE_CONSTRAINED',
                resourceSlots: 0,
              },
            ],
          }),
          ctx([]),
        ),
      ).toThrow(/NO_RESOURCE_CAPACITY/);
    });
  });

  describe('AB — delivery buffer keeps production off the delivery day', () => {
    it('backward target uses latestCompletionTarget (previous working day)', () => {
      const calendar = eightHourCalendar();
      const requested = amman(2026, 8, 12, 16, 0); // Wednesday
      const latest = calendar.latestProductionCompletion(requested, 1);
      expect(localYmd(latest)).toBe('2026-08-11');
      const result = backwardSchedule(
        [
          order({
            id: 'buf',
            requestedDeliveryDate: requested,
            latestCompletionTarget: latest,
            bufferMinutes: 0,
          }),
        ],
        ctx([worker('w1', [STG.carpentry])]),
      );
      expect(result.planningMode).toBe('BACKWARD');
      expect(maxEnd(result.allocations).getTime()).toBeLessThanOrEqual(latest.getTime());
    });
  });
});
