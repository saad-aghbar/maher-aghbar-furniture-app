import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';

describe('TasksService.resolveBlocker', () => {
  function makeService() {
    const blocker = {
      id: 'blk-1',
      taskId: 'task-1',
      resolvedAt: null,
      resolutionVoiceDocumentId: null,
      resolutionPhotoDocumentIds: [],
      task: {
        id: 'task-1',
        name: 'Carpentry',
        assignedEmployeeId: 'worker-1',
        productionOrder: { id: 'po-1', number: 'PO-1' },
      },
    };
    const prisma = {
      taskBlocker: {
        findFirst: jest.fn().mockResolvedValue(blocker),
        update: jest.fn().mockImplementation(async ({ data }: { data: object }) => ({
          ...blocker,
          ...data,
        })),
      },
    };
    const notifications = {
      sendFromTemplate: jest.fn().mockResolvedValue({ ok: true }),
    };
    const service = new TasksService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      notifications as never,
    );
    return { service, prisma, notifications };
  }

  it('writes resolution fields and notifies the worker', async () => {
    const { service, prisma, notifications } = makeService();
    const result = await service.resolveBlocker(
      'task-1',
      'blk-1',
      { resolution: 'Use spare blades' },
      'admin-1',
      ['production-task.update-any'],
    );
    expect(prisma.taskBlocker.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'blk-1' },
        data: expect.objectContaining({
          resolution: 'Use spare blades',
          resolvedById: 'admin-1',
        }),
      }),
    );
    expect(notifications.sendFromTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        templateCode: 'PRODUCTION_PROBLEM_ANSWERED',
        to: { userId: 'worker-1' },
      }),
    );
    expect(result.resolution).toBe('Use spare blades');
  });

  it('stores answer photos when provided', async () => {
    const { service, prisma } = makeService();
    await service.resolveBlocker(
      'task-1',
      'blk-1',
      {
        resolution: 'Shown in photo',
        resolutionPhotoDocumentIds: ['11111111-1111-4111-8111-111111111111'],
      },
      'admin-1',
      ['production-task.update-any'],
    );
    expect(prisma.taskBlocker.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resolutionPhotoDocumentIds: ['11111111-1111-4111-8111-111111111111'],
        }),
      }),
    );
  });

  it('rejects workers without update-any', async () => {
    const { service } = makeService();
    await expect(
      service.resolveBlocker('task-1', 'blk-1', { resolution: 'ok' }, 'worker-1', [
        'production-task.update-own',
      ]),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('404s when the blocker is missing', async () => {
    const { service, prisma } = makeService();
    prisma.taskBlocker.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.resolveBlocker('task-1', 'missing', { resolution: 'ok' }, 'admin-1', [
        'production-task.update-any',
      ]),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
