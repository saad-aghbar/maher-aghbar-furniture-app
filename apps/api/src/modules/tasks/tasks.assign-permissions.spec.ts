import { BadRequestException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import type { PrismaService } from '../../common/prisma.service';
import type { IdempotencyService } from '../../common/idempotency.service';
import type { LocalStorageService } from '../../integrations/storage/local-storage.service';
import type { StagePipelineService } from '../production/stage-pipeline.service';
import type { InvoicesService } from '../invoices/invoices.service';

const WORKER_A = 'worker-a';
const WORKER_B = 'worker-b';
const WORKER_PERMS = [
  'production-task.read',
  'production-task.update-own',
  'production-task.complete',
];
const SUPERVISOR_PERMS = [
  ...WORKER_PERMS,
  'production-task.update-any',
  'production-order.assign',
];

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

describe('TasksService assign permissions & visibility', () => {
  function makeService(taskOverrides: Record<string, unknown> = {}) {
    const task = {
      id: 'task-1',
      status: 'NOT_STARTED',
      assignedEmployeeId: null,
      productionOrderId: 'po-1',
      productionOrder: { id: 'po-1', number: 'PO-1', status: 'IN_PROGRESS' },
      stageInstance: { status: 'READY' },
      stageDefinition: { code: 'CUT', dependsOnCodes: [] },
      ...taskOverrides,
    };

    const productionTaskFindUnique = jest.fn().mockResolvedValue(task);
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
    const productionTaskFindMany = jest.fn().mockResolvedValue([]);
    const productionTaskCount = jest.fn().mockResolvedValue(0);
    const userFindFirst = jest.fn().mockResolvedValue({
      id: WORKER_B,
      isActive: true,
      archivedAt: null,
      roles: [{ role: { kind: 'PRODUCTION_WORKER' } }],
      workerSkills: [],
    });

    const prisma: {
      $transaction: jest.Mock;
      productionTask: {
        findUnique: jest.Mock;
        findUniqueOrThrow: jest.Mock;
        update: jest.Mock;
        findMany: jest.Mock;
        count: jest.Mock;
      };
      user: { findFirst: jest.Mock };
      document: { findMany: jest.Mock };
      workerSkill: { count: jest.Mock };
      scheduleAllocation: { findMany: jest.Mock };
    } = {
      $transaction: jest.fn(async (ops: unknown) => {
        if (Array.isArray(ops)) return Promise.all(ops);
        return (ops as (tx: unknown) => unknown)(prisma);
      }),
      productionTask: {
        findUnique: productionTaskFindUnique,
        findUniqueOrThrow: jest.fn().mockResolvedValue(task),
        update: productionTaskUpdate,
        findMany: productionTaskFindMany,
        count: productionTaskCount,
      },
      user: { findFirst: userFindFirst },
      document: { findMany: jest.fn().mockResolvedValue([]) },
      workerSkill: { count: jest.fn().mockResolvedValue(0) },
      scheduleAllocation: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const service = new TasksService(
      prisma as unknown as PrismaService,
      {} as StagePipelineService,
      { onStageTaskComplete: jest.fn(), assertStageInventoryReady: jest.fn(), onStageQtyProgress: jest.fn() } as any,
      { hasUsageRows: jest.fn().mockResolvedValue(false), finalizeForTask: jest.fn(), ensureExpectedLines: jest.fn(), recordLines: jest.fn() } as any,
      {
        registerFromTaskComplete: jest.fn(),
        markConsumedForStage: jest.fn(),
        claimRequirementsForTask: jest.fn().mockResolvedValue({ required: false, kits: [], unclaimed: [], allClaimed: true }),
      } as any,
      {} as InvoicesService,
      { createAccessToken: jest.fn(() => 'tok') } as unknown as LocalStorageService,
      mockIdempotency(),
      { sendFromTemplate: jest.fn().mockResolvedValue({ ok: true }), notifyAdminUsers: jest.fn().mockResolvedValue({ ok: true }), notifyCustomerUsers: jest.fn().mockResolvedValue({ ok: true }) } as any,
    );

    return {
      service,
      prisma,
      productionTaskFindMany,
      productionTaskUpdate,
      userFindFirst,
    };
  }

  it('assigns a worker when task is NOT_STARTED', async () => {
    const { service, productionTaskUpdate } = makeService();
    const result = await service.assign('task-1', { employeeId: WORKER_B });
    expect(productionTaskUpdate).toHaveBeenCalled();
    expect(result.assignedEmployeeId ?? result.assignedEmployee?.id).toBe(WORKER_B);
  });

  it('reassigns when still not started', async () => {
    const { service, productionTaskUpdate } = makeService({
      assignedEmployeeId: WORKER_A,
      status: 'READY',
      productionOrder: { id: 'po-1', number: 'PO-1', status: 'PLANNED' },
    });
    await service.assign('task-1', { employeeId: WORKER_B, priority: 'HIGH' });
    expect(productionTaskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignedEmployeeId: WORKER_B,
          priority: 'HIGH',
        }),
      }),
    );
  });

  it('rejects assign when task is in progress (ASSIGN_LOCKED)', async () => {
    const { service } = makeService({ status: 'IN_PROGRESS' });
    await expect(service.assign('task-1', { employeeId: WORKER_B })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    try {
      await service.assign('task-1', { employeeId: WORKER_B });
    } catch (e) {
      expect((e as BadRequestException).getResponse()).toMatchObject({
        code: 'ASSIGN_LOCKED',
      });
    }
  });

  it('rejects assign on completed production order', async () => {
    const { service } = makeService({
      productionOrder: { id: 'po-1', number: 'PO-1', status: 'COMPLETED' },
    });
    await expect(service.assign('task-1', { employeeId: WORKER_B })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ASSIGN_LOCKED' }),
    });
  });

  it('workers without update-any only see their own tasks', async () => {
    const { service, productionTaskFindMany } = makeService();
    await service.list({ page: 1, pageSize: 20, scope: 'open' }, WORKER_A, WORKER_PERMS);
    expect(productionTaskFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ assignedEmployeeId: WORKER_A }),
      }),
    );
  });

  it('supervisors with update-any see all workers tasks', async () => {
    const { service, productionTaskFindMany } = makeService();
    await service.list({ page: 1, pageSize: 20, scope: 'open' }, WORKER_A, SUPERVISOR_PERMS);
    const where = productionTaskFindMany.mock.calls[0][0].where;
    expect(where.assignedEmployeeId).toBeUndefined();
  });
});
