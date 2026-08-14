import { ForbiddenException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import type { PrismaService } from '../../common/prisma.service';
import type { IdempotencyService } from '../../common/idempotency.service';
import type { LocalStorageService } from '../../integrations/storage/local-storage.service';
import type { StagePipelineService } from '../production/stage-pipeline.service';
import type { InvoicesService } from '../invoices/invoices.service';

const WORKER_PERMS = ['production-task.read', 'production-task.update-own', 'production-task.complete'];
const SUPERVISOR_PERMS = [...WORKER_PERMS, 'production-task.update-any'];

const LEAK_KEYS = [
  'progressPercent',
  'manufacturingCost',
  'costBreakdown',
  'productionPrice',
  'profit',
  'salary',
];

function assertNoLeaks(value: unknown, path = 'root'): void {
  if (value == null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNoLeaks(item, `${path}[${i}]`));
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (LEAK_KEYS.includes(key)) {
      throw new Error(`Leak field "${key}" present at ${path}`);
    }
    assertNoLeaks(child, `${path}.${key}`);
  }
}

function mockIdempotency(): IdempotencyService {
  const store = new Map<string, unknown>();
  return {
    get: jest.fn(async (scope: string, key: string) => store.get(`${scope}::${key}`) ?? null),
    put: jest.fn(async (params: { scope: string; key: string; response: unknown }) => {
      store.set(`${params.scope}::${params.key}`, params.response);
    }),
    once: jest.fn(async (scope, key, _meta, factory) => {
      if (!key) return { result: await factory(), replayed: false };
      const cached = store.get(`${scope}::${key}`);
      if (cached != null) return { result: cached, replayed: true };
      const result = await factory();
      store.set(`${scope}::${key}`, result);
      return { result, replayed: false };
    }),
  } as unknown as IdempotencyService;
}

describe('TasksService assignment isolation', () => {
  function makeService() {
    const productionTaskCount = jest.fn().mockResolvedValue(1);
    const productionTaskFindMany = jest.fn().mockResolvedValue([]);
    const productionTaskFindUniqueOrThrow = jest.fn();
    const documentFindMany = jest.fn().mockResolvedValue([]);

    const prisma: {
      $transaction: jest.Mock;
      productionTask: {
        count: jest.Mock;
        findMany: jest.Mock;
        findUniqueOrThrow: jest.Mock;
      };
      document: { findMany: jest.Mock };
    } = {
      $transaction: jest.fn(async (ops: unknown) => {
        if (Array.isArray(ops)) return Promise.all(ops);
        return (ops as (tx: unknown) => unknown)(prisma);
      }),
      productionTask: {
        count: productionTaskCount,
        findMany: productionTaskFindMany,
        findUniqueOrThrow: productionTaskFindUniqueOrThrow,
      },
      document: {
        findMany: documentFindMany,
      },
    };

    const storage = {
      createAccessToken: jest.fn(() => 'tok'),
    };

    const service = new TasksService(
      prisma as unknown as PrismaService,
      {} as StagePipelineService,
      { onStageTaskComplete: jest.fn(), assertStageInventoryReady: jest.fn() } as any,
      {} as InvoicesService,
      storage as unknown as LocalStorageService,
      mockIdempotency(),
      { sendFromTemplate: jest.fn().mockResolvedValue({ ok: true }), notifyAdminUsers: jest.fn().mockResolvedValue({ ok: true }), notifyCustomerUsers: jest.fn().mockResolvedValue({ ok: true }) } as any,
    );

    return {
      service,
      productionTaskCount,
      productionTaskFindMany,
      productionTaskFindUniqueOrThrow,
      documentFindMany,
    };
  }

  it('forces assignedEmployeeId = worker A on list when lacking update-any', async () => {
    const { service, productionTaskCount, productionTaskFindMany } = makeService();
    await service.list({ page: 1, pageSize: 20 }, 'worker-a', WORKER_PERMS);

    expect(productionTaskCount.mock.calls[0][0].where.assignedEmployeeId).toBe('worker-a');
    expect(productionTaskFindMany.mock.calls[0][0].where.assignedEmployeeId).toBe('worker-a');
  });

  it('never queries Worker B when Worker A lists tasks', async () => {
    const { service, productionTaskCount, productionTaskFindMany } = makeService();
    await service.list({ page: 1, pageSize: 20, scope: 'open' }, 'worker-a', WORKER_PERMS);

    const ids = [
      productionTaskCount.mock.calls[0][0].where.assignedEmployeeId,
      productionTaskFindMany.mock.calls[0][0].where.assignedEmployeeId,
    ];
    expect(ids.every((id) => id === 'worker-a')).toBe(true);
    expect(ids.includes('worker-b')).toBe(false);
  });

  it('defaults workers to open tasks (excludes completed/cancelled)', async () => {
    const { service, productionTaskFindMany } = makeService();
    await service.list({ page: 1, pageSize: 20 }, 'worker-a', WORKER_PERMS);
    expect(productionTaskFindMany.mock.calls[0][0].where.status).toEqual({
      notIn: ['COMPLETED', 'CANCELLED'],
    });
  });

  it('scopes completed list to COMPLETED + assignee', async () => {
    const { service, productionTaskFindMany } = makeService();
    await service.list(
      { page: 1, pageSize: 20, scope: 'completed' },
      'worker-a',
      WORKER_PERMS,
    );
    expect(productionTaskFindMany.mock.calls[0][0].where).toMatchObject({
      assignedEmployeeId: 'worker-a',
      status: 'COMPLETED',
    });
  });

  it('orders by priority desc then plannedCompletion asc', async () => {
    const { service, productionTaskFindMany } = makeService();
    await service.list({ page: 1, pageSize: 20 }, 'worker-a', WORKER_PERMS);
    expect(productionTaskFindMany.mock.calls[0][0].orderBy).toEqual([
      { priority: 'desc' },
      { plannedCompletion: 'asc' },
      { createdAt: 'desc' },
    ]);
  });

  it('forbids Worker A from viewing Worker B task detail', async () => {
    const { service, productionTaskFindUniqueOrThrow } = makeService();
    productionTaskFindUniqueOrThrow.mockResolvedValue({
      id: 'task-b',
      assignedEmployeeId: 'worker-b',
      productionOrderId: 'po-1',
      progressPercent: 40,
      productionOrder: {
        number: 'PO-1',
        product: { imageUrl: null },
        salesOrder: null,
      },
    });

    await expect(service.getById('task-b', 'worker-a', WORKER_PERMS)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows Worker A to view own task and strips progressPercent', async () => {
    const { service, productionTaskFindUniqueOrThrow, documentFindMany } = makeService();
    productionTaskFindUniqueOrThrow.mockResolvedValue({
      id: 'task-a',
      assignedEmployeeId: 'worker-a',
      productionOrderId: 'po-1',
      progressPercent: 60,
      name: 'Assembly',
      productionOrder: {
        number: 'PO-1',
        product: { imageUrl: 'https://example.com/sofa.png' },
        salesOrder: { number: 'ORD-1256' },
      },
    });
    documentFindMany.mockResolvedValue([]);

    const result = await service.getById('task-a', 'worker-a', WORKER_PERMS);
    expect(result.id).toBe('task-a');
    expect(result.salesOrderNumber).toBe('ORD-1256');
    expect(result.productImageUrl).toBe('https://example.com/sofa.png');
    assertNoLeaks(result);
    expect(JSON.stringify(result)).not.toContain('progressPercent');
  });

  it('lets supervisors list without forced assignee filter', async () => {
    const { service, productionTaskFindMany } = makeService();
    await service.list({ page: 1, pageSize: 20, scope: 'all' }, 'supervisor', SUPERVISOR_PERMS);
    expect(productionTaskFindMany.mock.calls[0][0].where.assignedEmployeeId).toBeUndefined();
  });
});
