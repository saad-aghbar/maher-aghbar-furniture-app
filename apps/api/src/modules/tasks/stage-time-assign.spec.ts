import { BadRequestException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import type { PrismaService } from '../../common/prisma.service';
import type { IdempotencyService } from '../../common/idempotency.service';
import type { LocalStorageService } from '../../integrations/storage/local-storage.service';
import type { StagePipelineService } from '../production/stage-pipeline.service';
import type { InvoicesService } from '../invoices/invoices.service';

function mockIdempotency(): IdempotencyService {
  return {
    get: jest.fn(),
    put: jest.fn(),
    once: jest.fn(async (_s, _k, _m, factory) => ({
      result: await factory(),
      replayed: false,
    })),
  } as unknown as IdempotencyService;
}

describe('TasksService assign — stage time', () => {
  function makeService(taskOverrides: Record<string, unknown> = {}) {
    const task = {
      id: 'task-1',
      status: 'NOT_STARTED',
      assignedEmployeeId: null,
      productionOrderId: 'po-1',
      stageDefinitionId: 'stage-cut',
      stageInstanceId: 'si-1',
      estimatedMinutes: null,
      productionOrder: { id: 'po-1', number: 'PO-1', status: 'PLANNED' },
      stageInstance: { status: 'PENDING' },
      stageDefinition: {
        id: 'stage-cut',
        code: 'CUT',
        nameEn: 'Cut',
        dependsOnCodes: [] as string[],
      },
      ...taskOverrides,
    };

    const snapshotFindUnique = jest.fn().mockResolvedValue(null);
    const snapshotUpdate = jest.fn().mockResolvedValue({ id: 'snap-1' });
    const productionTaskUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const productionTaskUpdate = jest.fn().mockImplementation(async ({ data }: { data: object }) => ({
      ...task,
      ...data,
      assignedEmployee: {
        id: (data as { assignedEmployeeId?: string }).assignedEmployeeId,
        firstName: 'Sam',
        lastName: 'Worker',
        email: 'sam@example.com',
      },
      stageDefinition: task.stageDefinition,
      productionOrder: { id: 'po-1', number: 'PO-1' },
    }));

    const prisma = {
      productionTask: {
        findUnique: jest.fn().mockResolvedValue(task),
        findUniqueOrThrow: jest.fn().mockResolvedValue(task),
        update: productionTaskUpdate,
        updateMany: productionTaskUpdateMany,
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      productionOrderWorkflowSnapshotNode: {
        findUnique: snapshotFindUnique,
        update: snapshotUpdate,
      },
      scheduleAllocation: { findMany: jest.fn().mockResolvedValue([]) },
      workerSkill: { count: jest.fn().mockResolvedValue(0) },
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'worker-b',
          isActive: true,
          archivedAt: null,
          roles: [{ role: { kind: 'PRODUCTION_WORKER' } }],
          workerSkills: [],
        }),
      },
      document: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const service = new TasksService(
      prisma as unknown as PrismaService,
      {} as StagePipelineService,
      {
        onStageTaskComplete: jest.fn(),
        assertStageInventoryReady: jest.fn(),
        onStageQtyProgress: jest.fn(),
      } as never,
      {
        hasUsageRows: jest.fn().mockResolvedValue(false),
        finalizeForTask: jest.fn(),
        ensureExpectedLines: jest.fn(),
        recordLines: jest.fn(),
      } as never,
      {
        registerFromTaskComplete: jest.fn(),
        markConsumedForStage: jest.fn(),
        claimRequirementsForTask: jest.fn().mockResolvedValue({
          required: false,
          kits: [],
          unclaimed: [],
          allClaimed: true,
        }),
      } as never,
      {} as InvoicesService,
      {} as LocalStorageService,
      mockIdempotency(),
      { sendFromTemplate: jest.fn().mockResolvedValue(undefined) } as never,
    );

    return {
      service,
      snapshotFindUnique,
      snapshotUpdate,
      productionTaskUpdate,
      productionTaskUpdateMany,
    };
  }

  it('rejects assign when the stage has no time', async () => {
    const { service } = makeService();
    await expect(
      service.assign('task-1', { employeeId: 'worker-b' }, ['production-order.assign']),
    ).rejects.toMatchObject({
      response: { code: 'STAGE_TIME_REQUIRED' },
    });
    await expect(
      service.assign('task-1', { employeeId: 'worker-b' }, ['production-order.assign']),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uses snapshot minutes when the task estimate is empty', async () => {
    const { service, snapshotFindUnique, productionTaskUpdate } = makeService();
    snapshotFindUnique.mockResolvedValue({ id: 'snap-1', estimatedMinutes: 30 });
    await service.assign('task-1', { employeeId: 'worker-b' }, ['production-order.assign']);
    expect(productionTaskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estimatedMinutes: 30 }),
      }),
    );
  });

  it('writes a changed assign duration back to the snapshot and sibling tasks', async () => {
    const { service, snapshotFindUnique, snapshotUpdate, productionTaskUpdateMany } =
      makeService({ estimatedMinutes: 90 });
    snapshotFindUnique.mockResolvedValue({ id: 'snap-1', estimatedMinutes: 90 });
    await service.assign(
      'task-1',
      { employeeId: 'worker-b', estimatedMinutes: 30 },
      ['production-order.assign'],
    );
    expect(snapshotUpdate).toHaveBeenCalledWith({
      where: { id: 'snap-1' },
      data: { estimatedMinutes: 30, estimateReviewRequired: false },
    });
    expect(productionTaskUpdateMany).toHaveBeenCalledWith({
      where: { stageInstanceId: 'si-1' },
      data: { estimatedMinutes: 30 },
    });
  });

  it('does not write back when the duration is unchanged', async () => {
    const { service, snapshotFindUnique, snapshotUpdate } = makeService({
      estimatedMinutes: 90,
    });
    snapshotFindUnique.mockResolvedValue({ id: 'snap-1', estimatedMinutes: 90 });
    await service.assign('task-1', { employeeId: 'worker-b' }, ['production-order.assign']);
    expect(snapshotUpdate).not.toHaveBeenCalled();
  });
});
