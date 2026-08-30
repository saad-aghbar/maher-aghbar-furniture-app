/**
 * QC → targeted REPLAN wiring. Mocked Prisma only — not live proof.
 * Does not change planner, occupancy, conflicts, or QC disposition.
 */
import { QualityResult } from '@maher/database';
import { QualityController } from '../../quality/quality.controller';
import { ProductionReworkService } from '../../production/production-rework.service';
import { SchedulingService } from '../scheduling.service';

function makeScheduling(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = {
    product: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    scheduleAllocation: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
    factoryCalendar: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'cal-1',
        timezone: 'Asia/Amman',
        workingWeekdays: [0, 1, 2, 3, 4, 6],
        shiftStart: '08:00',
        shiftEnd: '16:00',
        breaks: [{ start: '12:00', end: '13:00' }],
        isDefault: true,
        deliveryBufferWorkingDays: 1,
      }),
    },
    factoryCalendarException: { findMany: jest.fn().mockResolvedValue([]) },
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
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
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
  const queue = { enqueue: jest.fn().mockResolvedValue(undefined), setProcessor: jest.fn() } as any;
  const service = new SchedulingService(prisma, notifications, idempotency, queue);
  return { service, prisma, queue, notifications };
}

function activeSchedule() {
  return { id: 'sch-1', productionOrderId: 'po-1', status: 'APPROVED', version: 1 };
}

function makeQuality() {
  const tx = {
    qualityInspectionItem: { updateMany: jest.fn() },
    qualityInspection: {
      update: jest.fn().mockResolvedValue({
        id: 'insp-1',
        result: QualityResult.PASSED,
        items: [],
        defects: [],
      }),
    },
    qualityDefect: { create: jest.fn() },
    reworkRequest: { create: jest.fn() },
    productionOrder: { update: jest.fn() },
    productionStageInstance: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'stg-insp',
        tasks: [{ id: 't-insp', status: 'READY' }],
        stageDefinition: { code: 'INSPECTION' },
      }),
    },
    productionTask: { update: jest.fn() },
    auditEvent: { create: jest.fn() },
  };
  const prisma = {
    qualityInspection: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 'insp-1',
        productionOrderId: 'po-1',
        result: null,
        stageCode: 'INSPECTION',
        notes: null,
      }),
      create: jest.fn().mockResolvedValue({ id: 'insp-1', productionOrderId: 'po-1', result: null }),
    },
    qualityChecklistTemplate: { findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  } as any;
  const sequences = { next: jest.fn().mockResolvedValue('QC-1') } as any;
  const pipeline = {
    onTaskComplete: jest.fn().mockResolvedValue(undefined),
    unlockReadyStages: jest.fn().mockResolvedValue(undefined),
    rollupProgress: jest.fn().mockResolvedValue(undefined),
  } as any;
  const productionInventory = {
    onInspectionPassed: jest.fn().mockResolvedValue(undefined),
    reverseFinishedGoods: jest.fn().mockResolvedValue(undefined),
  } as any;
  const rework = { startRework: jest.fn(), completeRework: jest.fn() } as any;
  const scheduling = {
    enqueueTargetedReplan: jest.fn().mockResolvedValue(undefined),
    generateForProductionOrder: jest.fn().mockResolvedValue(undefined),
  } as any;
  const floor = {
    getFloorContextForOrder: jest.fn(),
    buildTimeline: jest.fn(),
    listEligibleReworkStages: jest.fn(),
    qualityAttentionCards: jest.fn(),
  } as any;
  const notifications = {
    notifyAdminUsers: jest.fn().mockResolvedValue({ ok: true, count: 0 }),
  } as any;
  const controller = new QualityController(
    prisma,
    sequences,
    pipeline,
    productionInventory,
    rework,
    scheduling,
    floor,
    notifications,
  );
  return { controller, prisma, tx, scheduling, pipeline, productionInventory, sequences };
}

describe('enqueueTargetedReplan', () => {
  it('onTaskLifecycle complete enqueues REPLAN via the shared helper', async () => {
    const { service, prisma, queue } = makeScheduling();
    prisma.productionTask.findUnique.mockResolvedValue({
      id: 't1',
      productionOrderId: 'po-1',
      name: 'Carpentry',
      number: 'T-1',
    });
    prisma.productionSchedule.findFirst.mockResolvedValue(activeSchedule());

    await service.onTaskLifecycle('t1', 'complete');

    expect(queue.enqueue).toHaveBeenCalledWith('REPLAN', {
      productionOrderId: 'po-1',
      taskId: 't1',
      event: 'complete',
    });
    expect(queue.enqueue).not.toHaveBeenCalledWith('REPLAN_FACTORY', expect.anything());
    expect(prisma.productionSchedule.create).not.toHaveBeenCalled();
  });

  it('does not enqueue without an active schedule', async () => {
    const { service, prisma, queue } = makeScheduling();
    prisma.productionSchedule.findFirst.mockResolvedValue(null);
    await service.enqueueTargetedReplan('po-1', 'qc-pass', 't-insp');
    expect(queue.enqueue).not.toHaveBeenCalled();
  });
});

describe('QC submit wiring', () => {
  const user = { id: 'admin-1' } as any;

  it('QC pass after commit enqueues REPLAN qc-pass and does not generate on the request path', async () => {
    const { controller, scheduling, pipeline, productionInventory } = makeQuality();
    await controller.submit('insp-1', { result: QualityResult.PASSED }, user);

    expect(scheduling.enqueueTargetedReplan).toHaveBeenCalledWith('po-1', 'qc-pass', 't-insp');
    expect(scheduling.generateForProductionOrder).not.toHaveBeenCalled();
    expect(pipeline.onTaskComplete).toHaveBeenCalled();
    expect(productionInventory.onInspectionPassed).toHaveBeenCalled();
  });

  it('QC fail enqueues qc-fail and reverses FG', async () => {
    const { controller, scheduling, tx, productionInventory } = makeQuality();
    tx.qualityInspection.update.mockResolvedValue({
      id: 'insp-1',
      result: QualityResult.FAILED_REWORK_REQUIRED,
      items: [],
      defects: [],
    });
    await controller.submit(
      'insp-1',
      { result: QualityResult.FAILED_REWORK_REQUIRED, defectDescription: 'seam' },
      user,
    );

    expect(scheduling.enqueueTargetedReplan).toHaveBeenCalledWith('po-1', 'qc-fail');
    expect(scheduling.generateForProductionOrder).not.toHaveBeenCalled();
    expect(productionInventory.reverseFinishedGoods).toHaveBeenCalled();
    expect(tx.reworkRequest.create).toHaveBeenCalled();
  });

  it('second identical PASS submit does not enqueue again', async () => {
    const { controller, prisma, scheduling, tx } = makeQuality();
    prisma.qualityInspection.findUniqueOrThrow.mockResolvedValue({
      id: 'insp-1',
      productionOrderId: 'po-1',
      result: QualityResult.PASSED,
      stageCode: 'INSPECTION',
      notes: null,
    });
    tx.productionStageInstance.findFirst.mockResolvedValue({
      id: 'stg-insp',
      tasks: [{ id: 't-insp', status: 'COMPLETED' }],
      stageDefinition: { code: 'INSPECTION' },
    });
    await controller.submit('insp-1', { result: QualityResult.PASSED }, user);
    expect(scheduling.enqueueTargetedReplan).not.toHaveBeenCalled();
  });

  it('create inspection does not enqueue', async () => {
    const { controller, scheduling, sequences } = makeQuality();
    await controller.create({ productionOrderId: 'po-1', stageCode: 'INSPECTION' }, user);
    expect(sequences.next).toHaveBeenCalled();
    expect(scheduling.enqueueTargetedReplan).not.toHaveBeenCalled();
  });
});

describe('startRework / createForReturn / completeRework', () => {
  it('startRework enqueues rework-start and does not generateForProductionOrder', async () => {
    const originalTask = { id: 'orig-1', status: 'COMPLETED', estimatedMinutes: 60 };
    const tx = {
      reworkRequest: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'rw-1',
            productionOrderId: 'po-1',
            status: 'AWAITING_STAGE',
            description: 'QC fail',
            notes: null,
          })
          .mockResolvedValueOnce({
            id: 'rw-1',
            productionOrderId: 'po-1',
            tasks: [{ id: 'rework-task', isRework: true }],
            reentryStageInstance: { stageDefinition: { nameEn: 'Upholstery' } },
          }),
        update: jest.fn(),
      },
      productionStageInstance: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'uph-1',
          stageDefinitionId: 'sd-uph',
          stageDefinition: { code: 'UPHOLSTERY', nameEn: 'Upholstery' },
          tasks: [originalTask],
        }),
        update: jest.fn(),
      },
      productionTask: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'rework-task' }),
        update: jest.fn(),
      },
      productionOrder: { update: jest.fn() },
      auditEvent: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    } as any;
    const scheduling = {
      enqueueTargetedReplan: jest.fn().mockResolvedValue(undefined),
      generateForProductionOrder: jest.fn().mockResolvedValue(undefined),
    } as any;
    const service = new ProductionReworkService(prisma, { next: jest.fn().mockResolvedValue('TSK-9') } as any, scheduling);

    await service.startRework({
      reworkId: 'rw-1',
      stageInstanceId: 'uph-1',
      notes: 'Fix stitching',
      userId: 'admin-1',
    });

    expect(scheduling.enqueueTargetedReplan).toHaveBeenCalledWith('po-1', 'rework-start', 'rework-task');
    expect(scheduling.generateForProductionOrder).not.toHaveBeenCalled();
  });

  it('existing rework-task branch does not enqueue', async () => {
    const tx = {
      reworkRequest: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'rw-1',
            productionOrderId: 'po-1',
            status: 'IN_PROGRESS',
            notes: null,
          })
          .mockResolvedValueOnce({
            id: 'rw-1',
            productionOrderId: 'po-1',
            tasks: [{ id: 'existing-rw' }],
            reentryStageInstance: { stageDefinition: { nameEn: 'Upholstery' } },
          }),
        update: jest.fn(),
      },
      productionStageInstance: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'uph-1',
          stageDefinitionId: 'sd-uph',
          stageDefinition: { code: 'UPHOLSTERY', nameEn: 'Upholstery' },
          tasks: [],
        }),
      },
      productionTask: {
        findFirst: jest.fn().mockResolvedValue({ id: 'existing-rw', status: 'READY' }),
        create: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    } as any;
    const scheduling = {
      enqueueTargetedReplan: jest.fn().mockResolvedValue(undefined),
      generateForProductionOrder: jest.fn(),
    } as any;
    const service = new ProductionReworkService(prisma, { next: jest.fn() } as any, scheduling);

    await service.startRework({
      reworkId: 'rw-1',
      stageInstanceId: 'uph-1',
      userId: 'admin-1',
    });

    expect(tx.productionTask.create).not.toHaveBeenCalled();
    expect(scheduling.enqueueTargetedReplan).not.toHaveBeenCalled();
  });

  it('createForReturn enqueues rework-return only when a new rework is created', async () => {
    const tx = {
      reworkRequest: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'rw-new', productionOrderId: 'po-1' }),
      },
      productionOrder: {
        findFirst: jest.fn().mockResolvedValue({ id: 'po-1' }),
        update: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    } as any;
    const scheduling = { enqueueTargetedReplan: jest.fn().mockResolvedValue(undefined) } as any;
    const service = new ProductionReworkService(prisma, { next: jest.fn().mockResolvedValue('RW-9') } as any, scheduling);

    await service.createForReturn({
      returnId: 'ret-1',
      salesOrderId: 'so-1',
      description: 'return rework',
      userId: 'admin-1',
    });
    expect(scheduling.enqueueTargetedReplan).toHaveBeenCalledWith('po-1', 'rework-return');

    scheduling.enqueueTargetedReplan.mockClear();
    tx.reworkRequest.findFirst.mockResolvedValue({ id: 'rw-new', productionOrderId: 'po-1' });
    await service.createForReturn({
      returnId: 'ret-1',
      salesOrderId: 'so-1',
      description: 'return rework',
      userId: 'admin-1',
    });
    expect(scheduling.enqueueTargetedReplan).not.toHaveBeenCalled();
  });

  it('completeRework does not enqueue', async () => {
    const tx = {
      reworkRequest: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValueOnce({ id: 'rw-1', tasks: [{ status: 'COMPLETED' }] })
          .mockResolvedValueOnce({ id: 'rw-1', inspection: null, tasks: [] }),
        update: jest.fn(),
      },
      auditEvent: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    } as any;
    const scheduling = { enqueueTargetedReplan: jest.fn() } as any;
    const service = new ProductionReworkService(prisma, { next: jest.fn() } as any, scheduling);
    await service.completeRework('rw-1', 'admin-1');
    expect(scheduling.enqueueTargetedReplan).not.toHaveBeenCalled();
  });
});

describe('burst REPLAN persist', () => {
  it('three different events all enqueue; unchanged plan persists at most once', async () => {
    const { service, prisma, queue } = makeScheduling();
    prisma.productionSchedule.findFirst.mockResolvedValue(activeSchedule());

    await service.enqueueTargetedReplan('po-1', 'qc-pass', 't-insp');
    await service.enqueueTargetedReplan('po-1', 'rework-start', 't-rw');
    await service.enqueueTargetedReplan('po-1', 'complete', 't-1');

    expect(queue.enqueue).toHaveBeenCalledTimes(3);
    expect(queue.enqueue).toHaveBeenCalledWith('REPLAN', {
      productionOrderId: 'po-1',
      event: 'qc-pass',
      taskId: 't-insp',
    });
    expect(queue.enqueue).toHaveBeenCalledWith('REPLAN', {
      productionOrderId: 'po-1',
      event: 'rework-start',
      taskId: 't-rw',
    });
    expect(queue.enqueue).toHaveBeenCalledWith('REPLAN', {
      productionOrderId: 'po-1',
      event: 'complete',
      taskId: 't-1',
    });

    const versions: Array<{ id: string; version: number; status: string }> = [
      { id: 'sch-1', version: 1, status: 'APPROVED' },
    ];
    let genCalls = 0;
    jest.spyOn(service, 'generateForProductionOrder').mockImplementation(async () => {
      genCalls += 1;
      if (genCalls === 1) {
        await prisma.productionSchedule.updateMany({
          where: {
            productionOrderId: 'po-1',
            status: { in: ['DRAFT', 'PROPOSED', 'APPROVED', 'NEEDS_REVIEW'] },
          },
          data: { status: 'SUPERSEDED' },
        });
        versions[0]!.status = 'SUPERSEDED';
        const created = { id: 'sch-2', version: 2, status: 'APPROVED' };
        versions.push(created);
        await prisma.productionSchedule.create({ data: created });
        return created as never;
      }
      return versions.find((v) => ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW'].includes(v.status)) as never;
    });

    await (service as any).processSchedulingJob('REPLAN', { productionOrderId: 'po-1', event: 'qc-pass' });
    await (service as any).processSchedulingJob('REPLAN', {
      productionOrderId: 'po-1',
      event: 'rework-start',
    });
    await (service as any).processSchedulingJob('REPLAN', { productionOrderId: 'po-1', event: 'complete' });

    expect(genCalls).toBe(3);
    expect(prisma.productionSchedule.create).toHaveBeenCalledTimes(1);
    const active = versions.filter((v) => ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW'].includes(v.status));
    expect(active).toHaveLength(1);
    expect(active[0]!.version).toBe(2);
  });

  it('changed plan on a later job still leaves exactly one active version', async () => {
    const { service, prisma } = makeScheduling();
    const versions: Array<{ id: string; version: number; status: string }> = [
      { id: 'sch-1', version: 1, status: 'APPROVED' },
    ];
    let genCalls = 0;
    jest.spyOn(service, 'generateForProductionOrder').mockImplementation(async () => {
      genCalls += 1;
      for (const v of versions) {
        if (['APPROVED', 'PROPOSED', 'NEEDS_REVIEW'].includes(v.status)) v.status = 'SUPERSEDED';
      }
      await prisma.productionSchedule.updateMany({
        where: { productionOrderId: 'po-1' },
        data: { status: 'SUPERSEDED' },
      });
      const created = { id: `sch-${genCalls + 1}`, version: genCalls + 1, status: 'APPROVED' };
      versions.push(created);
      await prisma.productionSchedule.create({ data: created });
      return created as never;
    });

    await (service as any).processSchedulingJob('REPLAN', { productionOrderId: 'po-1', event: 'qc-fail' });
    await (service as any).processSchedulingJob('REPLAN', {
      productionOrderId: 'po-1',
      event: 'rework-start',
    });

    expect(genCalls).toBe(2);
    expect(prisma.productionSchedule.create).toHaveBeenCalledTimes(2);
    const active = versions.filter((v) => ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW'].includes(v.status));
    expect(active).toHaveLength(1);
    expect(active[0]!.version).toBe(3);
    expect(versions.filter((v) => v.status === 'SUPERSEDED').length).toBe(2);
  });

  it('REPLAN processor throw marks needs-review so the queue can retry; generate is after QC commit', async () => {
    const { service, prisma } = makeScheduling();
    prisma.productionSchedule.findFirst.mockResolvedValue(activeSchedule());
    prisma.productionOrder.findUnique.mockResolvedValue({ requiredDeliveryDate: null });
    jest.spyOn(service, 'generateForProductionOrder').mockRejectedValue(new Error('boom'));

    await expect(
      (service as any).processSchedulingJob('REPLAN', { productionOrderId: 'po-1', event: 'qc-pass' }),
    ).rejects.toThrow('boom');
    expect(prisma.productionSchedule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'NEEDS_REVIEW' }),
      }),
    );
  });
});
