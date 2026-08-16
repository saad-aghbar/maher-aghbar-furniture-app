/**
 * Generate + inventory arrival wiring for material/WIP readiness.
 * Mocked Prisma only — not live proof.
 */
import { InventoryService } from '../../inventory/inventory.service';
import { SchedulingService } from '../scheduling.service';
import { zonedLocalToUtc } from '../domain/working-calendar';

const TZ = 'Asia/Amman';
const READY_AT = zonedLocalToUtc(2026, 8, 20, 8, 0, 0, TZ);

function calendarRow() {
  return {
    id: 'cal-1',
    timezone: TZ,
    workingWeekdays: [0, 1, 2, 3, 4, 6],
    shiftStart: '08:00',
    shiftEnd: '16:00',
    breaks: [{ start: '12:00', end: '13:00' }],
    isDefault: true,
    deliveryBufferWorkingDays: 1,
  };
}

function makePrisma() {
  const created: Record<string, unknown>[] = [];
  const prisma = {
    product: { findMany: jest.fn().mockResolvedValue([]) },
    user: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'w1',
          department: { code: 'CARPENTRY' },
          workerSkills: [{ stageDefinitionId: 'stg-carp' }],
        },
      ]),
    },
    scheduleAllocation: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'alloc-1' }),
    },
    factoryCalendar: {
      findFirst: jest.fn().mockResolvedValue(calendarRow()),
      create: jest.fn(),
      update: jest.fn(),
    },
    factoryCalendarException: { findMany: jest.fn().mockResolvedValue([]) },
    productionStageDefinition: { findMany: jest.fn().mockResolvedValue([]) },
    productionTask: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
    inventoryItem: { findMany: jest.fn().mockResolvedValue([]) },
    purchaseOrder: { findMany: jest.fn().mockResolvedValue([]) },
    inventoryLot: { findMany: jest.fn().mockResolvedValue([]) },
    workerSkill: { findFirst: jest.fn() },
    productionSchedule: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: 'sch-1', allocations: [], ...data };
        created.push(row);
        return row;
      }),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    productionOrder: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    customer: { findMany: jest.fn().mockResolvedValue([]) },
    productionOrderWorkflowSnapshot: { findUnique: jest.fn().mockResolvedValue(null) },
    productionOrderWorkflowSnapshotNode: { findMany: jest.fn().mockResolvedValue([]) },
    department: { findMany: jest.fn().mockResolvedValue([]) },
    auditEvent: { create: jest.fn().mockResolvedValue(undefined) },
    schedulingReplanRun: {
      create: jest.fn().mockResolvedValue({ id: 'run-1', status: 'QUEUED' }),
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
    created,
  } as any;
  return prisma;
}

function makeScheduling(prisma: ReturnType<typeof makePrisma>) {
  const notifications = {
    notifyAdminUsers: jest.fn().mockResolvedValue(undefined),
    notifyCustomerUsers: jest.fn().mockResolvedValue(undefined),
    sendFromTemplate: jest.fn().mockResolvedValue(undefined),
  } as any;
  const idempotency = {
    once: jest.fn(
      async (_s: string, _k: string | undefined, _m: unknown, factory: () => Promise<unknown>) => ({
        result: await factory(),
        replayed: false,
      }),
    ),
  } as any;
  const queue = { enqueue: jest.fn().mockResolvedValue(undefined), setProcessor: jest.fn() } as any;
  return {
    service: new SchedulingService(prisma, notifications, idempotency, queue),
    queue,
  };
}

function poRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'po-1',
    number: 'PO-1',
    status: 'PLANNED',
    quantity: 1,
    customerId: 'c1',
    priority: 'NORMAL',
    createdAt: new Date('2026-08-15T00:00:00.000Z'),
    requiredDeliveryDate: null,
    committedDeliveryDate: null,
    product: {
      bomDefaults: { materials: [{ sku: 'UAT-WOOD', qty: 10, category: 'WOOD' }] },
      productionProfile: { bufferPercent: 10 },
      stageEstimates: [
        {
          stageDefinitionId: 'stg-carp',
          isRequired: true,
          quantityScalingMode: 'FIXED',
          setupMinutes: 0,
          minutesPerUnit: 0,
          fixedMinutes: 60,
          batchSize: null,
          batchMinutes: null,
          maxParallelUnits: null,
          overrideDepartment: null,
        },
      ],
    },
    tasks: [
      {
        id: 'task-1',
        status: 'READY',
        stageDefinitionId: 'stg-carp',
        stageInstanceId: 'inst-1',
        estimatedMinutes: 60,
        assignedEmployeeId: null,
        plannedStart: null,
        plannedCompletion: null,
        stageDefinition: {
          id: 'stg-carp',
          code: 'CARPENTRY',
          dependsOnCodes: [],
          responsibleDepartment: 'CARPENTRY',
          estimatedHours: 1,
          schedulingResourceMode: 'WORKER_CONSTRAINED',
          resourceSlots: 1,
        },
      },
    ],
    salesOrder: { customerId: 'c1', id: 'so-1', status: 'CONFIRMED' },
    ...overrides,
  };
}

describe('material generate wiring', () => {
  it('persists MATERIAL_NOT_READY when shortage has no incoming date', async () => {
    const prisma = makePrisma();
    const { service } = makeScheduling(prisma);
    prisma.productionOrder.findUnique.mockResolvedValue(poRow());
    prisma.inventoryItem.findMany.mockResolvedValue([
      {
        id: 'wood-1',
        sku: 'UAT-WOOD',
        category: 'WOOD',
        materialGroup: 'WOOD',
        balances: [{ availableQty: 0, reservedQty: 0 }],
      },
    ]);
    prisma.productionSchedule.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
        id: 'sch-1',
        version: 1,
        status: 'NEEDS_REVIEW',
        unschedulableReason: 'MATERIAL_NOT_READY',
        materialReadyAt: null,
        allocations: [],
      });

    await service.generateForProductionOrder('po-1', 'user-1');

    expect(prisma.productionSchedule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ unschedulableReason: 'MATERIAL_NOT_READY' }),
      }),
    );
    expect(prisma.productionOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'WAITING_FOR_MATERIALS' } }),
    );
  });

  it('passes materialReadyAt onto the persisted schedule when incoming is dated', async () => {
    const prisma = makePrisma();
    const { service } = makeScheduling(prisma);
    prisma.productionOrder.findUnique.mockResolvedValue(poRow());
    prisma.inventoryItem.findMany.mockResolvedValue([
      {
        id: 'wood-1',
        sku: 'UAT-WOOD',
        category: 'WOOD',
        materialGroup: 'WOOD',
        balances: [{ availableQty: 0, reservedQty: 0 }],
      },
    ]);
    prisma.purchaseOrder.findMany.mockResolvedValue([
      {
        expectedDeliveryDate: READY_AT,
        lines: [{ inventoryItemId: 'wood-1', quantity: 10 }],
        goodsReceipts: [],
      },
    ]);
    prisma.productionOrderWorkflowSnapshot.findUnique.mockResolvedValue({
      nodes: [
        {
          id: 'n1',
          stageCode: 'CARPENTRY',
          stageInstanceId: 'inst-1',
          isSkipped: false,
          consumesRawMaterials: true,
          consumesSemiFinished: false,
          inventoryTracking: 'NONE',
          outputInventoryItemId: null,
          outputQtyPerUnit: null,
          consumeInventoryItemIds: null,
          estimatedMinutes: 60,
          schedulingResourceMode: 'WORKER_CONSTRAINED',
          resourceSlots: 1,
          responsibleDepartmentCode: 'CARPENTRY',
        },
      ],
      edges: [],
    });
    prisma.productionSchedule.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
        id: 'sch-1',
        version: 1,
        status: 'PROPOSED',
        materialReadyAt: READY_AT,
        allocations: [],
      });

    await service.generateForProductionOrder('po-1', 'user-1', { mode: 'forward' });

    const persist = prisma.productionSchedule.create.mock.calls.find((call: unknown[]) => {
      const data = (call[0] as { data?: { materialReadyAt?: Date } }).data;
      return Boolean(data?.materialReadyAt);
    });
    expect(persist).toBeTruthy();
    expect(
      (persist[0] as { data: { materialReadyAt: Date } }).data.materialReadyAt.getTime(),
    ).toBe(READY_AT.getTime());
  });

  it('credits this sales order reservation so generate is not MATERIAL_NOT_READY', async () => {
    const prisma = makePrisma();
    const { service } = makeScheduling(prisma);
    prisma.productionOrder.findUnique.mockResolvedValue(
      poRow({
        product: {
          bomDefaults: { materials: [{ sku: 'UAT-WOOD', qty: 4, category: 'WOOD' }] },
          productionProfile: { bufferPercent: 10 },
          stageEstimates: [
            {
              stageDefinitionId: 'stg-carp',
              isRequired: true,
              quantityScalingMode: 'FIXED',
              setupMinutes: 0,
              minutesPerUnit: 0,
              fixedMinutes: 60,
              batchSize: null,
              batchMinutes: null,
              maxParallelUnits: null,
              overrideDepartment: null,
            },
          ],
        },
      }),
    );
    prisma.inventoryItem.findMany.mockResolvedValue([
      {
        id: 'wood-1',
        sku: 'UAT-WOOD',
        category: 'WOOD',
        materialGroup: 'WOOD',
        balances: [{ availableQty: 6, reservedQty: 4 }],
      },
    ]);
    prisma.productionOrderWorkflowSnapshot.findUnique.mockResolvedValue({
      nodes: [
        {
          id: 'n1',
          stageCode: 'CARPENTRY',
          stageInstanceId: 'inst-1',
          isSkipped: false,
          consumesRawMaterials: true,
          consumesSemiFinished: false,
          inventoryTracking: 'NONE',
          outputInventoryItemId: null,
          outputQtyPerUnit: null,
          consumeInventoryItemIds: null,
          estimatedMinutes: 60,
          schedulingResourceMode: 'WORKER_CONSTRAINED',
          resourceSlots: 1,
          responsibleDepartmentCode: 'CARPENTRY',
        },
      ],
      edges: [],
    });
    prisma.productionSchedule.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
        id: 'sch-1',
        version: 1,
        status: 'PROPOSED',
        unschedulableReason: null,
        materialReadyAt: null,
        allocations: [{ id: 'alloc-1' }],
      });

    await service.generateForProductionOrder('po-1', 'user-1', { mode: 'forward' });

    expect(prisma.productionSchedule.create).toHaveBeenCalled();
    const unschedulable = prisma.productionSchedule.create.mock.calls.some((call: unknown[]) => {
      const data = (call[0] as { data?: { unschedulableReason?: string } }).data;
      return data?.unschedulableReason === 'MATERIAL_NOT_READY';
    });
    expect(unschedulable).toBe(false);
  });

  it('does not credit reservations when the sales order is still WAITING_FOR_MATERIALS', async () => {
    const prisma = makePrisma();
    const { service } = makeScheduling(prisma);
    prisma.productionOrder.findUnique.mockResolvedValue(
      poRow({
        salesOrder: { customerId: 'c1', id: 'so-wait', status: 'WAITING_FOR_MATERIALS' },
        product: {
          bomDefaults: { materials: [{ sku: 'UAT-WOOD', qty: 4, category: 'WOOD' }] },
          productionProfile: { bufferPercent: 10 },
          stageEstimates: [
            {
              stageDefinitionId: 'stg-carp',
              isRequired: true,
              quantityScalingMode: 'FIXED',
              setupMinutes: 0,
              minutesPerUnit: 0,
              fixedMinutes: 60,
              batchSize: null,
              batchMinutes: null,
              maxParallelUnits: null,
              overrideDepartment: null,
            },
          ],
        },
      }),
    );
    prisma.inventoryItem.findMany.mockResolvedValue([
      {
        id: 'wood-1',
        sku: 'UAT-WOOD',
        category: 'WOOD',
        materialGroup: 'WOOD',
        balances: [{ availableQty: 6, reservedQty: 4 }],
      },
    ]);
    prisma.productionSchedule.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
        id: 'sch-1',
        version: 1,
        status: 'NEEDS_REVIEW',
        unschedulableReason: 'MATERIAL_NOT_READY',
        materialReadyAt: null,
        allocations: [],
      });

    await service.generateForProductionOrder('po-1', 'user-1');

    expect(prisma.productionSchedule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ unschedulableReason: 'MATERIAL_NOT_READY' }),
      }),
    );
  });

  it('wires consume-by-output and BOM reservation into generate', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../scheduling.service.ts'),
      'utf8',
    ) as string;
    expect(src).toContain('bomReservationNeeds');
    expect(src).toContain('applyMaterialNotBefore');
    expect(src).toContain('applyConsumeWipDependencies');
    expect(src).toContain("enqueue('REPLAN'");
    expect(src).toContain("soStatus !== 'WAITING_FOR_MATERIALS'");
    expect(src).toContain('materialReadyAt: nextReadyAt');
    expect(src).toContain('(row.reserved ?? 0) + 1e-9 < qty');
  });
});

describe('inventory material-arrival REPLAN', () => {
  it('enqueues targeted REPLAN after retryWaitingMaterialOrders', async () => {
    const enqueue = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      salesOrder: { findMany: jest.fn().mockResolvedValue([{ id: 'so-1' }]), update: jest.fn() },
      productionOrder: {
        findMany: jest.fn().mockResolvedValue([{ id: 'po-wait' }]),
        updateMany: jest.fn(),
      },
      productionSchedule: {
        findMany: jest.fn().mockResolvedValue([{ productionOrderId: 'po-ready-at' }]),
      },
      $transaction: jest.fn(),
    } as any;
    const service = new InventoryService(
      prisma,
      { next: jest.fn() } as any,
      { maybeAutoReorderAfterStockChange: jest.fn() } as any,
      { enqueue } as any,
    );
    jest.spyOn(service, 'tryReserveForSalesOrder' as never).mockResolvedValue({ ready: false } as never);

    await service.retryWaitingMaterialOrders('user-1');

    const poIds = enqueue.mock.calls.map((c: unknown[]) => (c[1] as { productionOrderId: string }).productionOrderId);
    expect(enqueue).toHaveBeenCalledWith(
      'REPLAN',
      expect.objectContaining({ event: 'material-arrival' }),
    );
    expect(poIds).toEqual(expect.arrayContaining(['po-wait', 'po-ready-at']));
    expect(enqueue.mock.calls.every((c: unknown[]) => c[0] === 'REPLAN')).toBe(true);
    expect(enqueue.mock.calls.some((c: unknown[]) => c[0] === 'REPLAN_FACTORY')).toBe(false);
  });
});
