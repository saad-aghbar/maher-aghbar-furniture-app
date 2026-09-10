import { TasksService } from './tasks.service';
import {
  workerAssignedRemainingOrdersWhere,
  workerAssignedRemainingTaskWhere,
} from '../production/worker-task-visibility';
import type { PrismaService } from '../../common/prisma.service';
import type { IdempotencyService } from '../../common/idempotency.service';
import type { LocalStorageService } from '../../integrations/storage/local-storage.service';
import type { StagePipelineService } from '../production/stage-pipeline.service';
import type { InvoicesService } from '../invoices/invoices.service';

function mockIdempotency(): IdempotencyService {
  return {
    get: jest.fn(),
    put: jest.fn(),
    once: jest.fn(async (_scope, _key, _meta, factory) => ({ result: await factory(), replayed: false })),
  } as unknown as IdempotencyService;
}

describe('TasksService.listMyOrders assignment', () => {
  function makeService(orders: unknown[]) {
    const productionOrderFindMany = jest.fn().mockResolvedValue(orders);
    const prisma = {
      productionOrder: { findMany: productionOrderFindMany },
      factoryCalendar: { findFirst: jest.fn().mockResolvedValue({ timezone: 'Asia/Amman' }) },
    };
    const service = new TasksService(
      prisma as unknown as PrismaService,
      {} as StagePipelineService,
      { onStageTaskComplete: jest.fn(), assertStageInventoryReady: jest.fn(), onStageQtyProgress: jest.fn() } as never,
      { hasUsageRows: jest.fn().mockResolvedValue(false), finalizeForTask: jest.fn(), ensureExpectedLines: jest.fn(), recordLines: jest.fn() } as never,
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
      { createAccessToken: jest.fn(() => 'tok') } as unknown as LocalStorageService,
      mockIdempotency(),
      {
        sendFromTemplate: jest.fn().mockResolvedValue({ ok: true }),
        notifyAdminUsers: jest.fn().mockResolvedValue({ ok: true }),
        notifyCustomerUsers: jest.fn().mockResolvedValue({ ok: true }),
      } as never,
    );
    return { service, productionOrderFindMany };
  }

  const assignedCarpentry = {
    id: 'po-1',
    number: 'PO-1',
    status: 'PLANNED',
    quantity: 1,
    productDescription: 'Dining table',
    plannedCompletionDate: null,
    requiredDeliveryDate: null,
    priority: 'HIGH',
    product: { id: 'p1', imageUrl: null, nameEn: 'Dining table', nameAr: 'طاولة', nameHe: null },
    salesOrder: {
      id: 'so-1',
      number: 'ORD-9',
      externalOrderNumber: 'EXT-441',
      customer: {
        code: 'D-12',
        name: 'Al Noor',
        nameEn: 'Al Noor',
        nameAr: 'النور',
        nameHe: null,
        companyName: 'Al Noor Co',
      },
    },
    tasks: [
      {
        id: 't-carp',
        status: 'NOT_STARTED',
        plannedStart: null,
        plannedCompletion: null,
        stageInstance: { status: 'PENDING' },
        stageDefinition: {
          code: 'CARPENTRY',
          nameEn: 'Carpentry',
          nameAr: 'نجارة',
          nameHe: null,
        },
      },
    ],
  };

  it('queries only remaining tasks assigned to that worker', async () => {
    const { service, productionOrderFindMany } = makeService([]);
    await service.listMyOrders('worker-a', 'open');
    expect(productionOrderFindMany.mock.calls[0][0].where).toEqual(
      workerAssignedRemainingOrdersWhere('worker-a'),
    );
    expect(productionOrderFindMany.mock.calls[0][0].select.tasks.where).toEqual(
      workerAssignedRemainingTaskWhere('worker-a'),
    );
    expect(JSON.stringify(productionOrderFindMany.mock.calls[0][0].where)).not.toContain(
      'releasedToFactoryAt',
    );
  });

  it('returns an assigned carpentry order that is still unreleased', async () => {
    const { service } = makeService([assignedCarpentry]);
    const result = await service.listMyOrders('worker-a', 'open');
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: 'po-1',
      number: 'PO-1',
      salesOrderNumber: 'ORD-9',
      externalOrderNumber: 'EXT-441',
      status: 'PLANNED',
      assignedStages: [{ code: 'CARPENTRY', nameEn: 'Carpentry' }],
      dealer: { nameEn: 'Al Noor' },
      myTaskCount: 1,
      blockedCount: 1,
    });
  });

  it('does not invent orders when the worker has no remaining assignment', async () => {
    const { service } = makeService([]);
    const result = await service.listMyOrders('worker-a', 'open');
    expect(result.data).toEqual([]);
  });

  it('caps the open list at 80 and bypasses that cap when searching', async () => {
    const { service, productionOrderFindMany } = makeService([]);
    await service.listMyOrders('worker-a', 'open');
    expect(productionOrderFindMany.mock.calls[0][0].take).toBe(80);
    await service.listMyOrders('worker-a', 'today', 'ORD-9');
    expect(productionOrderFindMany.mock.calls[1][0].take).toBeUndefined();
  });

  it('hides remaining work scheduled after factory today', async () => {
    const future = {
      ...assignedCarpentry,
      id: 'po-future',
      number: 'PO-FUTURE',
      tasks: [
        {
          ...assignedCarpentry.tasks[0],
          id: 't-future',
          plannedStart: new Date('2099-01-15T08:00:00.000Z'),
          plannedCompletion: new Date('2099-01-15T16:00:00.000Z'),
        },
      ],
    };
    const { service } = makeService([future]);
    const result = await service.listMyOrders('worker-a', 'open');
    expect(result.data).toEqual([]);
  });

  it('finds an order number on the Open base even when Due today is selected', async () => {
    const laterDeadline = {
      ...assignedCarpentry,
      plannedCompletionDate: new Date('2099-01-15T12:00:00.000Z'),
      requiredDeliveryDate: new Date('2099-01-15T12:00:00.000Z'),
      tasks: [
        {
          ...assignedCarpentry.tasks[0],
          plannedStart: null,
          plannedCompletion: new Date('2099-01-15T16:00:00.000Z'),
        },
      ],
    };
    const { service } = makeService([laterDeadline]);
    const today = await service.listMyOrders('worker-a', 'today');
    expect(today.data).toEqual([]);
    const found = await service.listMyOrders('worker-a', 'today', 'ORD-9');
    expect(found.data).toHaveLength(1);
    expect(found.data[0]?.salesOrderNumber).toBe('ORD-9');
  });
});
