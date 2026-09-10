import { BadRequestException } from '@nestjs/common';
import { WorkflowController } from './workflow.controller';

describe('PATCH production-orders/:id/workflow stage time', () => {
  const user = { id: 'admin-1' } as never;

  function makeController(opts: {
    releasedToFactoryAt?: Date | null;
    snapshotMinutes?: number;
    stageStatus?: string;
  }) {
    const snapshot = {
      id: 'snap-1',
      productionOrderId: 'po-1',
      nodes: [
        {
          id: 'node-1',
          estimatedMinutes: opts.snapshotMinutes ?? 60,
          stageInstanceId: 'si-1',
        },
      ],
    };
    const productionTaskUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const snapshotNodeUpdate = jest.fn().mockResolvedValue({ id: 'node-1' });
    const prisma = {
      productionOrderWorkflowSnapshot: {
        findUnique: jest.fn().mockResolvedValue(snapshot),
        update: jest.fn().mockResolvedValue(snapshot),
      },
      productionOrder: {
        findUnique: jest.fn().mockResolvedValue({
          releasedToFactoryAt: opts.releasedToFactoryAt ?? null,
          actualStartDate: null,
          status: 'PLANNED',
        }),
        update: jest.fn(),
      },
      productionStageInstance: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'si-1', status: opts.stageStatus ?? 'PENDING' },
        ]),
      },
      productionOrderWorkflowSnapshotNode: {
        update: snapshotNodeUpdate,
      },
      productionTask: {
        updateMany: productionTaskUpdateMany,
      },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const graphs = { getGraph: jest.fn().mockResolvedValue({ productionOrderId: 'po-1' }) };
    const controller = new WorkflowController(
      {} as never,
      graphs as never,
      {} as never,
      prisma as never,
    );
    return { controller, productionTaskUpdateMany, snapshotNodeUpdate };
  }

  it('rejects with STAGE_TIME_LOCKED after the plan is confirmed', async () => {
    const { controller, productionTaskUpdateMany } = makeController({
      releasedToFactoryAt: new Date('2026-09-01T00:00:00.000Z'),
    });
    await expect(
      controller.customizeOrderWorkflow(
        'po-1',
        { nodes: [{ snapshotNodeId: 'node-1', estimatedMinutes: 90 }] },
        user,
      ),
    ).rejects.toMatchObject({
      response: { code: 'STAGE_TIME_LOCKED' },
    });
    expect(productionTaskUpdateMany).not.toHaveBeenCalled();
    expect.assertions(2);
  });

  it('clears the assignment when minutes change on a pending stage', async () => {
    const { controller, productionTaskUpdateMany } = makeController({
      snapshotMinutes: 60,
      stageStatus: 'PENDING',
    });
    await controller.customizeOrderWorkflow(
      'po-1',
      { nodes: [{ snapshotNodeId: 'node-1', estimatedMinutes: 90 }] },
      user,
    );
    expect(productionTaskUpdateMany).toHaveBeenCalledWith({
      where: { stageInstanceId: 'si-1' },
      data: {
        estimatedMinutes: 90,
        assignedEmployeeId: null,
        plannedStart: null,
        plannedCompletion: null,
      },
    });
  });

  it('leaves the assignment intact when the value is unchanged', async () => {
    const { controller, productionTaskUpdateMany } = makeController({
      snapshotMinutes: 60,
      stageStatus: 'PENDING',
    });
    await controller.customizeOrderWorkflow(
      'po-1',
      { nodes: [{ snapshotNodeId: 'node-1', estimatedMinutes: 60 }] },
      user,
    );
    expect(productionTaskUpdateMany).toHaveBeenCalledWith({
      where: { stageInstanceId: 'si-1' },
      data: { estimatedMinutes: 60 },
    });
  });

  it('leaves the assignment intact when the stage is in progress', async () => {
    const { controller, productionTaskUpdateMany } = makeController({
      snapshotMinutes: 60,
      stageStatus: 'IN_PROGRESS',
    });
    await controller.customizeOrderWorkflow(
      'po-1',
      { nodes: [{ snapshotNodeId: 'node-1', estimatedMinutes: 90 }] },
      user,
    );
    expect(productionTaskUpdateMany).toHaveBeenCalledWith({
      where: { stageInstanceId: 'si-1' },
      data: { estimatedMinutes: 90 },
    });
  });

  it('throws BadRequestException for the lock', async () => {
    const { controller } = makeController({
      releasedToFactoryAt: new Date(),
    });
    await expect(
      controller.customizeOrderWorkflow(
        'po-1',
        { nodes: [{ snapshotNodeId: 'node-1', estimatedMinutes: 30 }] },
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
