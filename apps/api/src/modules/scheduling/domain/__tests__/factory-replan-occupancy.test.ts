/**
 * Sequential factory-replan occupancy (orchestration-style). Does not change the planner.
 */
import { CapacityTracker } from '../capacity';
import {
  findOccupancyCollisions,
  occupancyFromGeneratedAllocations,
  plannedAllocationsToOccupancy,
  stripOccupancyForOrder,
  unionOccupancyIntervals,
} from '../factory-replan';
import { resourceCapacityKey } from '../schedule-planner';
import type { OccupancyInterval, PlannerOrderInput } from '../types';
import {
  amman,
  assertNoWorkerOverlap,
  carpentryOnly,
  ctx,
  nOrders,
  occupancy,
  sequentialPlan,
  stage,
  STG,
  worker,
} from './scheduling-capacity-uat.fixtures';

function assertNoResourceOverlap(
  allocations: Array<{ orderId: string; stageDefinitionId: string; resourceSlot?: number | null; plannedStart: Date; plannedEnd: Date }>,
) {
  const booked = allocations.filter((a) => a.resourceSlot != null);
  for (let i = 0; i < booked.length; i += 1) {
    for (let j = i + 1; j < booked.length; j += 1) {
      const a = booked[i]!;
      const b = booked[j]!;
      if (a.stageDefinitionId !== b.stageDefinitionId || a.resourceSlot !== b.resourceSlot) continue;
      if (a.plannedStart.getTime() < b.plannedEnd.getTime() && b.plannedStart.getTime() < a.plannedEnd.getTime()) {
        throw new Error(
          `Resource ${a.stageDefinitionId}:${a.resourceSlot} overlap ${a.orderId} vs ${b.orderId}`,
        );
      }
    }
  }
}

/** Mirror processFactoryReplan: union seed, strip current PO, validate, accept onto shared occupancy. */
function sequentialFactoryOccupancy(
  orders: PlannerOrderInput[],
  base: ReturnType<typeof ctx>,
) {
  let occupancyAcc: OccupancyInterval[] = unionOccupancyIntervals(base.existingOccupancy ?? []);
  const allocations: ReturnType<typeof sequentialPlan>['allocations'] = [];
  let skipped = 0;
  const occupancyPassed: OccupancyInterval[][] = [];

  for (const o of orders) {
    const occupancyForPo = unionOccupancyIntervals(stripOccupancyForOrder(occupancyAcc, o.id));
    occupancyPassed.push(occupancyForPo);
    const result = sequentialPlan([o], { ...base, existingOccupancy: occupancyForPo }, 'forward');
    const candidateOcc = plannedAllocationsToOccupancy(o.id, result.allocations);
    const collisions = findOccupancyCollisions(occupancyForPo, candidateOcc);
    if (collisions.length > 0) {
      skipped += 1;
      continue;
    }
    allocations.push(...result.allocations);
    occupancyAcc = unionOccupancyIntervals([
      ...stripOccupancyForOrder(occupancyAcc, o.id),
      ...candidateOcc,
    ]);
  }

  return { allocations, skipped, occupancyAcc, occupancyPassed };
}

describe('factory replan sequential occupancy', () => {
  it('union occupancy blocks the hole CapacityTracker tryReserve would drop', () => {
    const w1 = worker('w1', [STG.carpentry]);
    const seed = [
      occupancy('w1', amman(2026, 8, 10, 8, 0), amman(2026, 8, 10, 12, 0), 'a'),
      occupancy('w1', amman(2026, 8, 10, 10, 0), amman(2026, 8, 10, 16, 0), 'b'),
    ];
    const now = amman(2026, 8, 10, 8, 0);
    const holeTracker = new CapacityTracker(seed);
    expect(holeTracker.hasOverlap('w1', amman(2026, 8, 10, 12, 0), amman(2026, 8, 10, 13, 0))).toBe(false);

    const merged = unionOccupancyIntervals(seed);
    const withUnion = sequentialPlan(
      nOrders(1, { stages: carpentryOnly(60) }),
      ctx([w1], { existingOccupancy: merged, now }),
      'forward',
    );
    expect(withUnion.allocations[0]!.plannedStart.getTime()).toBeGreaterThanOrEqual(
      amman(2026, 8, 10, 16, 0).getTime(),
    );
  });

  it('sequential 40 orders on shared workers do not overlap', () => {
    const workers = [
      worker('w1', [STG.carpentry]),
      worker('w2', [STG.carpentry]),
    ];
    const orders = nOrders(40, { stages: carpentryOnly(60) });
    const { allocations, skipped } = sequentialFactoryOccupancy(orders, ctx(workers));
    expect(skipped).toBe(0);
    expect(allocations.length).toBe(40);
    assertNoWorkerOverlap(allocations);
  });

  it('one worker / 8h / many tasks serializes without overlap', () => {
    const workers = [worker('w1', [STG.carpentry])];
    const orders = nOrders(16, { stages: carpentryOnly(60) });
    const { allocations } = sequentialFactoryOccupancy(orders, ctx(workers));
    assertNoWorkerOverlap(allocations);
    const sorted = [...allocations].sort((a, b) => a.plannedStart.getTime() - b.plannedStart.getTime());
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i]!.plannedStart.getTime()).toBeGreaterThanOrEqual(sorted[i - 1]!.plannedEnd.getTime());
    }
  });

  it('several workers have no per-worker overlap', () => {
    const workers = [
      worker('w1', [STG.carpentry]),
      worker('w2', [STG.carpentry]),
      worker('w3', [STG.carpentry]),
    ];
    const { allocations } = sequentialFactoryOccupancy(
      nOrders(30, { stages: carpentryOnly(120) }),
      ctx(workers),
    );
    assertNoWorkerOverlap(allocations);
  });

  it('RESOURCE_CONSTRAINED slot occupancy is carried across sequential candidates', () => {
    const cnc = {
      ...stage('CNC', STG.carpentry, 240),
      schedulingResourceMode: 'RESOURCE_CONSTRAINED' as const,
      resourceSlots: 1,
    };
    const orders = nOrders(2, { stages: [cnc] });
    const { allocations, occupancyPassed } = sequentialFactoryOccupancy(orders, ctx([]));
    expect(allocations).toHaveLength(2);
    assertNoResourceOverlap(allocations);
    const resourceKey = resourceCapacityKey(STG.carpentry, 0);
    expect(occupancyPassed[1]!.some((iv) => iv.employeeId === resourceKey)).toBe(true);
    const sorted = [...allocations].sort((a, b) => a.plannedStart.getTime() - b.plannedStart.getTime());
    expect(sorted[1]!.plannedStart.getTime()).toBeGreaterThanOrEqual(sorted[0]!.plannedEnd.getTime());
  });

  it('validate-before-accept skips persist when the candidate still collides', () => {
    const w1 = worker('w1', [STG.carpentry]);
    const booked = occupancyFromGeneratedAllocations('po-seed', [
      {
        id: 'seed',
        employeeId: 'w1',
        plannedStart: amman(2026, 8, 10, 8, 0),
        plannedEnd: amman(2026, 8, 10, 16, 0),
      },
    ]);
    const colliding = occupancyFromGeneratedAllocations('po-new', [
      {
        id: 'new',
        employeeId: 'w1',
        plannedStart: amman(2026, 8, 10, 9, 0),
        plannedEnd: amman(2026, 8, 10, 10, 0),
      },
    ]);
    expect(findOccupancyCollisions(booked, colliding).length).toBeGreaterThan(0);
    const tracker = new CapacityTracker([]);
    for (const iv of booked) tracker.forceReserve(iv);
    expect(tracker.hasOverlap('w1', colliding[0]!.start, colliding[0]!.end)).toBe(true);
  });
});
