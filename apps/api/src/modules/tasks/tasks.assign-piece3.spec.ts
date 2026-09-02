import { BadRequestException, ConflictException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import type { PrismaService } from '../../common/prisma.service';
import type { IdempotencyService } from '../../common/idempotency.service';
import type { LocalStorageService } from '../../integrations/storage/local-storage.service';
import type { StagePipelineService } from '../production/stage-pipeline.service';
import type { InvoicesService } from '../invoices/invoices.service';

const WORKER_A = 'worker-a';
const WORKER_B = 'worker-b';

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

describe('TasksService assign — Piece 3 dates/conflicts', () => {
  function makeService(taskOverrides: Record<string, unknown> = {}) {
    const task = {
      id: 'task-1',
      status: 'NOT_STARTED',
      assignedEmployeeId: null,
      productionOrderId: 'po-1',
      stageDefinitionId: 'stage-cut',
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
    const scheduleAllocationFindMany = jest.fn().mockResolvedValue([]);
    const workerSkillCount = jest.fn().mockResolvedValue(0);
    const userFindFirst = jest.fn().mockResolvedValue({
      id: WORKER_B,
      isActive: true,
      archivedAt: null,
      roles: [{ role: { kind: 'PRODUCTION_WORKER' } }],
      workerSkills: [],
    });

    const prisma = {
      $transaction: jest.fn(async (ops: unknown) => {
        if (Array.isArray(ops)) return Promise.all(ops);
        return ops;
      }),
      productionTask: {
        findUnique: productionTaskFindUnique,
        findUniqueOrThrow: productionTaskFindUnique,
        update: productionTaskUpdate,
        findMany: productionTaskFindMany,
        count: jest.fn().mockResolvedValue(0),
      },
      scheduleAllocation: { findMany: scheduleAllocationFindMany },
      workerSkill: { count: workerSkillCount },
      user: { findFirst: userFindFirst },
      document: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const notifications = {
      sendFromTemplate: jest.fn().mockResolvedValue(undefined),
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
      notifications as never,
    );

    return {
      service,
      prisma,
      productionTaskUpdate,
      productionTaskFindMany,
      scheduleAllocationFindMany,
      userFindFirst,
      workerSkillCount,
      task,
    };
  }

  it('persists plannedStart and plannedCompletion', async () => {
    const { service, productionTaskUpdate } = makeService();
    await service.assign(
      'task-1',
      {
        employeeId: WORKER_B,
        plannedStart: '2026-09-01T08:00:00.000Z',
        plannedCompletion: '2026-09-01T16:00:00.000Z',
      },
      ['production-order.assign'],
    );
    expect(productionTaskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignedEmployeeId: WORKER_B,
          plannedStart: expect.any(Date),
          plannedCompletion: expect.any(Date),
        }),
      }),
    );
  });

  it('rejects plannedStart without plannedCompletion', async () => {
    const { service } = makeService();
    await expect(
      service.assign(
        'task-1',
        { employeeId: WORKER_B, plannedStart: '2026-09-01T08:00:00.000Z' },
        ['production-order.assign'],
      ),
    ).rejects.toMatchObject({ response: { code: 'DATE_INCOMPLETE' } });
  });

  it('blocks schedule conflict unless override with schedule.override', async () => {
    const { service, productionTaskFindMany } = makeService();
    productionTaskFindMany.mockResolvedValue([
      {
        id: 'other',
        name: 'Other',
        plannedStart: new Date('2026-09-01T10:00:00.000Z'),
        plannedCompletion: new Date('2026-09-01T14:00:00.000Z'),
        productionOrder: { number: 'PO-X' },
      },
    ]);

    await expect(
      service.assign(
        'task-1',
        {
          employeeId: WORKER_B,
          plannedStart: '2026-09-01T08:00:00.000Z',
          plannedCompletion: '2026-09-01T16:00:00.000Z',
        },
        ['production-order.assign'],
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    await expect(
      service.assign(
        'task-1',
        {
          employeeId: WORKER_B,
          plannedStart: '2026-09-01T08:00:00.000Z',
          plannedCompletion: '2026-09-01T16:00:00.000Z',
          overrideConflict: true,
        },
        ['production-order.assign'],
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    await service.assign(
      'task-1',
      {
        employeeId: WORKER_B,
        plannedStart: '2026-09-01T08:00:00.000Z',
        plannedCompletion: '2026-09-01T16:00:00.000Z',
        overrideConflict: true,
      },
      ['production-order.assign', 'schedule.override'],
    );
  });

  it('slides the planned window after a predecessor instead of blocking assign', async () => {
    const { service, productionTaskFindMany, productionTaskUpdate } = makeService({
      stageDefinition: {
        id: 'stage-asm',
        code: 'ASSEMBLY',
        nameEn: 'Assembly',
        dependsOnCodes: ['CUT'],
      },
    });
    productionTaskFindMany.mockResolvedValueOnce([
      {
        id: 'pred',
        plannedCompletion: new Date('2026-09-02T16:00:00.000Z'),
        plannedStart: new Date('2026-09-02T08:00:00.000Z'),
        stageDefinition: { code: 'CUT', nameEn: 'Cut' },
      },
    ]);

    await service.assign(
      'task-1',
      {
        employeeId: WORKER_B,
        plannedStart: '2026-09-01T08:00:00.000Z',
        plannedCompletion: '2026-09-01T12:00:00.000Z',
      },
      ['production-order.assign'],
    );

    expect(productionTaskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignedEmployeeId: WORKER_B,
          plannedStart: new Date('2026-09-02T16:00:00.000Z'),
          plannedCompletion: new Date('2026-09-02T20:00:00.000Z'),
        }),
      }),
    );
  });

  it('rejects reassign after PO is on the floor', async () => {
    const { service } = makeService({
      assignedEmployeeId: WORKER_A,
      productionOrder: { id: 'po-1', number: 'PO-1', status: 'IN_PROGRESS' },
    });
    await expect(
      service.assign('task-1', { employeeId: WORKER_B }, ['production-order.assign']),
    ).rejects.toMatchObject({ response: { code: 'REASSIGN_LOCKED' } });
  });

  it('rejects unqualified worker when skills exist', async () => {
    const { service, workerSkillCount, userFindFirst } = makeService();
    workerSkillCount.mockResolvedValue(1);
    userFindFirst.mockResolvedValue({
      id: WORKER_B,
      isActive: true,
      archivedAt: null,
      roles: [{ role: { kind: 'PRODUCTION_WORKER' } }],
      workerSkills: [],
    });
    await expect(
      service.assign('task-1', { employeeId: WORKER_B }, ['production-order.assign']),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
