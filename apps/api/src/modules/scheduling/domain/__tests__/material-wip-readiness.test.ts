import { bomReservationNeeds } from '../../../../common/helpers/inventory-reservation.util';
import { detectConflicts } from '../conflict-detector';
import {
  applyMaterialNotBefore,
  applyStageOrOrderMaterialFloors,
  assessMaterialReadiness,
  coverDeficit,
  inventorySkuKey,
  requirementFromNeeds,
} from '../material-readiness';
import { forwardSchedule } from '../schedule-planner';
import { zonedLocalToUtc } from '../working-calendar';
import {
  applyConsumeWipDependencies,
  assessWipLotsReady,
} from '../wip-readiness';
import type { PlannerStageInput } from '../types';

const TZ = 'Asia/Amman';
function amman(y: number, m: number, d: number, hh = 8, mm = 0): Date {
  return zonedLocalToUtc(y, m, d, hh, mm, 0, TZ);
}

describe('coverDeficit', () => {
  it('covers 10 need / 6 free / 4 dated Aug 20', () => {
    const cover = coverDeficit(10, 6, [{ qty: 4, readyAt: amman(2026, 8, 20) }]);
    expect(cover.unknown).toBe(false);
    expect(cover.readyAt?.getTime()).toBe(amman(2026, 8, 20).getTime());
  });

  it('unknown when remainder has no date', () => {
    const cover = coverDeficit(10, 6, [
      { qty: 4, readyAt: null },
      { qty: 4 },
    ]);
    expect(cover.unknown).toBe(true);
    expect(cover.readyAt).toBeNull();
  });

  it('does not invent a date when incoming is undated after a partial dated cover', () => {
    const cover = coverDeficit(10, 0, [
      { qty: 6, readyAt: amman(2026, 8, 20) },
      { qty: 4, readyAt: null },
    ]);
    expect(cover.unknown).toBe(true);
  });
});

describe('assessMaterialReadiness', () => {
  it('uses qty-scaled BOM needs', () => {
    const needs = bomReservationNeeds(
      { materials: [{ sku: 'UAT-WOOD', qty: 4, category: 'WOOD' }] },
      2,
    );
    expect(needs).toEqual([{ sku: 'UAT-WOOD', qty: 8, category: 'WOOD' }]);
    const required = requirementFromNeeds(needs);
    const ready = assessMaterialReadiness(required, {
      [inventorySkuKey('UAT-WOOD')]: { available: 8 },
    });
    expect(ready.ready).toBe(true);
    const short = assessMaterialReadiness(required, {
      [inventorySkuKey('UAT-WOOD')]: { available: 4 },
    });
    expect(short.ready).toBe(false);
    expect(short.risk).toBe(true);
    expect(short.materialReadyAt).toBeNull();
  });

  it('uses free (on-hand minus reserved), not on-hand', () => {
    const result = assessMaterialReadiness(
      { woodUnits: 10 },
      { woodUnits: { available: 6 } },
    );
    expect(result.ready).toBe(false);
    expect(result.risk).toBe(true);
  });

  it('takes max cover date across materials', () => {
    const result = assessMaterialReadiness(
      { woodUnits: 10, fabricMeters: 8 },
      {
        woodUnits: {
          available: 6,
          incoming: [{ qty: 4, readyAt: amman(2026, 8, 18) }],
        },
        fabricMeters: {
          available: 0,
          incoming: [{ qty: 8, readyAt: amman(2026, 8, 22) }],
        },
      },
    );
    expect(result.ready).toBe(false);
    expect(result.risk).toBe(false);
    expect(result.materialReadyAt?.getTime()).toBe(amman(2026, 8, 22).getTime());
  });

  it('MATERIAL_NOT_READY when any shortfall is unknown', () => {
    const result = assessMaterialReadiness(
      { woodUnits: 10 },
      { woodUnits: { available: 0 } },
    );
    expect(result.ready).toBe(false);
    expect(result.risk).toBe(true);
    expect(result.materialReadyAt).toBeNull();
  });
});

describe('applyMaterialNotBefore', () => {
  const stages: PlannerStageInput[] = [
    {
      code: 'MATERIAL_PREP',
      stageDefinitionId: 'stg-prep',
      dependsOnCodes: [],
      estimatedMinutes: 30,
      departmentCode: null,
    },
    {
      code: 'CARPENTRY',
      stageDefinitionId: 'stg-carp',
      dependsOnCodes: ['MATERIAL_PREP'],
      estimatedMinutes: 60,
      departmentCode: null,
    },
  ];

  it('applies stage notBefore when consumesRawMaterials is flagged', () => {
    const ready = amman(2026, 8, 20);
    const applied = applyMaterialNotBefore(stages, ready, ['MATERIAL_PREP']);
    expect(applied.orderMaterialReadyAt).toBeNull();
    expect(applied.stages.find((s) => s.code === 'MATERIAL_PREP')?.notBefore?.getTime()).toBe(
      ready.getTime(),
    );
    expect(applied.stages.find((s) => s.code === 'CARPENTRY')?.notBefore).toBeUndefined();
  });

  it('keeps order-level floor when no raw-consuming stage is flagged', () => {
    const ready = amman(2026, 8, 20);
    const applied = applyMaterialNotBefore(stages, ready, []);
    expect(applied.orderMaterialReadyAt?.getTime()).toBe(ready.getTime());
  });
});

describe('applyStageOrOrderMaterialFloors', () => {
  const carpentry: PlannerStageInput = {
    code: 'CARPENTRY',
    stageDefinitionId: 'stg-carp',
    dependsOnCodes: ['MATERIAL_PREP'],
    estimatedMinutes: 60,
    departmentCode: null,
  };
  const foam: PlannerStageInput = {
    code: 'FOAM',
    stageDefinitionId: 'stg-foam',
    dependsOnCodes: ['CARPENTRY'],
    estimatedMinutes: 40,
    departmentCode: null,
  };
  const upholstery: PlannerStageInput = {
    code: 'UPHOLSTERY',
    stageDefinitionId: 'stg-uph',
    dependsOnCodes: ['FOAM'],
    estimatedMinutes: 90,
    departmentCode: null,
  };
  const cedarStages = [carpentry, foam, upholstery];
  const velvetAt = amman(2026, 8, 18);

  it('falls back to order-wide floor when snapshot has no maps', () => {
    const applied = applyStageOrOrderMaterialFloors({
      stages: cedarStages,
      frozenInputs: [],
      orderQty: 1,
      inventory: {},
      orderWideReadyAt: velvetAt,
      consumingStageCodes: ['MATERIAL_PREP', 'CARPENTRY', 'FOAM', 'UPHOLSTERY'],
    });
    expect(applied.usedStageMaps).toBe(false);
    expect(applied.stages.find((s) => s.code === 'CARPENTRY')?.notBefore?.getTime()).toBe(
      velvetAt.getTime(),
    );
    expect(applied.stages.find((s) => s.code === 'UPHOLSTERY')?.notBefore?.getTime()).toBe(
      velvetAt.getTime(),
    );
  });

  it('Cedar: wood/foam in stock, velvet dated — carpentry free, upholstery waits', () => {
    const inventory = {
      [inventorySkuKey('MAT-BEECH')]: { available: 40, reserved: 0, incoming: [] },
      [inventorySkuKey('MAT-FOAM-HD')]: { available: 10, reserved: 0, incoming: [] },
      [inventorySkuKey('MAT-ITAL-VEL')]: {
        available: 0,
        reserved: 0,
        incoming: [{ qty: 24, readyAt: velvetAt }],
      },
      [inventorySkuKey('MAT-LEA-BRN')]: { available: 20, reserved: 0, incoming: [] },
    };
    const applied = applyStageOrOrderMaterialFloors({
      stages: cedarStages,
      frozenInputs: [
        { stageCode: 'CARPENTRY', sku: 'MAT-BEECH', qtyPerUnit: 14 },
        { stageCode: 'FOAM', sku: 'MAT-FOAM-HD', qtyPerUnit: 3 },
        { stageCode: 'UPHOLSTERY', sku: 'MAT-ITAL-VEL', qtyPerUnit: 8 },
        { stageCode: 'UPHOLSTERY', sku: 'MAT-LEA-BRN', qtyPerUnit: 12 },
      ],
      orderQty: 1,
      inventory,
      orderWideReadyAt: velvetAt,
      consumingStageCodes: ['CARPENTRY', 'FOAM', 'UPHOLSTERY'],
    });
    expect(applied.usedStageMaps).toBe(true);
    expect(applied.unknownRequired).toBe(false);
    expect(applied.stages.find((s) => s.code === 'CARPENTRY')?.notBefore).toBeUndefined();
    expect(applied.stages.find((s) => s.code === 'FOAM')?.notBefore).toBeUndefined();
    expect(applied.stages.find((s) => s.code === 'UPHOLSTERY')?.notBefore?.getTime()).toBe(
      velvetAt.getTime(),
    );
  });

  it('marks unknown when a required mapped SKU has no dated cover', () => {
    const applied = applyStageOrOrderMaterialFloors({
      stages: cedarStages,
      frozenInputs: [
        { stageCode: 'UPHOLSTERY', sku: 'MAT-ITAL-VEL', qtyPerUnit: 8, required: true },
      ],
      orderQty: 1,
      inventory: { [inventorySkuKey('MAT-ITAL-VEL')]: { available: 0, reserved: 0, incoming: [] } },
      orderWideReadyAt: null,
      consumingStageCodes: ['UPHOLSTERY'],
    });
    expect(applied.usedStageMaps).toBe(true);
    expect(applied.unknownRequired).toBe(true);
  });

  it('ignores skipped-stage frozen inputs', () => {
    const applied = applyStageOrOrderMaterialFloors({
      stages: cedarStages,
      frozenInputs: [
        { stageCode: 'UPHOLSTERY', sku: 'MAT-ITAL-VEL', qtyPerUnit: 8, skipped: true },
      ],
      orderQty: 1,
      inventory: {},
      orderWideReadyAt: velvetAt,
      consumingStageCodes: ['CARPENTRY'],
    });
    expect(applied.usedStageMaps).toBe(false);
    expect(applied.stages.find((s) => s.code === 'CARPENTRY')?.notBefore?.getTime()).toBe(
      velvetAt.getTime(),
    );
  });
});

describe('WIP consume-by-output', () => {
  const foam: PlannerStageInput = {
    code: 'FOAM',
    stageDefinitionId: 'stg-foam',
    dependsOnCodes: ['MATERIAL_PREP'],
    estimatedMinutes: 60,
    departmentCode: null,
  };
  const carpentry: PlannerStageInput = {
    code: 'CARPENTRY',
    stageDefinitionId: 'stg-carp',
    dependsOnCodes: ['MATERIAL_PREP'],
    estimatedMinutes: 60,
    departmentCode: null,
  };
  const upholstery: PlannerStageInput = {
    code: 'UPHOLSTERY',
    stageDefinitionId: 'stg-uph',
    dependsOnCodes: ['CARPENTRY'],
    estimatedMinutes: 60,
    departmentCode: null,
  };
  const prep: PlannerStageInput = {
    code: 'MATERIAL_PREP',
    stageDefinitionId: 'stg-prep',
    dependsOnCodes: [],
    estimatedMinutes: 30,
    departmentCode: null,
  };

  const nodes = [
    {
      stageCode: 'MATERIAL_PREP',
      isSkipped: false,
      consumesSemiFinished: false,
    },
    {
      stageCode: 'CARPENTRY',
      isSkipped: false,
      consumesSemiFinished: false,
      inventoryTracking: 'PRODUCES_SEMI_FINISHED',
      outputInventoryItemId: 'frame',
      outputQtyPerUnit: 1,
    },
    {
      stageCode: 'FOAM',
      isSkipped: false,
      consumesSemiFinished: false,
      inventoryTracking: 'PRODUCES_SEMI_FINISHED',
      outputInventoryItemId: 'kit',
      outputQtyPerUnit: 1,
    },
    {
      stageCode: 'UPHOLSTERY',
      isSkipped: false,
      consumesSemiFinished: true,
      consumeInventoryItemIds: ['frame', 'kit'],
    },
  ];

  it('adds Foam dep so Upholstery waits on Foam without a HARD edge', () => {
    const applied = applyConsumeWipDependencies(
      [prep, carpentry, foam, upholstery],
      nodes,
      [],
      1,
    );
    expect(applied.unknownWip).toBe(false);
    expect(applied.stages.find((s) => s.code === 'UPHOLSTERY')?.dependsOnCodes).toEqual(
      expect.arrayContaining(['CARPENTRY', 'FOAM']),
    );
  });

  it('skips extra dep when this-PO lots already cover', () => {
    const applied = applyConsumeWipDependencies(
      [prep, carpentry, foam, upholstery],
      nodes,
      [
        { inventoryItemId: 'frame', quantity: 1 },
        { inventoryItemId: 'kit', quantity: 1 },
      ],
      1,
    );
    expect(applied.stages.find((s) => s.code === 'UPHOLSTERY')?.dependsOnCodes).toEqual(['CARPENTRY']);
  });

  it('does not require a skipped optional producer', () => {
    const skippedFoam = nodes.map((n) =>
      n.stageCode === 'FOAM' ? { ...n, isSkipped: true } : n,
    );
    const applied = applyConsumeWipDependencies(
      [prep, carpentry, upholstery],
      skippedFoam,
      [{ inventoryItemId: 'frame', quantity: 1 }],
      1,
    );
    expect(applied.unknownWip).toBe(false);
    expect(applied.stages.find((s) => s.code === 'UPHOLSTERY')?.dependsOnCodes).toEqual(['CARPENTRY']);
  });

  it('still waits when quantity 2 vs 1 lot', () => {
    const applied = applyConsumeWipDependencies(
      [prep, carpentry, foam, upholstery],
      nodes,
      [
        { inventoryItemId: 'frame', quantity: 1 },
        { inventoryItemId: 'kit', quantity: 1 },
      ],
      2,
    );
    expect(applied.stages.find((s) => s.code === 'UPHOLSTERY')?.dependsOnCodes).toEqual(
      expect.arrayContaining(['FOAM', 'CARPENTRY']),
    );
    expect(
      assessWipLotsReady(nodes, [
        { inventoryItemId: 'frame', quantity: 1 },
        { inventoryItemId: 'kit', quantity: 1 },
      ], 2),
    ).toBe(false);
  });

  it('unknown WIP when short and no same-order producer', () => {
    const applied = applyConsumeWipDependencies(
      [upholstery],
      [
        {
          stageCode: 'UPHOLSTERY',
          isSkipped: false,
          consumesSemiFinished: true,
          consumeInventoryItemIds: ['external-kit'],
        },
      ],
      [],
      1,
    );
    expect(applied.unknownWip).toBe(true);
  });
});

describe('conflict detector unchanged by WIP consume deps', () => {
  it('adjacent windows still do not conflict', () => {
    const now = new Date('2026-08-15T05:00:00.000Z');
    const found = detectConflicts(
      [
        {
          id: 'a',
          employeeId: 'w1',
          employeeName: 'Ali',
          resourceSlot: null,
          isPinned: false,
          productionOrderId: 'po-1',
          scheduleId: 's1',
          scheduleVersion: 1,
          scheduleStatus: 'APPROVED',
          productionTaskId: 't1',
          taskStatus: 'READY',
          taskName: 'Foam',
          stageDefinitionId: 'foam',
          stageName: 'Foam',
          orderNumber: 'PO-1',
          productName: 'Sofa',
          priority: 'NORMAL',
          requestedDeliveryDate: null,
          committedDeliveryDate: null,
          customerId: 'c1',
          createdAt: now,
          plannedStart: new Date('2026-08-16T05:00:00.000Z'),
          plannedEnd: new Date('2026-08-16T07:00:00.000Z'),
        },
        {
          id: 'b',
          employeeId: 'w1',
          employeeName: 'Ali',
          resourceSlot: null,
          isPinned: false,
          productionOrderId: 'po-2',
          scheduleId: 's2',
          scheduleVersion: 1,
          scheduleStatus: 'APPROVED',
          productionTaskId: 't2',
          taskStatus: 'READY',
          taskName: 'Upholstery',
          stageDefinitionId: 'uph',
          stageName: 'Upholstery',
          orderNumber: 'PO-2',
          productName: 'Sofa',
          priority: 'NORMAL',
          requestedDeliveryDate: null,
          committedDeliveryDate: null,
          customerId: 'c1',
          createdAt: now,
          plannedStart: new Date('2026-08-16T07:00:00.000Z'),
          plannedEnd: new Date('2026-08-16T09:00:00.000Z'),
        },
      ],
      now,
    );
    expect(found).toHaveLength(0);
  });
});

describe('planner honors consume deps without productionReadyAt', () => {
  it('Upholstery start is after Foam end when Foam is a scheduling dep', () => {
    const {
      ctx,
      eightHourCalendar,
      worker,
    } = require('./scheduling-capacity-uat.fixtures') as typeof import('./scheduling-capacity-uat.fixtures');
    const result = forwardSchedule(
      [
        {
          id: 'po-wip',
          customerId: 'c1',
          priority: 'NORMAL',
          createdAt: amman(2026, 8, 16, 7, 0),
          stages: [
            {
              code: 'FOAM',
              stageDefinitionId: 'stg-foam',
              dependsOnCodes: [],
              estimatedMinutes: 120,
              departmentCode: null,
            },
            {
              code: 'UPHOLSTERY',
              stageDefinitionId: 'stg-upholstery',
              dependsOnCodes: ['FOAM'],
              estimatedMinutes: 60,
              departmentCode: null,
            },
          ],
        },
      ],
      ctx(
        [worker('foam', ['stg-foam']), worker('uph', ['stg-upholstery'])],
        { calendar: eightHourCalendar(), now: amman(2026, 8, 16, 8, 0) },
      ),
    );
    const foamEnd = result.allocations.find((a) => a.stageCode === 'FOAM')!.plannedEnd;
    const uphStart = result.allocations.find((a) => a.stageCode === 'UPHOLSTERY')!.plannedStart;
    expect(uphStart.getTime()).toBeGreaterThanOrEqual(foamEnd.getTime());
  });
});
