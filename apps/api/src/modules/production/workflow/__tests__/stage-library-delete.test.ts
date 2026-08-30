import { BadRequestException } from '@nestjs/common';
import { WorkflowVersionService } from '../workflow-version.service';

function makeService(tx: Record<string, unknown>) {
  const prisma = {
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };
  return new WorkflowVersionService(prisma as never);
}

function emptyDeletes() {
  return {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  };
}

describe('deleteStageDefinition', () => {
  it('rejects locked opening and finishing stages', async () => {
    for (const code of ['MATERIAL_PREP', 'INSPECTION', 'PACKAGING', 'DELIVERY']) {
      const tx = {
        productionStageDefinition: {
          findUnique: jest.fn().mockResolvedValue({ id: 's1', code }),
        },
      };
      const service = makeService(tx);
      const err = await service.deleteStageDefinition('s1', 'user-1').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toMatchObject({
        code: 'LOCKED_ANCHOR_STAGE',
      });
    }
  });

  it('strips the stage from a published workflow and keeps order instances', async () => {
    const upserts: Array<{ fromNodeId: string; toNodeId: string }> = [];
    const tx = {
      productionStageDefinition: {
        findUnique: jest.fn().mockResolvedValue({ id: 's-foam', code: 'FOAM' }),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 's-foam', code: 'FOAM', isActive: data.isActive }),
        ),
        delete: jest.fn(),
      },
      productionWorkflowNode: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'mid', workflowVersionId: 'ver-pub' }]),
        delete: jest.fn().mockResolvedValue({}),
      },
      productionWorkflowVersion: {
        update: jest.fn().mockResolvedValue({ id: 'ver-pub', revision: 2, status: 'PUBLISHED' }),
      },
      productionWorkflowEdge: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ fromNodeId: 'a' }])
          .mockResolvedValueOnce([{ toNodeId: 'c' }]),
        upsert: jest.fn().mockImplementation(({ create }) => {
          upserts.push({ fromNodeId: create.fromNodeId, toNodeId: create.toNodeId });
          return Promise.resolve({});
        }),
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      productWorkflowStageOverride: emptyDeletes(),
      productStageEstimate: emptyDeletes(),
      productStageMaterialInput: emptyDeletes(),
      productStageInventoryOutput: emptyDeletes(),
      workerSkill: emptyDeletes(),
      stageEstimateStat: emptyDeletes(),
      productionStageInstance: { count: jest.fn().mockResolvedValue(2) },
      productionTask: { count: jest.fn().mockResolvedValue(0) },
      productionOrderWorkflowSnapshotNode: { count: jest.fn().mockResolvedValue(2) },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = makeService(tx);
    const result = await service.deleteStageDefinition('s-foam', 'user-1');
    expect(upserts).toEqual([{ fromNodeId: 'a', toNodeId: 'c' }]);
    expect(tx.productionWorkflowNode.delete).toHaveBeenCalledWith({ where: { id: 'mid' } });
    expect(tx.productionWorkflowVersion.update).toHaveBeenCalledWith({
      where: { id: 'ver-pub' },
      data: { revision: { increment: 1 } },
    });
    expect(tx.productionStageDefinition.delete).not.toHaveBeenCalled();
    expect(result).toMatchObject({ id: 's-foam', isActive: false });
  });

  it('hard-deletes a stage that nothing historical still references', async () => {
    const tx = {
      productionStageDefinition: {
        findUnique: jest.fn().mockResolvedValue({ id: 's-new', code: 'CUSTOM_FINISH' }),
        update: jest.fn(),
        delete: jest.fn().mockResolvedValue({ id: 's-new' }),
      },
      productionWorkflowNode: {
        findMany: jest.fn().mockResolvedValue([]),
        delete: jest.fn(),
      },
      productionWorkflowVersion: { update: jest.fn() },
      productionWorkflowEdge: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      productWorkflowStageOverride: emptyDeletes(),
      productStageEstimate: emptyDeletes(),
      productStageMaterialInput: emptyDeletes(),
      productStageInventoryOutput: emptyDeletes(),
      workerSkill: emptyDeletes(),
      stageEstimateStat: emptyDeletes(),
      productionStageInstance: { count: jest.fn().mockResolvedValue(0) },
      productionTask: { count: jest.fn().mockResolvedValue(0) },
      productionOrderWorkflowSnapshotNode: { count: jest.fn().mockResolvedValue(0) },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = makeService(tx);
    const result = await service.deleteStageDefinition('s-new', 'user-1');
    expect(tx.productionStageDefinition.delete).toHaveBeenCalledWith({ where: { id: 's-new' } });
    expect(result).toEqual({ id: 's-new', deleted: true });
  });
});
