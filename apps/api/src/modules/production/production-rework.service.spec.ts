import { ProductionReworkService } from './production-rework.service';
import type { PrismaService } from '../../common/prisma.service';
import type { SequenceService } from '../../common/sequence.service';

describe('ProductionReworkService', () => {
  it('creates a new rework task and leaves original completed tasks unchanged', async () => {
    const originalTask = {
      id: 'orig-1',
      status: 'COMPLETED',
      actualCompletion: new Date('2026-01-01'),
      estimatedMinutes: 60,
    };
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
    } as unknown as PrismaService;
    const sequences = { next: jest.fn().mockResolvedValue('TSK-9') } as unknown as SequenceService;
    const service = new ProductionReworkService(prisma, sequences);

    await service.startRework({
      reworkId: 'rw-1',
      stageInstanceId: 'uph-1',
      notes: 'Fix stitching',
      userId: 'admin-1',
    });

    expect(tx.productionTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isRework: true,
          reworkRequestId: 'rw-1',
          stageInstanceId: 'uph-1',
          status: 'READY',
        }),
      }),
    );
    expect(tx.productionTask.update).not.toHaveBeenCalled();
    expect(originalTask.status).toBe('COMPLETED');
    expect(originalTask.actualCompletion).toEqual(new Date('2026-01-01'));
  });

  it('enqueues targeted REPLAN after a new rework task and does not generate on the request path', async () => {
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
          tasks: [{ estimatedMinutes: 60 }],
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
    } as unknown as PrismaService;
    const scheduling = {
      enqueueTargetedReplan: jest.fn().mockResolvedValue(undefined),
      generateForProductionOrder: jest.fn(),
    };
    const service = new ProductionReworkService(
      prisma,
      { next: jest.fn().mockResolvedValue('TSK-9') } as unknown as SequenceService,
      scheduling as never,
    );

    await service.startRework({
      reworkId: 'rw-1',
      stageInstanceId: 'uph-1',
      userId: 'admin-1',
    });

    expect(scheduling.enqueueTargetedReplan).toHaveBeenCalledWith('po-1', 'rework-start', 'rework-task');
    expect(scheduling.generateForProductionOrder).not.toHaveBeenCalled();
  });

  it('rejects a stage that does not belong to the production order', async () => {
    const tx = {
      reworkRequest: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'rw-1',
          productionOrderId: 'po-1',
          status: 'AWAITING_STAGE',
        }),
      },
      productionStageInstance: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const prisma = {
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    } as unknown as PrismaService;
    const service = new ProductionReworkService(prisma, {
      next: jest.fn(),
    } as unknown as SequenceService);

    await expect(
      service.startRework({
        reworkId: 'rw-1',
        stageInstanceId: 'other',
        userId: 'admin-1',
      }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_REWORK_STAGE' } });
  });
});
