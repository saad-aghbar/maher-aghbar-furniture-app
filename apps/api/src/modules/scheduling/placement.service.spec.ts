import { BadRequestException, ConflictException } from '@nestjs/common';
import { PlacementService } from './placement.service';
import type { PrismaService } from '../../common/prisma.service';

const WORKER = 'worker-b';

function makePrisma(taskOverrides: Record<string, unknown> = {}) {
  const task = {
    id: 'task-1',
    status: 'NOT_STARTED',
    assignedEmployeeId: null,
    productionOrderId: 'po-1',
    stageDefinitionId: 'stage-cut',
    estimatedMinutes: 60,
    plannedStart: null,
    plannedCompletion: null,
    productionOrder: { id: 'po-1', number: 'PO-1', status: 'PLANNED', releasedToFactoryAt: null },
    stageInstance: { status: 'PENDING' },
    stageDefinition: { id: 'stage-cut', code: 'CUT', nameEn: 'Cut', dependsOnCodes: [] as string[] },
    ...taskOverrides,
  };
  const update = jest.fn().mockImplementation(async ({ data }: { data: object }) => ({
    ...task,
    ...data,
    assignedEmployee: { id: WORKER, firstName: 'Sam', lastName: 'Worker', email: 'sam@example.com' },
    productionOrder: { id: 'po-1', number: 'PO-1', releasedToFactoryAt: null },
  }));
  const prisma = {
    productionTask: {
      findUnique: jest.fn().mockResolvedValue(task),
      findUniqueOrThrow: jest.fn().mockImplementation(async () => ({
        ...task,
        assignedEmployee: { id: WORKER, firstName: 'Sam', lastName: 'Worker', email: 'sam@example.com' },
        productionOrder: { id: 'po-1', number: 'PO-1', releasedToFactoryAt: null },
      })),
      findMany: jest.fn().mockResolvedValue([]),
      update: update,
    },
    user: {
      findFirst: jest.fn().mockResolvedValue({
        id: WORKER,
        isActive: true,
        archivedAt: null,
        roles: [{ role: { kind: 'PRODUCTION_WORKER' } }],
        workerSkills: [],
      }),
    },
    workerSkill: { count: jest.fn().mockResolvedValue(0) },
    scheduleAllocation: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  };
  return { prisma, task, update };
}

describe('PlacementService', () => {
  it('writes the task window without silently sliding a predecessor', async () => {
    const { prisma, update } = makePrisma();
    const service = new PlacementService(prisma as unknown as PrismaService);
    await service.placeTask({
      productionTaskId: 'task-1',
      employeeId: WORKER,
      plannedStart: '2026-09-01T08:00:00.000Z',
      plannedEnd: '2026-09-01T12:00:00.000Z',
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignedEmployeeId: WORKER,
          plannedStart: expect.any(Date),
          plannedCompletion: expect.any(Date),
        }),
      }),
    );
  });

  it('hard-blocks a window that starts before its predecessor', async () => {
    const { prisma } = makePrisma({
      stageDefinition: {
        id: 'stage-asm',
        code: 'ASSEMBLY',
        nameEn: 'Assembly',
        dependsOnCodes: ['CUT'],
      },
    });
    prisma.productionTask.findMany.mockResolvedValue([
      {
        plannedCompletion: new Date('2026-09-02T16:00:00.000Z'),
        plannedStart: new Date('2026-09-02T08:00:00.000Z'),
        stageDefinition: { code: 'CUT', nameEn: 'Cut' },
      },
    ]);
    const service = new PlacementService(prisma as unknown as PrismaService);
    await expect(
      service.placeTask({
        productionTaskId: 'task-1',
        employeeId: WORKER,
        plannedStart: '2026-09-01T08:00:00.000Z',
        plannedEnd: '2026-09-01T12:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('treats worker overlap as a warning that override can persist', async () => {
    const { prisma, update } = makePrisma();
    prisma.productionTask.findMany.mockResolvedValue([
      {
        id: 'other',
        name: 'Other',
        plannedStart: new Date('2026-09-01T10:00:00.000Z'),
        plannedCompletion: new Date('2026-09-01T14:00:00.000Z'),
        productionOrder: { number: 'PO-X' },
        assignedEmployee: { firstName: 'Sam', lastName: 'Worker' },
      },
    ]);
    const service = new PlacementService(prisma as unknown as PrismaService);
    await expect(
      service.placeTask({
        productionTaskId: 'task-1',
        employeeId: WORKER,
        plannedStart: '2026-09-01T08:00:00.000Z',
        plannedEnd: '2026-09-01T16:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    await service.placeTask({
      productionTaskId: 'task-1',
      employeeId: WORKER,
      plannedStart: '2026-09-01T08:00:00.000Z',
      plannedEnd: '2026-09-01T16:00:00.000Z',
      override: true,
      permissions: ['schedule.override'],
    });
    expect(update).toHaveBeenCalled();
  });
});
