import { BadRequestException } from '@nestjs/common';
import { compileWorkflow, type CompilerNode } from '../domain';
import { WorkflowSnapshotService } from '../workflow-snapshot.service';
import { WorkflowVersionService } from '../workflow-version.service';

function stage(id: string, code: string): CompilerNode['stage'] {
  return {
    id,
    code,
    nameAr: code,
    nameEn: code,
    nameHe: code,
    estimatedHours: 1,
    requiresInspection: code === 'INSPECTION',
    requiresPhotos: false,
    responsibleDepartment: 'CARP',
  };
}

function node(id: string, code: string, opts?: Partial<CompilerNode>): CompilerNode {
  return {
    id,
    nodeKey: code,
    stageDefinitionId: `sd-${code}`,
    sortOrder: 0,
    isRequiredByDefault: true,
    canBeSkipped: false,
    stage: stage(`sd-${code}`, code),
    ...opts,
  };
}

describe('workflow scope', () => {
  it('compile accepts a single DISMANTLE_RECOVER node when both chains are off', () => {
    const compiled = compileWorkflow({
      nodes: [node('r', 'DISMANTLE_RECOVER', { sortOrder: 0 })],
      edges: [],
      enforceOpeningChain: false,
      enforceTerminalChain: false,
    });
    expect(compiled.issues).toEqual([]);
    expect(compiled.included.map((n) => n.stageCode)).toEqual(['DISMANTLE_RECOVER']);
  });

  it('compile still requires opening and terminal chains on STANDARD', () => {
    const compiled = compileWorkflow({
      nodes: [node('r', 'DISMANTLE_RECOVER', { sortOrder: 0 })],
      edges: [],
    });
    expect(compiled.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(['OPENING_CHAIN_MISSING', 'TERMINAL_CHAIN_MISSING']),
    );
  });

  it('applyTerminalChainAppend is a no-op for recovery-shaped RETURN workflows', async () => {
    const tx = {
      productionWorkflowVersion: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ver-1',
          status: 'DRAFT',
          revision: 1,
          workflow: { scope: 'RETURN' },
          nodes: [{ id: 'n1', stageDefinition: { code: 'DISMANTLE_RECOVER' } }],
          edges: [],
        }),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      productionWorkflowNode: { create: jest.fn() },
      productionWorkflowEdge: { create: jest.fn() },
      auditEvent: { create: jest.fn() },
    };
    const service = new WorkflowVersionService({
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    } as never);
    const result = await service.applyTerminalChainAppend('ver-1');
    expect(result).toEqual({ applied: false, revision: 1, addedStages: [], addedEdges: [] });
    expect(tx.productionWorkflowNode.create).not.toHaveBeenCalled();
  });

  it('applyTerminalChainAppend still fills finishing stages on repair-shaped RETURN drafts', async () => {
    const draft = {
      id: 'ver-1',
      status: 'DRAFT',
      revision: 1,
      workflow: { scope: 'RETURN' },
      nodes: [{ id: 'n1', nodeKey: 'CARPENTRY', sortOrder: 0, stageDefinition: { code: 'CARPENTRY' } }],
      edges: [],
    };
    const tx = {
      productionWorkflowVersion: {
        findUnique: jest.fn().mockResolvedValue(draft),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...draft, revision: 2 }),
        update: jest.fn().mockResolvedValue({ ...draft, revision: 2 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      productionWorkflowNode: {
        create: jest.fn().mockImplementation(({ data }: { data: { stageDefinitionId: string } }) =>
          Promise.resolve({ id: `n-${data.stageDefinitionId}` }),
        ),
      },
      productionWorkflowEdge: { create: jest.fn().mockResolvedValue({}) },
      productionStageDefinition: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'sd-INSPECTION', code: 'INSPECTION' },
          { id: 'sd-PACKAGING', code: 'PACKAGING' },
          { id: 'sd-DELIVERY', code: 'DELIVERY' },
        ]),
      },
      auditEvent: { create: jest.fn() },
    };
    const service = new WorkflowVersionService({
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    } as never);
    const result = await service.applyTerminalChainAppend('ver-1');
    expect(result).toMatchObject({ applied: true });
    expect(tx.productionWorkflowNode.create).toHaveBeenCalled();
  });

  it('compile skips opening chain when enforceOpeningChain is false', () => {
    const compiled = compileWorkflow({
      nodes: [
        node('c', 'CARPENTRY', { sortOrder: 0 }),
        node('i', 'INSPECTION', { sortOrder: 1 }),
        node('p', 'PACKAGING', { sortOrder: 2 }),
        node('d', 'DELIVERY', { sortOrder: 3 }),
      ],
      edges: [
        { fromNodeId: 'c', toNodeId: 'i' },
        { fromNodeId: 'i', toNodeId: 'p' },
        { fromNodeId: 'p', toNodeId: 'd' },
      ],
      enforceOpeningChain: false,
    });
    expect(compiled.issues.filter((i) => i.code.startsWith('OPENING_CHAIN_'))).toEqual([]);
    expect(compiled.issues.filter((i) => i.code.startsWith('TERMINAL_CHAIN_'))).toEqual([]);
  });

  it('applyOpeningChainAppend is a no-op for RETURN workflows', async () => {
    const tx = {
      productionWorkflowVersion: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ver-1',
          status: 'DRAFT',
          revision: 1,
          workflow: { scope: 'RETURN' },
          nodes: [],
          edges: [],
        }),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      productionWorkflowNode: { create: jest.fn() },
      auditEvent: { create: jest.fn() },
    };
    const service = new WorkflowVersionService({
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    } as never);
    const result = await service.applyOpeningChainAppend('ver-1');
    expect(result).toEqual({ applied: false, revision: 1, addedStages: [] });
    expect(tx.productionWorkflowNode.create).not.toHaveBeenCalled();
  });

  it('rejects a RETURN workflow on a SALES_ORDER production order', async () => {
    const tx = {
      productionOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'po-1',
          status: 'PLANNED',
          originType: 'SALES_ORDER',
          releasedToFactoryAt: null,
          actualStartDate: null,
        }),
      },
      productionWorkflow: {
        findUnique: jest.fn().mockResolvedValue({ scope: 'RETURN' }),
      },
      productionTask: { count: jest.fn() },
    };
    const snapshots = new WorkflowSnapshotService(
      { $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) } as never,
      {} as never,
      {} as never,
    );
    await expect(
      snapshots.assignWorkflowToProductionOrder('po-1', 'wf-return', 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not reject a RETURN workflow on RETURN_RECOVERY work for scope', async () => {
    const tx = {
      productionOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'po-1',
          status: 'PLANNED',
          originType: 'RETURN_RECOVERY',
          releasedToFactoryAt: null,
          actualStartDate: null,
        }),
      },
      productionWorkflow: {
        findUnique: jest.fn().mockResolvedValue({ scope: 'RETURN' }),
      },
      productionTask: { count: jest.fn().mockResolvedValue(0) },
      productionOrderWorkflowSnapshot: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const snapshots = new WorkflowSnapshotService(
      { $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) } as never,
      {} as never,
      {} as never,
    );
    try {
      await snapshots.assignWorkflowToProductionOrder('po-1', 'wf-return', 'user-1');
    } catch (err) {
      const body = (err as BadRequestException).getResponse();
      expect(body).not.toEqual(expect.objectContaining({ code: 'WORKFLOW_SCOPE_MISMATCH' }));
    }
  });
});
