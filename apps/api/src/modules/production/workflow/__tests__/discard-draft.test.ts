import { BadRequestException } from '@nestjs/common';
import { WorkflowVersionService } from '../workflow-version.service';

describe('WorkflowVersionService.discardDraft', () => {
  function makeService(tx: Record<string, unknown>) {
    const prisma = {
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    };
    return new WorkflowVersionService(prisma as never);
  }

  it('deletes draft when a non-draft sibling exists', async () => {
    const tx = {
      productionWorkflowVersion: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'draft-1',
          workflowId: 'wf-1',
          status: 'DRAFT',
        }),
        findFirst: jest.fn().mockResolvedValue({ id: 'pub-1', status: 'PUBLISHED' }),
        delete: jest.fn().mockResolvedValue({}),
        update: jest.fn(),
      },
      productionWorkflow: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'wf-1',
          activeVersionId: 'pub-1',
        }),
      },
      productionWorkflowEdge: { deleteMany: jest.fn() },
      productionWorkflowNode: { deleteMany: jest.fn() },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = makeService(tx);
    const result = await service.discardDraft('wf-1', 'draft-1', 'user-1');
    expect(result).toEqual({ discarded: true, mode: 'delete' });
    expect(tx.productionWorkflowVersion.delete).toHaveBeenCalledWith({
      where: { id: 'draft-1' },
    });
    expect(tx.productionWorkflowNode.deleteMany).not.toHaveBeenCalled();
  });

  it('resets sole never-published draft', async () => {
    const tx = {
      productionWorkflowVersion: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'draft-1',
          workflowId: 'wf-1',
          status: 'DRAFT',
        }),
        findFirst: jest.fn().mockResolvedValue(null),
        delete: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      productionWorkflow: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'wf-1',
          activeVersionId: null,
        }),
      },
      productionWorkflowEdge: { deleteMany: jest.fn().mockResolvedValue({}) },
      productionWorkflowNode: { deleteMany: jest.fn().mockResolvedValue({}) },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = makeService(tx);
    const result = await service.discardDraft('wf-1', 'draft-1', 'user-1');
    expect(result).toEqual({ discarded: true, mode: 'reset' });
    expect(tx.productionWorkflowEdge.deleteMany).toHaveBeenCalled();
    expect(tx.productionWorkflowNode.deleteMany).toHaveBeenCalled();
    expect(tx.productionWorkflowVersion.delete).not.toHaveBeenCalled();
  });

  it('rejects discarding non-draft versions', async () => {
    const tx = {
      productionWorkflowVersion: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'pub-1',
          workflowId: 'wf-1',
          status: 'PUBLISHED',
        }),
      },
    };
    const service = makeService(tx);
    await expect(service.discardDraft('wf-1', 'pub-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
