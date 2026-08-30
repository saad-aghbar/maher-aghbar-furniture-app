/**
 * Service-wiring evidence for the capacity audit. Mocked Prisma only.
 * Does not change production scheduling behavior.
 */
import { SchedulingService } from '../scheduling.service';
import { zonedLocalToUtc } from '../domain/working-calendar';

const TZ = 'Asia/Amman';

function amman(y: number, m: number, d: number, hh: number, mm: number): Date {
  return zonedLocalToUtc(y, m, d, hh, mm, 0, TZ);
}

function foamStage() {
  return {
    id: 'stg-foam',
    code: 'FOAM',
    nameEn: 'Foam preparation',
    nameAr: 'تجهيز الإسفنج',
    nameHe: null,
    schedulingResourceMode: 'WORKER_CONSTRAINED' as const,
    resourceSlots: 1,
    workerSkills: [
      { userId: 'rana', user: { id: 'rana', firstName: 'Rana', lastName: 'Khatib' } },
      { userId: 'yousef', user: { id: 'yousef', firstName: 'Yousef', lastName: 'Haddad' } },
    ],
  };
}

function makeService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = {
    product: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    scheduleAllocation: { findMany: jest.fn().mockResolvedValue([]) },
    factoryCalendar: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'cal-1',
        timezone: 'Asia/Amman',
        workingWeekdays: [0, 1, 2, 3, 4, 6],
        shiftStart: '08:00',
        shiftEnd: '16:00',
        breaks: [{ start: '12:00', end: '13:00' }],
        isDefault: true,
      }),
      create: jest.fn(),
      update: jest.fn(),
    },
    factoryCalendarException: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({ id: 'ex-1' }),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    productionStageDefinition: { findMany: jest.fn().mockResolvedValue([]) },
    productionTask: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    inventoryItem: { findMany: jest.fn().mockResolvedValue([]) },
    purchaseOrder: { findMany: jest.fn().mockResolvedValue([]) },
    inventoryLot: { findMany: jest.fn().mockResolvedValue([]) },
    workerSkill: { findFirst: jest.fn() },
    productionSchedule: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
    },
    productionOrder: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
    customer: { findMany: jest.fn().mockResolvedValue([]) },
    productionOrderWorkflowSnapshotNode: { findMany: jest.fn().mockResolvedValue([]) },
    department: { findMany: jest.fn().mockResolvedValue([]) },
    auditEvent: { create: jest.fn().mockResolvedValue(undefined) },
    schedulingReplanRun: {
      create: jest.fn().mockResolvedValue({ id: 'run-1', status: 'QUEUED' }),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    ...prismaOverrides,
  } as any;

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

  const queue = { enqueue: jest.fn().mockResolvedValue(undefined) } as any;
  const service = new SchedulingService(prisma, notifications, idempotency, queue);
  return { service, prisma, notifications, queue };
}

describe('scheduling capacity wiring', () => {
  it('loadWorkers query (via availability) requires active PRODUCTION_WORKER + active skills', async () => {
    const { service, prisma } = makeService();
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'prod-1',
        productionProfile: { bufferPercent: 10 },
        stageEstimates: [
          {
            isRequired: true,
            stageDefinitionId: 'stg-carpentry',
            quantityScalingMode: 'LINEAR',
            setupMinutes: 0,
            minutesPerUnit: 60,
            fixedMinutes: 0,
            batchSize: null,
            batchMinutes: null,
            maxParallelUnits: null,
            overrideDepartment: null,
            stageDefinition: { code: 'CARPENTRY', dependsOnCodes: [], responsibleDepartment: 'CARPENTRY' },
          },
        ],
      },
    ]);
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'w1',
        department: { code: 'CARPENTRY' },
        workerSkills: [{ stageDefinitionId: 'stg-carpentry' }],
      },
    ]);

    await service.availability({ items: [{ productId: 'prod-1', quantity: 1 }] });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          archivedAt: null,
          roles: { some: { role: { kind: 'PRODUCTION_WORKER' } } },
        }),
      }),
    );
    const select = prisma.user.findMany.mock.calls[0][0].select;
    expect(select.workerSkills.where).toEqual({ isActive: true });
  });

  it('availability PlannerOrderInput includes requestedDeliveryDate and materialReadyAt', async () => {
    const { service, prisma } = makeService();
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'prod-1',
        productionProfile: null,
        stageEstimates: [
          {
            isRequired: true,
            stageDefinitionId: 'stg-carpentry',
            quantityScalingMode: 'FIXED',
            setupMinutes: 0,
            minutesPerUnit: 0,
            fixedMinutes: 60,
            batchSize: null,
            batchMinutes: null,
            maxParallelUnits: null,
            overrideDepartment: null,
            stageDefinition: { code: 'CARPENTRY', dependsOnCodes: [], responsibleDepartment: 'CARPENTRY' },
          },
        ],
      },
    ]);

    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../scheduling.service.ts'),
      'utf8',
    ) as string;
    const availabilityBlock = src.slice(src.indexOf('async availability'), src.indexOf('private buildAlternativeDates'));
    expect(availabilityBlock).toContain('requestedDeliveryDate');
    expect(availabilityBlock).toMatch(/materialReadyAt:/);
    expect(src).toContain('requestedDeliveryDate: po.requiredDeliveryDate');
    expect(src).toMatch(/requestedDateFeasible: result\.requestedDateFeasible/);
    expect(src).toMatch(/materialReadyAt: materialReadiness\.materialReadyAt/);
  });

  it('calendar cards, order snapshot, and at-risk pass through schedule dates without planner changes', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../scheduling.service.ts'),
      'utf8',
    ) as string;
    const cards = src.slice(src.indexOf('private async buildOrderCards'), src.indexOf('async getProductionProfile'));
    expect(cards).toContain('requestedDeliveryDate');
    expect(cards).toContain('suggestedDeliveryDate');
    expect(cards).toContain('committedDeliveryDate');
    expect(cards).toContain('earliestAvailableDate');
    expect(cards).toContain('requestedDateFeasible');
    expect(cards).toContain('unschedulableReason');
    expect(cards).toContain('planningMode');
    expect(cards).toContain('materialReadyAt');
    expect(cards).toContain('productionDeadline');
    expect(cards).toContain('deliveryBufferWorkingDays');
    expect(cards).toContain('productionDeadlineIso');
    expect(cards).toContain('occupiedDates');
    expect(cards).toContain('occupiedLocalYmds');

    const snapshot = src.slice(src.indexOf('private serializeSchedule'), src.indexOf('async getOrderSchedule'));
    expect(snapshot).toContain('materialReadyAt: schedule.materialReadyAt');
    expect(snapshot).toContain('productionDeadline');
    expect(snapshot).toContain('deliveryBufferWorkingDays');

    const atRisk = src.slice(src.indexOf('private serializeAtRiskItem'), src.indexOf('async listAtRisk'));
    expect(atRisk).toContain('materialReadyAt');
    expect(atRisk).toContain('planningMode');
    expect(atRisk).toContain('committedCompletionDate');
    expect(atRisk).toContain('productionDeadline');
    expect(src).toContain('function productionDeadlineIso');
    expect(src).toContain('calendar.latestProductionCompletion');
  });

  it('loadOccupancy query is future APPROVED/PROPOSED employee allocations', async () => {
    const { service, prisma } = makeService();
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'prod-1',
        productionProfile: null,
        stageEstimates: [
          {
            isRequired: true,
            stageDefinitionId: 'stg-c',
            quantityScalingMode: 'FIXED',
            setupMinutes: 0,
            minutesPerUnit: 0,
            fixedMinutes: 30,
            batchSize: null,
            batchMinutes: null,
            maxParallelUnits: null,
            overrideDepartment: null,
            stageDefinition: { code: 'CUT', dependsOnCodes: [], responsibleDepartment: null },
          },
        ],
      },
    ]);

    await service.availability({ items: [{ productId: 'prod-1', quantity: 1 }] });

    expect(prisma.scheduleAllocation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          plannedEnd: { gte: expect.any(Date) },
          schedule: { status: { in: ['APPROVED', 'PROPOSED'] } },
          OR: [{ employeeId: { not: null } }, { resourceSlot: { not: null } }],
        }),
      }),
    );
  });

  it('listCapacity uses skilled WorkerSkill count, not department headcount', async () => {
    const { service, prisma } = makeService();
    prisma.productionStageDefinition.findMany.mockResolvedValue([
      {
        id: 'stg-carp',
        code: 'CARPENTRY',
        nameEn: 'Carpentry',
        nameAr: 'نجارة',
        nameHe: null,
        schedulingResourceMode: 'WORKER_CONSTRAINED',
        resourceSlots: 1,
        workerSkills: [{ userId: 'a' }, { userId: 'b' }],
      },
    ]);

    const result = await service.listCapacity('2026-08-09', '2026-08-09');
    expect(result.data[0]!.code).toBe('CARPENTRY');
    expect(result.data[0]!.eligibleWorkerCount).toBe(2);
    expect(result.data[0]!.capacityMinutes).toBeGreaterThan(0);
    expect(result.data[0]!.availableMinutes).toBe(result.data[0]!.capacityMinutes);
    expect(result.data[0]!.allocatedMinutes).toBe(result.data[0]!.bookedMinutes);
    expect(result.data[0]!.remainingMinutes).toBe(
      Math.max(0, result.data[0]!.availableMinutes - result.data[0]!.allocatedMinutes),
    );
    const perHead = result.data[0]!.capacityMinutes / 2;
    expect(result.data[0]!.capacityMinutes).toBe(Math.round(perHead * 2));
  });

  it('listCapacity includes zero-skill stages and does not hide remainingMinutes of 0', async () => {
    const { service, prisma } = makeService();
    prisma.productionStageDefinition.findMany.mockResolvedValue([
      {
        id: 'stg-paint',
        code: 'PAINTING',
        nameEn: 'Painting',
        nameAr: 'دهان',
        nameHe: null,
        schedulingResourceMode: 'WORKER_CONSTRAINED',
        resourceSlots: 1,
        workerSkills: [],
      },
      {
        id: 'stg-uph',
        code: 'UPHOLSTERY',
        nameEn: 'Upholstery',
        nameAr: 'تنجيد',
        nameHe: null,
        schedulingResourceMode: 'WORKER_CONSTRAINED',
        resourceSlots: 1,
        workerSkills: [{ userId: 'u1', user: { id: 'u1', firstName: 'Ada', lastName: 'K' } }],
      },
    ]);
    prisma.scheduleAllocation.findMany.mockResolvedValue([
      {
        plannedStart: new Date('2026-08-09T08:00:00.000Z'),
        plannedEnd: new Date('2026-08-09T15:00:00.000Z'),
        employeeId: 'u1',
        productionTask: { stageDefinitionId: 'stg-uph' },
      },
    ]);

    const result = await service.listCapacity('2026-08-09', '2026-08-09');
    const paint = result.data.find((d) => d.code === 'PAINTING');
    const uph = result.data.find((d) => d.code === 'UPHOLSTERY');
    expect(paint).toBeDefined();
    expect(paint!.eligibleWorkerCount).toBe(0);
    expect(paint!.availableMinutes).toBe(0);
    expect(paint!.remainingMinutes).toBe(0);
    expect(uph!.eligibleWorkerCount).toBe(1);
    expect(uph!.allocatedMinutes).toBeGreaterThan(0);
  });

  it('listCapacity granularity=day returns isWorking per factory calendar day', async () => {
    const { service, prisma } = makeService();
    prisma.productionStageDefinition.findMany.mockResolvedValue([
      {
        id: 'stg-carp',
        code: 'CARPENTRY',
        nameEn: 'Carpentry',
        nameAr: 'نجارة',
        nameHe: null,
        schedulingResourceMode: 'WORKER_CONSTRAINED',
        resourceSlots: 1,
        workerSkills: [{ userId: 'a', user: { id: 'a', firstName: 'A', lastName: 'A' } }],
      },
    ]);

    const result = await service.listCapacity('2026-08-09', '2026-08-15', { granularity: 'day' });
    expect(result.days).toHaveLength(7);
    expect(result.byDay).toHaveLength(7);
    const friday = result.days!.find((d) => d.date === '2026-08-14');
    expect(friday?.isWorking).toBe(false);
    expect(friday?.shiftMinutes).toBe(0);
    const sunday = result.days!.find((d) => d.date === '2026-08-09');
    expect(sunday?.isWorking).toBe(true);
    expect(sunday!.shiftMinutes).toBeGreaterThan(0);
  });

  it('listCapacity includeWorkers nests skilled workers only on a single-day range', async () => {
    const { service, prisma } = makeService();
    prisma.productionStageDefinition.findMany.mockResolvedValue([
      {
        id: 'stg-carp',
        code: 'CARPENTRY',
        nameEn: 'Carpentry',
        nameAr: 'نجارة',
        nameHe: null,
        schedulingResourceMode: 'WORKER_CONSTRAINED',
        resourceSlots: 1,
        workerSkills: [
          { userId: 'a', user: { id: 'a', firstName: 'Ali', lastName: 'Carp' } },
          { userId: 'b', user: { id: 'b', firstName: 'Bana', lastName: 'Carp' } },
        ],
      },
    ]);
    prisma.scheduleAllocation.findMany.mockResolvedValue([
      {
        plannedStart: new Date('2026-08-09T08:00:00.000Z'),
        plannedEnd: new Date('2026-08-09T12:00:00.000Z'),
        employeeId: 'a',
        productionTask: { stageDefinitionId: 'stg-carp' },
      },
    ]);

    const single = await service.listCapacity('2026-08-09', '2026-08-09', { includeWorkers: true });
    expect(single.data[0]!.workers).toHaveLength(2);
    const ali = single.data[0]!.workers!.find((w) => w.employeeId === 'a');
    expect(ali?.firstName).toBe('Ali');
    expect(ali?.eligible).toBe(true);
    expect(ali!.allocatedMinutes).toBeGreaterThan(0);
    expect(ali!.remainingMinutes).toBe(Math.max(0, ali!.availableMinutes - ali!.allocatedMinutes));
    expect(single.data[0]!.ineligibleWorkers).toEqual([]);
    expect(single.data[0]!.unassignedAllocatedMinutes).toBe(0);

    const week = await service.listCapacity('2026-08-09', '2026-08-15', { includeWorkers: true });
    expect(week.data[0]!.workers).toBeUndefined();
    expect(week.data[0]!.ineligibleWorkers).toBeUndefined();
    expect(week.data[0]!.unassignedAllocatedMinutes).toBeUndefined();
  });

  it('onTaskLifecycle complete enqueues REPLAN and does not generate a new schedule', async () => {
    const { service, prisma, queue } = makeService();
    prisma.productionTask.findUnique.mockResolvedValue({
      id: 't1',
      productionOrderId: 'po-1',
      name: 'Carpentry',
      number: 'T-1',
    });
    prisma.productionSchedule.findFirst.mockResolvedValue({
      id: 'sch-1',
      productionOrderId: 'po-1',
      status: 'APPROVED',
    });

    await service.onTaskLifecycle('t1', 'complete');

    expect(queue.enqueue).toHaveBeenCalledWith('REPLAN', {
      productionOrderId: 'po-1',
      taskId: 't1',
      event: 'complete',
    });
    expect(prisma.productionSchedule.create).not.toHaveBeenCalled();
  });

  it('listConflicts uses the domain detector and returns unique active count', async () => {
    const { service, prisma } = makeService();
    const start = new Date(Date.now() + 48 * 3600_000);
    const mid = new Date(start.getTime() + 3 * 3600_000);
    const end = new Date(start.getTime() + 6 * 3600_000);
    prisma.scheduleAllocation.findMany.mockResolvedValue([
      {
        id: 'alloc-a',
        employeeId: 'w-1',
        resourceSlot: null,
        plannedStart: start,
        plannedEnd: mid,
        estimatedMinutes: 180,
        isPinned: false,
        manuallyAdjusted: false,
        productionTaskId: 't-a',
        employee: { id: 'w-1', firstName: 'Ahmad', lastName: 'Khalil', isActive: true },
        schedule: {
          id: 'sch-a',
          version: 1,
          status: 'APPROVED',
          productionOrderId: 'po-a',
          requestedDeliveryDate: null,
          committedDeliveryDate: null,
          productionOrder: {
            id: 'po-a',
            number: 'PO-A',
            priority: 'HIGH',
            customerId: 'c1',
            createdAt: new Date('2026-08-01T00:00:00.000Z'),
            requiredDeliveryDate: null,
            committedDeliveryDate: null,
            product: { nameEn: 'Sofa' },
          },
        },
        productionTask: {
          id: 't-a',
          name: 'Upholstery',
          status: 'READY',
          stageDefinitionId: 'stg-u',
          stageDefinition: { id: 'stg-u', nameEn: 'Upholstery', code: 'UPHOLSTERY' },
        },
      },
      {
        id: 'alloc-b',
        employeeId: 'w-1',
        resourceSlot: null,
        plannedStart: new Date(start.getTime() + 2 * 3600_000),
        plannedEnd: end,
        estimatedMinutes: 180,
        isPinned: false,
        manuallyAdjusted: false,
        productionTaskId: 't-b',
        employee: { id: 'w-1', firstName: 'Ahmad', lastName: 'Khalil', isActive: true },
        schedule: {
          id: 'sch-b',
          version: 1,
          status: 'PROPOSED',
          productionOrderId: 'po-b',
          requestedDeliveryDate: null,
          committedDeliveryDate: null,
          productionOrder: {
            id: 'po-b',
            number: 'PO-B',
            priority: 'NORMAL',
            customerId: 'c1',
            createdAt: new Date('2026-08-02T00:00:00.000Z'),
            requiredDeliveryDate: null,
            committedDeliveryDate: null,
            product: { nameEn: 'Chair' },
          },
        },
        productionTask: {
          id: 't-b',
          name: 'Upholstery',
          status: 'READY',
          stageDefinitionId: 'stg-u',
          stageDefinition: { id: 'stg-u', nameEn: 'Upholstery', code: 'UPHOLSTERY' },
        },
      },
    ]);

    const result = await service.listConflicts();
    expect(result.count).toBe(1);
    expect(result.affectedOrderCount).toBe(2);
    expect(result.data[0]!.type).toBe('WORKER_OVERLAP');
    expect(result.data[0]!.overlapMinutes).toBe(60);
    expect(result.data[0]!.allocationA.orderNumber).toBe('PO-A');
    expect(result.data[0]!.worker?.name).toBe('Ahmad Khalil');
  });

  it('enqueueEmployeeReplan enqueues REPLAN_EMPLOYEE without generating', async () => {
    const { service, prisma, queue } = makeService();
    service.enqueueEmployeeReplan('emp-1');
    expect(queue.enqueue).toHaveBeenCalledWith('REPLAN_EMPLOYEE', {
      employeeId: 'emp-1',
      capacityDelta: 'decrease',
    });
    expect(prisma.productionSchedule.create).not.toHaveBeenCalled();
  });

  it('A: 14h available / 10h working allocation → 4h remaining', async () => {
    const { service, prisma } = makeService();
    prisma.productionStageDefinition.findMany.mockResolvedValue([foamStage()]);
    prisma.scheduleAllocation.findMany.mockResolvedValue([
      {
        plannedStart: amman(2026, 8, 30, 8, 0),
        plannedEnd: amman(2026, 8, 30, 16, 0),
        employeeId: 'rana',
        productionTask: { stageDefinitionId: 'stg-foam' },
      },
      {
        plannedStart: amman(2026, 8, 30, 8, 0),
        plannedEnd: amman(2026, 8, 30, 11, 0),
        employeeId: 'yousef',
        productionTask: { stageDefinitionId: 'stg-foam' },
      },
    ]);

    const result = await service.listCapacity('2026-08-30', '2026-08-30', {
      granularity: 'day',
      includeWorkers: true,
    });
    const foam = result.data[0]!;
    expect(foam.availableMinutes).toBe(840);
    expect(foam.allocatedMinutes).toBe(600);
    expect(foam.remainingMinutes).toBe(240);
  });

  it('B: 14h / 14h working allocation is Full with remaining 0 and does not clamp', async () => {
    const { service, prisma } = makeService();
    prisma.productionStageDefinition.findMany.mockResolvedValue([foamStage()]);
    prisma.scheduleAllocation.findMany.mockResolvedValue([
      {
        plannedStart: amman(2026, 8, 30, 8, 0),
        plannedEnd: amman(2026, 8, 30, 16, 0),
        employeeId: 'rana',
        productionTask: { stageDefinitionId: 'stg-foam' },
      },
      {
        plannedStart: amman(2026, 8, 30, 8, 0),
        plannedEnd: amman(2026, 8, 30, 16, 0),
        employeeId: 'yousef',
        productionTask: { stageDefinitionId: 'stg-foam' },
      },
    ]);

    const result = await service.listCapacity('2026-08-30', '2026-08-30');
    expect(result.data[0]!.availableMinutes).toBe(840);
    expect(result.data[0]!.allocatedMinutes).toBe(840);
    expect(result.data[0]!.remainingMinutes).toBe(0);
  });

  it('C/H: Saturday→Sunday Foam allocation counts only Sunday 08:00–08:30', async () => {
    const { service, prisma } = makeService();
    prisma.productionStageDefinition.findMany.mockResolvedValue([foamStage()]);
    prisma.scheduleAllocation.findMany.mockResolvedValue([
      {
        plannedStart: amman(2026, 8, 29, 8, 55),
        plannedEnd: amman(2026, 8, 30, 8, 30),
        employeeId: 'rana',
        productionTask: { stageDefinitionId: 'stg-foam' },
      },
    ]);

    const sunday = await service.listCapacity('2026-08-30', '2026-08-30', { granularity: 'day' });
    expect(sunday.byDay![0]!.data[0]!.allocatedMinutes).toBe(30);
    const saturday = await service.listCapacity('2026-08-29', '2026-08-29', { granularity: 'day' });
    expect(saturday.byDay![0]!.data[0]!.allocatedMinutes).toBe(365);
  });

  it('D: lunch is excluded from allocated minutes', async () => {
    const { service, prisma } = makeService();
    prisma.productionStageDefinition.findMany.mockResolvedValue([foamStage()]);
    prisma.scheduleAllocation.findMany.mockResolvedValue([
      {
        plannedStart: amman(2026, 8, 30, 11, 0),
        plannedEnd: amman(2026, 8, 30, 14, 0),
        employeeId: 'rana',
        productionTask: { stageDefinitionId: 'stg-foam' },
      },
    ]);

    const result = await service.listCapacity('2026-08-30', '2026-08-30');
    expect(result.data[0]!.allocatedMinutes).toBe(120);
  });

  it('E: closed Friday has 0 available and 0 allocated', async () => {
    const { service, prisma } = makeService();
    prisma.productionStageDefinition.findMany.mockResolvedValue([foamStage()]);
    prisma.scheduleAllocation.findMany.mockResolvedValue([
      {
        plannedStart: amman(2026, 8, 7, 8, 0),
        plannedEnd: amman(2026, 8, 7, 16, 0),
        employeeId: 'rana',
        productionTask: { stageDefinitionId: 'stg-foam' },
      },
    ]);

    const result = await service.listCapacity('2026-08-07', '2026-08-07', { granularity: 'day' });
    expect(result.days![0]!.isWorking).toBe(false);
    expect(result.data[0]!.availableMinutes).toBe(0);
    expect(result.data[0]!.allocatedMinutes).toBe(0);
  });

  it('F: EXTRA_SHIFT Friday counts configured working minutes only', async () => {
    const { service, prisma } = makeService();
    prisma.factoryCalendarException.findMany.mockResolvedValue([
      {
        date: amman(2026, 8, 7, 12, 0),
        type: 'EXTRA_SHIFT',
        shiftStart: '08:00',
        shiftEnd: '16:00',
        note: 'Overtime',
      },
    ]);
    prisma.productionStageDefinition.findMany.mockResolvedValue([foamStage()]);
    prisma.scheduleAllocation.findMany.mockResolvedValue([
      {
        plannedStart: amman(2026, 8, 7, 8, 0),
        plannedEnd: amman(2026, 8, 7, 16, 0),
        employeeId: 'rana',
        productionTask: { stageDefinitionId: 'stg-foam' },
      },
    ]);

    const result = await service.listCapacity('2026-08-07', '2026-08-07', { granularity: 'day' });
    expect(result.days![0]!.isWorking).toBe(true);
    expect(result.data[0]!.availableMinutes).toBe(840);
    expect(result.data[0]!.allocatedMinutes).toBe(420);
  });

  it('reproduces Foam 30 Aug: 240 working minutes, not 1143 clock minutes', async () => {
    const { service, prisma } = makeService();
    prisma.productionStageDefinition.findMany.mockResolvedValue([foamStage()]);
    prisma.scheduleAllocation.findMany.mockResolvedValue([
      {
        plannedStart: amman(2026, 8, 29, 8, 55),
        plannedEnd: amman(2026, 8, 30, 8, 30),
        employeeId: 'rana',
        productionTask: { stageDefinitionId: 'stg-foam' },
      },
      {
        plannedStart: amman(2026, 8, 29, 12, 44),
        plannedEnd: amman(2026, 8, 30, 6, 52),
        employeeId: 'yousef',
        productionTask: { stageDefinitionId: 'stg-foam' },
      },
      {
        plannedStart: amman(2026, 8, 30, 5, 55),
        plannedEnd: amman(2026, 8, 30, 6, 0),
        employeeId: 'nour',
        productionTask: { stageDefinitionId: 'stg-foam' },
      },
      {
        plannedStart: amman(2026, 8, 30, 8, 30),
        plannedEnd: amman(2026, 8, 30, 12, 1),
        employeeId: 'rana',
        productionTask: { stageDefinitionId: 'stg-foam' },
      },
      {
        plannedStart: amman(2026, 8, 30, 12, 21),
        plannedEnd: amman(2026, 8, 30, 12, 26),
        employeeId: 'lina',
        productionTask: { stageDefinitionId: 'stg-foam' },
      },
    ]);

    const result = await service.listCapacity('2026-08-30', '2026-08-30', {
      granularity: 'day',
      includeWorkers: true,
    });
    const foam = result.data[0]!;
    expect(foam.availableMinutes).toBe(840);
    expect(foam.allocatedMinutes).toBe(240);
    expect(foam.remainingMinutes).toBe(600);
    expect(foam.allocatedMinutes).toBeLessThan(foam.availableMinutes);
  });

  it('does not clamp allocated when working minutes exceed available', async () => {
    const { service, prisma } = makeService();
    prisma.productionStageDefinition.findMany.mockResolvedValue([
      {
        ...foamStage(),
        workerSkills: [
          { userId: 'rana', user: { id: 'rana', firstName: 'Rana', lastName: 'Khatib' } },
        ],
      },
    ]);
    prisma.scheduleAllocation.findMany.mockResolvedValue([
      {
        plannedStart: amman(2026, 8, 30, 8, 0),
        plannedEnd: amman(2026, 8, 30, 16, 0),
        employeeId: 'rana',
        productionTask: { stageDefinitionId: 'stg-foam' },
      },
      {
        plannedStart: amman(2026, 8, 30, 8, 0),
        plannedEnd: amman(2026, 8, 30, 12, 0),
        employeeId: 'other',
        productionTask: { stageDefinitionId: 'stg-foam' },
      },
    ]);

    const result = await service.listCapacity('2026-08-30', '2026-08-30');
    expect(result.data[0]!.availableMinutes).toBe(420);
    expect(result.data[0]!.allocatedMinutes).toBe(660);
    expect(result.data[0]!.remainingMinutes).toBe(0);
  });

  function reconcileAllocated(row: {
    allocatedMinutes: number;
    workers?: Array<{ allocatedMinutes: number }>;
    ineligibleWorkers?: Array<{ allocatedMinutes: number }>;
    unassignedAllocatedMinutes?: number;
  }) {
    const eligible = (row.workers ?? []).reduce((sum, w) => sum + w.allocatedMinutes, 0);
    const ineligible = (row.ineligibleWorkers ?? []).reduce((sum, w) => sum + w.allocatedMinutes, 0);
    const unassigned = row.unassignedAllocatedMinutes ?? 0;
    expect(eligible + ineligible + unassigned).toBe(row.allocatedMinutes);
  }

  function deliveryStage(skills: Array<{ userId: string; first: string; last: string }>) {
    return {
      id: 'stg-delivery',
      code: 'DELIVERY',
      nameEn: 'Delivery',
      nameAr: 'توصيل',
      nameHe: null,
      schedulingResourceMode: 'WORKER_CONSTRAINED' as const,
      resourceSlots: 1,
      workerSkills: skills.map((s) => ({
        userId: s.userId,
        user: { id: s.userId, firstName: s.first, lastName: s.last },
      })),
    };
  }

  const omarYousef = [
    { userId: 'omar', first: 'Omar', last: 'Hijazi' },
    { userId: 'yousef', first: 'Yousef', last: 'Haddad' },
  ];

  it('Delivery 27 Aug: ineligible Basel+Anas explain 330m so 199+330=529', async () => {
    const { service, prisma } = makeService();
    prisma.factoryCalendarException.findMany.mockResolvedValue([
      {
        date: amman(2026, 8, 27, 12, 0),
        type: 'EXTRA_SHIFT',
        shiftStart: '08:00',
        shiftEnd: '23:00',
        note: 'Overtime',
      },
    ]);
    prisma.productionStageDefinition.findMany.mockResolvedValue([deliveryStage(omarYousef)]);
    prisma.scheduleAllocation.findMany.mockResolvedValue([
      {
        plannedStart: amman(2026, 8, 27, 9, 57),
        plannedEnd: amman(2026, 8, 27, 11, 9),
        employeeId: 'omar',
        employee: { firstName: 'Omar', lastName: 'Hijazi' },
        productionTask: { stageDefinitionId: 'stg-delivery' },
      },
      {
        plannedStart: amman(2026, 8, 27, 11, 9),
        plannedEnd: amman(2026, 8, 27, 13, 9),
        employeeId: 'omar',
        employee: { firstName: 'Omar', lastName: 'Hijazi' },
        productionTask: { stageDefinitionId: 'stg-delivery' },
      },
      {
        plannedStart: amman(2026, 8, 27, 22, 35),
        plannedEnd: amman(2026, 8, 29, 8, 56),
        employeeId: 'omar',
        employee: { firstName: 'Omar', lastName: 'Hijazi' },
        productionTask: { stageDefinitionId: 'stg-delivery' },
      },
      {
        plannedStart: amman(2026, 8, 27, 15, 21),
        plannedEnd: amman(2026, 8, 27, 16, 3),
        employeeId: 'yousef',
        employee: { firstName: 'Yousef', lastName: 'Haddad' },
        productionTask: { stageDefinitionId: 'stg-delivery' },
      },
      {
        plannedStart: amman(2026, 8, 27, 10, 38),
        plannedEnd: amman(2026, 8, 27, 13, 11),
        employeeId: 'basel',
        employee: { firstName: 'Basel', lastName: 'Smadi' },
        productionTask: { stageDefinitionId: 'stg-delivery' },
      },
      {
        plannedStart: amman(2026, 8, 27, 10, 38),
        plannedEnd: amman(2026, 8, 27, 13, 11),
        employeeId: 'basel',
        employee: { firstName: 'Basel', lastName: 'Smadi' },
        productionTask: { stageDefinitionId: 'stg-delivery' },
      },
      {
        plannedStart: amman(2026, 8, 27, 14, 47),
        plannedEnd: amman(2026, 8, 27, 15, 47),
        employeeId: 'basel',
        employee: { firstName: 'Basel', lastName: 'Smadi' },
        productionTask: { stageDefinitionId: 'stg-delivery' },
      },
      {
        plannedStart: amman(2026, 8, 27, 15, 8),
        plannedEnd: amman(2026, 8, 27, 15, 50),
        employeeId: 'basel',
        employee: { firstName: 'Basel', lastName: 'Smadi' },
        productionTask: { stageDefinitionId: 'stg-delivery' },
      },
      {
        plannedStart: amman(2026, 8, 27, 15, 8),
        plannedEnd: amman(2026, 8, 27, 15, 50),
        employeeId: 'anas',
        employee: { firstName: 'Anas', lastName: 'Freijat' },
        productionTask: { stageDefinitionId: 'stg-delivery' },
      },
    ]);

    const result = await service.listCapacity('2026-08-27', '2026-08-27', { includeWorkers: true });
    const row = result.data[0]!;
    expect(row.availableMinutes).toBe(1680);
    expect(row.allocatedMinutes).toBe(529);
    expect(row.remainingMinutes).toBe(1151);
    expect(row.eligibleWorkerCount).toBe(2);

    const omar = row.workers!.find((w) => w.employeeId === 'omar')!;
    const yousef = row.workers!.find((w) => w.employeeId === 'yousef')!;
    expect(omar).toMatchObject({ eligible: true, allocatedMinutes: 157, availableMinutes: 840 });
    expect(yousef).toMatchObject({ eligible: true, allocatedMinutes: 42, availableMinutes: 840 });
    expect(row.workers!.some((w) => w.employeeId === 'basel' || w.employeeId === 'anas')).toBe(false);

    const basel = row.ineligibleWorkers!.find((w) => w.employeeId === 'basel')!;
    const anas = row.ineligibleWorkers!.find((w) => w.employeeId === 'anas')!;
    expect(basel).toMatchObject({
      eligible: false,
      allocatedMinutes: 288,
      availableMinutes: 0,
      remainingMinutes: 0,
      firstName: 'Basel',
    });
    expect(anas).toMatchObject({ eligible: false, allocatedMinutes: 42, availableMinutes: 0 });
    expect(row.unassignedAllocatedMinutes).toBe(0);
    expect(157 + 42).toBe(199);
    expect(288 + 42).toBe(330);
    reconcileAllocated(row);
  });

  it('unassigned + ineligible + eligible minutes sum to stage allocated', async () => {
    const { service, prisma } = makeService();
    prisma.productionStageDefinition.findMany.mockResolvedValue([deliveryStage(omarYousef)]);
    prisma.scheduleAllocation.findMany.mockResolvedValue([
      {
        plannedStart: amman(2026, 8, 16, 8, 0),
        plannedEnd: amman(2026, 8, 16, 12, 0),
        employeeId: 'omar',
        employee: { firstName: 'Omar', lastName: 'Hijazi' },
        productionTask: { stageDefinitionId: 'stg-delivery' },
      },
      {
        plannedStart: amman(2026, 8, 16, 13, 0),
        plannedEnd: amman(2026, 8, 16, 15, 40),
        employeeId: 'omar',
        employee: { firstName: 'Omar', lastName: 'Hijazi' },
        productionTask: { stageDefinitionId: 'stg-delivery' },
      },
      {
        plannedStart: amman(2026, 8, 16, 8, 0),
        plannedEnd: amman(2026, 8, 16, 9, 40),
        employeeId: 'basel',
        employee: { firstName: 'Basel', lastName: 'Smadi' },
        productionTask: { stageDefinitionId: 'stg-delivery' },
      },
      {
        plannedStart: amman(2026, 8, 16, 13, 0),
        plannedEnd: amman(2026, 8, 16, 14, 40),
        employeeId: null,
        employee: null,
        productionTask: { stageDefinitionId: 'stg-delivery' },
      },
    ]);

    const result = await service.listCapacity('2026-08-16', '2026-08-16', { includeWorkers: true });
    const row = result.data[0]!;
    expect(row.allocatedMinutes).toBe(600);
    expect(row.workers!.find((w) => w.employeeId === 'omar')!.allocatedMinutes).toBe(400);
    expect(row.ineligibleWorkers!).toEqual([
      expect.objectContaining({ employeeId: 'basel', allocatedMinutes: 100, availableMinutes: 0 }),
    ]);
    expect(row.unassignedAllocatedMinutes).toBe(100);
    reconcileAllocated(row);
  });

  it('omits ineligible and unassigned sections when eligible workers explain all minutes', async () => {
    const { service, prisma } = makeService();
    prisma.productionStageDefinition.findMany.mockResolvedValue([foamStage()]);
    prisma.scheduleAllocation.findMany.mockResolvedValue([
      {
        plannedStart: amman(2026, 8, 30, 8, 0),
        plannedEnd: amman(2026, 8, 30, 12, 0),
        employeeId: 'rana',
        employee: { firstName: 'Rana', lastName: 'Khatib' },
        productionTask: { stageDefinitionId: 'stg-foam' },
      },
    ]);

    const result = await service.listCapacity('2026-08-30', '2026-08-30', { includeWorkers: true });
    const row = result.data[0]!;
    expect(row.ineligibleWorkers).toEqual([]);
    expect(row.unassignedAllocatedMinutes).toBe(0);
    expect(row.workers!.every((w) => w.eligible === true)).toBe(true);
    reconcileAllocated(row);
  });

  it('skill deactivation moves the worker to ineligibleWorkers without changing allocated minutes', async () => {
    const { service, prisma } = makeService();
    const allocation = {
      plannedStart: amman(2026, 8, 16, 8, 0),
      plannedEnd: amman(2026, 8, 16, 12, 0),
      employeeId: 'basel',
      employee: { firstName: 'Basel', lastName: 'Smadi' },
      productionTask: { stageDefinitionId: 'stg-delivery' },
    };
    prisma.scheduleAllocation.findMany.mockResolvedValue([allocation]);

    prisma.productionStageDefinition.findMany.mockResolvedValue([
      deliveryStage([...omarYousef, { userId: 'basel', first: 'Basel', last: 'Smadi' }]),
    ]);
    const withSkill = await service.listCapacity('2026-08-16', '2026-08-16', { includeWorkers: true });
    expect(withSkill.data[0]!.workers!.some((w) => w.employeeId === 'basel')).toBe(true);
    expect(withSkill.data[0]!.ineligibleWorkers).toEqual([]);
    expect(withSkill.data[0]!.allocatedMinutes).toBe(240);

    prisma.productionStageDefinition.findMany.mockResolvedValue([deliveryStage(omarYousef)]);
    const withoutSkill = await service.listCapacity('2026-08-16', '2026-08-16', {
      includeWorkers: true,
    });
    expect(withoutSkill.data[0]!.workers!.some((w) => w.employeeId === 'basel')).toBe(false);
    expect(withoutSkill.data[0]!.ineligibleWorkers).toEqual([
      expect.objectContaining({ employeeId: 'basel', allocatedMinutes: 240, availableMinutes: 0 }),
    ]);
    expect(withoutSkill.data[0]!.allocatedMinutes).toBe(240);
    expect(withoutSkill.data[0]!.availableMinutes).toBe(840);
    reconcileAllocated(withoutSkill.data[0]!);
  });

  it('skill reactivation returns the worker to workers only', async () => {
    const { service, prisma } = makeService();
    prisma.scheduleAllocation.findMany.mockResolvedValue([
      {
        plannedStart: amman(2026, 8, 16, 8, 0),
        plannedEnd: amman(2026, 8, 16, 12, 0),
        employeeId: 'basel',
        employee: { firstName: 'Basel', lastName: 'Smadi' },
        productionTask: { stageDefinitionId: 'stg-delivery' },
      },
    ]);
    prisma.productionStageDefinition.findMany.mockResolvedValue([
      deliveryStage([...omarYousef, { userId: 'basel', first: 'Basel', last: 'Smadi' }]),
    ]);

    const row = (await service.listCapacity('2026-08-16', '2026-08-16', { includeWorkers: true }))
      .data[0]!;
    expect(row.workers!.filter((w) => w.employeeId === 'basel')).toHaveLength(1);
    expect(row.ineligibleWorkers).toEqual([]);
    expect(row.workers!.find((w) => w.employeeId === 'basel')!.availableMinutes).toBe(420);
    reconcileAllocated(row);
  });

  it('inactive users with leftover allocations appear under ineligibleWorkers', async () => {
    const { service, prisma } = makeService();
    prisma.productionStageDefinition.findMany.mockResolvedValue([deliveryStage(omarYousef)]);
    prisma.scheduleAllocation.findMany.mockResolvedValue([
      {
        plannedStart: amman(2026, 8, 16, 8, 0),
        plannedEnd: amman(2026, 8, 16, 9, 0),
        employeeId: 'issa',
        employee: { firstName: 'Issa', lastName: 'Daoud' },
        productionTask: { stageDefinitionId: 'stg-delivery' },
      },
    ]);

    const row = (await service.listCapacity('2026-08-16', '2026-08-16', { includeWorkers: true }))
      .data[0]!;
    expect(row.workers!.some((w) => w.employeeId === 'issa')).toBe(false);
    expect(row.ineligibleWorkers).toEqual([
      expect.objectContaining({ employeeId: 'issa', allocatedMinutes: 60, availableMinutes: 0 }),
    ]);
    expect(row.availableMinutes).toBe(840);
    reconcileAllocated(row);
  });
});
