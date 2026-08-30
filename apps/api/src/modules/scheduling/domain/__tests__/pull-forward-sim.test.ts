import { inventorySkuKey } from '../material-readiness';
import {
  applyNDayFloor,
  attachEmptyDayCauses,
  classifyEmptyDay,
  prepareOrderForForward,
  simulatePolicy,
  sortPullForwardOrders,
  stageStartLegalForMaterials,
  type SimOrderInput,
  type SimWorld,
} from '../pull-forward-sim';
import { ymdInTimezone } from '../factory-replan';
import type { PlannerStageInput, WorkerCandidate } from '../types';
import {
  STG,
  amman,
  eightHourCalendar,
  localYmd,
  worker,
} from './scheduling-capacity-uat.fixtures';

const TZ = 'Asia/Amman';
const NOW = amman(2026, 8, 16, 8, 0);
const VELVET = inventorySkuKey('MAT-ITAL-VEL');

function carpentryUpholstery(mins = 240): PlannerStageInput[] {
  return [
    {
      code: 'CARPENTRY',
      stageDefinitionId: STG.carpentry,
      dependsOnCodes: [],
      estimatedMinutes: mins,
      departmentCode: 'CARPENTRY',
    },
    {
      code: 'UPHOLSTERY',
      stageDefinitionId: STG.upholstery,
      dependsOnCodes: ['CARPENTRY'],
      estimatedMinutes: mins,
      departmentCode: 'UPHOL',
    },
  ];
}

function baseOrder(
  partial: Partial<SimOrderInput> & Pick<SimOrderInput, 'id'>,
): SimOrderInput {
  return {
    customerId: 'cust-a',
    priority: 'NORMAL',
    createdAt: amman(2026, 8, 1, 8, 0),
    required: {},
    consumingStageCodes: [],
    creditOwnReservation: false,
    wipNodes: [],
    wipLots: [],
    orderQty: 1,
    stages: carpentryUpholstery(120),
    currentAllocations: [],
    ...partial,
  };
}

function world(overrides: Partial<SimWorld> = {}): SimWorld {
  const rana: WorkerCandidate = worker('rana', [STG.carpentry, STG.upholstery], {
    departmentCode: 'CARPENTRY',
  });
  const layla: WorkerCandidate = worker('layla', [STG.upholstery], {
    departmentCode: 'UPHOL',
  });
  return {
    calendar: eightHourCalendar(),
    workers: [rana, layla],
    now: NOW,
    inventory: {},
    orders: [],
    stages: [
      {
        stageDefinitionId: STG.carpentry,
        code: 'CARPENTRY',
        skilledWorkerCount: 1,
      },
      {
        stageDefinitionId: STG.upholstery,
        code: 'UPHOLSTERY',
        skilledWorkerCount: 2,
      },
    ],
    ...overrides,
  };
}

describe('applyNDayFloor', () => {
  it('never sets notBefore before the scheduling floor', () => {
    const cal = eightHourCalendar();
    const stages = carpentryUpholstery(120);
    const target = amman(2026, 8, 30, 16, 0);
    const floor = amman(2026, 8, 22, 14, 0);
    const out = applyNDayFloor(stages, cal, target, 20, floor);
    for (const stage of out) {
      expect(stage.notBefore?.getTime() ?? 0).toBeGreaterThanOrEqual(floor.getTime());
    }
  });
});

describe('pull-forward-sim materials', () => {
  it('does not place upholstery before velvet readyAt when only UPHOLSTERY consumes raw', () => {
    const ready = amman(2026, 9, 18, 8, 0);
    const order = baseOrder({
      id: 'cedar',
      required: { [VELVET]: 8 },
      consumingStageCodes: ['UPHOLSTERY'],
      requestedDeliveryDate: amman(2026, 9, 30, 8, 0),
    });
    const sim = world({
      inventory: {
        [VELVET]: {
          available: 0,
          reserved: 0,
          incoming: [{ qty: 24, readyAt: ready }],
        },
      },
      orders: [order],
    });
    const earliest = simulatePolicy(sim, 'EARLIEST');
    const uph = earliest.allocations.find((a) => a.stageCode === 'UPHOLSTERY');
    const carp = earliest.allocations.find((a) => a.stageCode === 'CARPENTRY');
    expect(uph).toBeTruthy();
    expect(carp).toBeTruthy();
    expect(uph!.plannedStart.getTime()).toBeGreaterThanOrEqual(ready.getTime());
    expect(carp!.plannedStart.getTime()).toBeLessThan(ready.getTime());
    expect(
      stageStartLegalForMaterials({
        plannedStart: uph!.plannedStart,
        stageCode: 'UPHOLSTERY',
        consumingStageCodes: ['UPHOLSTERY'],
        materialReadyAt: ready,
      }),
    ).toBe(true);
    expect(earliest.materialViolations).toBe(0);
  });

  it('floors the whole order when no consumingStageCodes exist', () => {
    const ready = amman(2026, 9, 18, 8, 0);
    const order = baseOrder({
      id: 'whole',
      required: { [VELVET]: 8 },
      consumingStageCodes: [],
    });
    const sim = world({
      inventory: {
        [VELVET]: {
          available: 0,
          reserved: 0,
          incoming: [{ qty: 24, readyAt: ready }],
        },
      },
      orders: [order],
    });
    const earliest = simulatePolicy(sim, 'EARLIEST');
    const carp = earliest.allocations.find((a) => a.stageCode === 'CARPENTRY');
    expect(carp!.plannedStart.getTime()).toBeGreaterThanOrEqual(ready.getTime());
  });

  it('refuses both 70m and 60m against 100m free — second waits', () => {
    const fabric = inventorySkuKey('FABRIC-X');
    const a = baseOrder({
      id: 'a',
      committedDeliveryDate: amman(2026, 8, 20, 8, 0),
      required: { [fabric]: 70 },
      consumingStageCodes: ['UPHOLSTERY'],
      primaryStatus: 'ON_TRACK',
    });
    const b = baseOrder({
      id: 'b',
      requestedDeliveryDate: amman(2026, 9, 20, 8, 0),
      required: { [fabric]: 60 },
      consumingStageCodes: ['UPHOLSTERY'],
    });
    const sim = world({
      inventory: { [fabric]: { available: 100, reserved: 0, incoming: [] } },
      orders: [a, b],
    });
    const earliest = simulatePolicy(sim, 'EARLIEST');
    const ra = earliest.orders.find((o) => o.orderId === 'a')!;
    const rb = earliest.orders.find((o) => o.orderId === 'b')!;
    expect(ra.placed).toBe(true);
    expect(rb.placed).toBe(false);
    expect(rb.blockReason).toBe('SCARCE_MATERIAL_HELD_FOR_HIGHER_PRIORITY');
  });

  it('credits this order reservation so generate-equivalent readiness is true', () => {
    const fabric = inventorySkuKey('FABRIC-X');
    const order = baseOrder({
      id: 'reserved',
      required: { [fabric]: 70 },
      consumingStageCodes: ['UPHOLSTERY'],
      creditOwnReservation: true,
    });
    const prepared = prepareOrderForForward(
      order,
      { [fabric]: { available: 30, reserved: 70, incoming: [] } },
      eightHourCalendar(),
    );
    expect(prepared.materialReady).toBe(true);
    expect(prepared.blockReason).toBeNull();
  });

  it('does not move pinned or IN_PROGRESS stages', () => {
    const pinStart = amman(2026, 9, 25, 8, 0);
    const pinEnd = amman(2026, 9, 25, 12, 0);
    const order = baseOrder({
      id: 'pinned',
      stages: carpentryUpholstery(120),
      currentAllocations: [
        {
          stageCode: 'CARPENTRY',
          stageDefinitionId: STG.carpentry,
          plannedStart: pinStart,
          plannedEnd: pinEnd,
          employeeId: 'rana',
          isPinned: true,
          estimatedMinutes: 120,
        },
      ],
    });
    const sim = world({ orders: [order] });
    const earliest = simulatePolicy(sim, 'EARLIEST');
    const carp = earliest.allocations.find((a) => a.stageCode === 'CARPENTRY')!;
    expect(carp.plannedStart.getTime()).toBe(pinStart.getTime());
    expect(carp.isPinned).toBe(true);
  });
});

describe('pull-forward-sim priority', () => {
  it('sorts late committed before later requested', () => {
    const late = baseOrder({
      id: 'late',
      primaryStatus: 'LATE',
      committedDeliveryDate: amman(2026, 8, 20, 8, 0),
    });
    const requested = baseOrder({
      id: 'req',
      requestedDeliveryDate: amman(2026, 9, 20, 8, 0),
    });
    expect(sortPullForwardOrders([requested, late]).map((o) => o.id)).toEqual(['late', 'req']);
  });
});

describe('pull-forward-sim 50-order comparison', () => {
  function fiftyWorld(): SimWorld {
    const rana = worker('rana', [STG.carpentry]);
    const orders: SimOrderInput[] = [];
    for (let i = 0; i < 50; i += 1) {
      const due = amman(2026, 9, 24, 8, 0);
      const packedStart = amman(2026, 9, 20 + Math.floor(i / 8), 8, 0);
      const packedEnd = new Date(packedStart.getTime() + 60 * 60_000);
      orders.push(
        baseOrder({
          id: `o${String(i).padStart(2, '0')}`,
          requestedDeliveryDate: due,
          latestCompletionTarget: due,
          stages: [
            {
              code: 'CARPENTRY',
              stageDefinitionId: STG.carpentry,
              dependsOnCodes: [],
              estimatedMinutes: 60,
              departmentCode: 'CARPENTRY',
            },
          ],
          currentAllocations: [
            {
              stageCode: 'CARPENTRY',
              stageDefinitionId: STG.carpentry,
              plannedStart: packedStart,
              plannedEnd: packedEnd,
              employeeId: 'rana',
              isPinned: false,
              estimatedMinutes: 60,
            },
          ],
        }),
      );
    }
    return world({
      workers: [rana],
      orders,
      stages: [{ stageDefinitionId: STG.carpentry, code: 'CARPENTRY', skilledWorkerCount: 1 }],
    });
  }

  it('EARLIEST fills more early idle days than CURRENT without material violations', () => {
    const sim = fiftyWorld();
    const current = simulatePolicy(sim, 'CURRENT');
    const earliest = simulatePolicy(sim, 'EARLIEST');
    const ten = simulatePolicy(sim, 'N_DAY', 10);
    const tagged = attachEmptyDayCauses(current, earliest, sim);

    expect(earliest.materialViolations).toBe(0);
    expect(ten.materialViolations).toBe(0);
    expect(earliest.emptyDays).toBeLessThan(current.emptyDays);
    expect(earliest.avgOccupancyUtilPct).toBeGreaterThan(current.avgOccupancyUtilPct);
    expect(ten.emptyDays).toBeGreaterThanOrEqual(earliest.emptyDays);
    expect(tagged.days.some((d) => d.cause === 'CAPACITY_POLICY')).toBe(true);

    const firstCurrent = current.days[0]!;
    const firstEarliest = earliest.days[0]!;
    expect(firstCurrent.occupancyAllocatedMinutes).toBe(0);
    expect(firstEarliest.occupancyAllocatedMinutes).toBeGreaterThan(0);
  });
});

describe('classifyEmptyDay', () => {
  it('tags MATERIAL_ETA when work is ready only after incoming', () => {
    const currentDay = {
      ymd: '2026-08-17',
      open: true,
      overtime: false,
      shiftMinutes: 480,
      occupancyAvailableMinutes: 480,
      occupancyAllocatedMinutes: 0,
      occupancyUtilPct: 0,
      stageBucketAvailableMinutes: 480,
      stageBucketAllocatedMinutes: 0,
      stageBucketUtilPct: 0,
      allocationCount: 0,
      distinctOrders: 0,
      stageBreakdown: [],
      bucket: 'EMPTY' as const,
      cause: null,
    };
    const w = world({
      inventory: {
        [VELVET]: {
          available: 0,
          reserved: 0,
          incoming: [{ qty: 24, readyAt: amman(2026, 9, 18, 8, 0) }],
        },
      },
      orders: [
        baseOrder({
          id: 'cedar',
          required: { [VELVET]: 8 },
          consumingStageCodes: ['UPHOLSTERY'],
        }),
      ],
    });
    const cause = classifyEmptyDay({
      current: currentDay,
      orderResults: [
        {
          orderId: 'cedar',
          placed: true,
          blockReason: null,
          materialReadyAt: amman(2026, 9, 18, 8, 0),
          materialReady: false,
          materialRisk: false,
          scarceHeld: false,
          earliestCompletion: amman(2026, 9, 20, 8, 0),
          currentCompletion: amman(2026, 9, 28, 8, 0),
          allocations: [],
          skippedStages: [],
        },
      ],
      world: w,
    });
    expect(cause).toBe('MATERIAL_ETA');
    expect(ymdInTimezone(NOW, TZ)).toBe('2026-08-16');
    expect(localYmd(NOW)).toBe('2026-08-16');
  });
});
