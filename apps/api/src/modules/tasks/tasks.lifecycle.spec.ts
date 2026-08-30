import { ConflictException, ForbiddenException } from '@nestjs/common';
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

function mockIdempotency(): IdempotencyService & { store: Map<string, unknown> } {
  const store = new Map<string, unknown>();
  return {
    store,
    get: jest.fn(async (scope: string, key: string) => store.get(`${scope}::${key}`) ?? null),
    put: jest.fn(async (params: { scope: string; key: string; response: unknown }) => {
      store.set(`${params.scope}::${params.key}`, params.response);
    }),
    once: jest.fn(async (scope, key, _meta, factory) => {
      if (!key) return { result: await factory(), replayed: false };
      const hit = store.get(`${scope}::${key}`);
      if (hit != null) return { result: hit, replayed: true };
      const result = await factory();
      store.set(`${scope}::${key}`, result);
      return { result, replayed: false };
    }),
  } as unknown as IdempotencyService & { store: Map<string, unknown> };
}

describe('TasksService lifecycle (complete / duplicates / isolation)', () => {
  function makeService(taskOverrides: Record<string, unknown> = {}) {
    const task = {
      id: 'task-a',
      productionOrderId: 'po-1',
      assignedEmployeeId: WORKER_A,
      status: 'IN_PROGRESS',
      stageInstanceId: 'stage-1',
      blockers: [],
      stageDefinition: { requiresPhotos: false, dependsOnCodes: [] },
      actualStart: new Date(),
      ...taskOverrides,
    };

    const productionTaskFindUnique = jest.fn().mockResolvedValue(task);
    const productionTaskFindUniqueOrThrow = jest.fn().mockResolvedValue({
      ...task,
      productionOrder: {
        id: 'po-1',
        number: 'PO-1',
        product: { imageUrl: null },
        salesOrder: { number: 'ORD-1' },
      },
      photos: [],
    });
    const productionTaskUpdate = jest.fn().mockImplementation(async ({ data }: { data: object }) => ({
      ...task,
      ...data,
      stageDefinition: task.stageDefinition,
      productionOrder: { id: 'po-1', number: 'PO-1', progressPercent: 40, status: 'IN_PROGRESS' },
    }));
    const productionOrderFindUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'po-1',
        number: 'PO-1',
        progressPercent: 50,
        status: 'IN_PROGRESS',
      })
      .mockResolvedValue({ salesOrderId: null });

    const onTaskComplete = jest.fn().mockResolvedValue(undefined);
    const arePrereqsMet = jest.fn().mockResolvedValue(true);
    const documentCount = jest.fn().mockResolvedValue(0);
    const taskTimeEntryFindMany = jest.fn().mockResolvedValue([]);

    const prisma: {
      $transaction: jest.Mock;
      productionTask: {
        findUnique: jest.Mock;
        findUniqueOrThrow: jest.Mock;
        update: jest.Mock;
      };
      productionOrder: { findUnique: jest.Mock };
      productionOrderWorkflowSnapshotNode: { findFirst: jest.Mock };
      document: {
        count: jest.Mock;
        findMany: jest.Mock;
        updateMany: jest.Mock;
      };
      taskTimeEntry: { findMany: jest.Mock; update: jest.Mock };
    } = {
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
      productionTask: {
        findUnique: productionTaskFindUnique,
        findUniqueOrThrow: productionTaskFindUniqueOrThrow,
        update: productionTaskUpdate,
      },
      productionOrder: {
        findUnique: productionOrderFindUnique,
      },
      productionOrderWorkflowSnapshotNode: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      document: {
        count: documentCount,
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn(),
      },
      taskTimeEntry: {
        findMany: taskTimeEntryFindMany,
        update: jest.fn(),
      },
    };

    const idempotency = mockIdempotency();
    const pipeline = {
      onTaskComplete,
      onTaskStart: jest.fn(),
      arePrereqsMetForInstance: arePrereqsMet,
    } as unknown as StagePipelineService;
    const invoices = { ensureFromSalesOrder: jest.fn() } as unknown as InvoicesService;
    const storage = { createAccessToken: jest.fn(() => 'tok') } as unknown as LocalStorageService;

    const service = new TasksService(
      prisma as unknown as PrismaService,
      pipeline,
      { onStageTaskComplete: jest.fn().mockResolvedValue(undefined), assertStageInventoryReady: jest.fn().mockResolvedValue(undefined), onStageQtyProgress: jest.fn().mockResolvedValue(undefined) } as any,
      { hasUsageRows: jest.fn().mockResolvedValue(false), finalizeForTask: jest.fn().mockResolvedValue({ posted: false, reason: 'no_usage_rows' }), ensureExpectedLines: jest.fn(), recordLines: jest.fn() } as any,
      {
        registerFromTaskComplete: jest.fn(),
        markConsumedForStage: jest.fn(),
        claimRequirementsForTask: jest.fn().mockResolvedValue({ required: false, kits: [], unclaimed: [], allClaimed: true }),
      } as any,
      invoices,
      storage,
      idempotency,
      {
        sendFromTemplate: jest.fn().mockResolvedValue({ ok: true }),
        notifyAdminUsers: jest.fn().mockResolvedValue({ ok: true }),
        notifyCustomerUsers: jest.fn().mockResolvedValue({ ok: true }),
      } as any,
    );

    return {
      service,
      task,
      prisma,
      onTaskComplete,
      productionTaskUpdate,
      idempotency,
      productionOrderFindUnique,
    };
  }

  it('rejects Worker B completing Worker A task', async () => {
    const { service } = makeService();
    await expect(
      service.complete('task-a', WORKER_B, WORKER_PERMS, { idempotencyKey: 'dup-key-01' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('completes assigned task, unlocks pipeline, returns order progress', async () => {
    const { service, onTaskComplete, productionTaskUpdate } = makeService();
    const result = (await service.complete('task-a', WORKER_A, WORKER_PERMS, {
      idempotencyKey: 'complete-key-01',
    })) as { status: string; orderProgressPercent: number };

    expect(productionTaskUpdate).toHaveBeenCalled();
    expect(onTaskComplete).toHaveBeenCalledWith('po-1', 'stage-1', expect.anything());
    expect(result.status).toBe('COMPLETED');
    expect(result.orderProgressPercent).toBe(50);
  });

  it('replays duplicate complete with same idempotency key without second pipeline call', async () => {
    const { service, onTaskComplete, idempotency } = makeService();
    const first = await service.complete('task-a', WORKER_A, WORKER_PERMS, {
      idempotencyKey: 'complete-key-02',
    });
    // Simulate already completed for second path through status check if cache miss —
    // cache should hit first:
    expect(idempotency.put).toHaveBeenCalled();
    const second = await service.complete('task-a', WORKER_A, WORKER_PERMS, {
      idempotencyKey: 'complete-key-02',
    });
    expect(second).toEqual(first);
    expect(onTaskComplete).toHaveBeenCalledTimes(1);
  });

  it('idempotently returns completed task when status already COMPLETED', async () => {
    const { service, onTaskComplete } = makeService({ status: 'COMPLETED' });
    const result = await service.complete('task-a', WORKER_A, WORKER_PERMS, {
      idempotencyKey: 'complete-key-03',
    });
    expect(result).toBeTruthy();
    expect(onTaskComplete).not.toHaveBeenCalled();
  });

  it('conflicts when task is BLOCKED', async () => {
    const { service } = makeService({ status: 'BLOCKED' });
    await expect(
      service.complete('task-a', WORKER_A, WORKER_PERMS, { idempotencyKey: 'complete-key-04' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('conflicts when task is CANCELLED', async () => {
    const { service } = makeService({ status: 'CANCELLED' });
    await expect(
      service.complete('task-a', WORKER_A, WORKER_PERMS, { idempotencyKey: 'complete-key-05' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
