import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  cartesianReconnect,
  nextLibrarySortOrder,
  nextNodeSortOrder,
  nextUniqueCode,
  pickStagePatch,
  resolveGeneratedCode,
  resolveNodeKey,
  slugFromEnglishName,
} from '../domain/technical-id';
import { AddNodeDto, CreateStageDto, CreateWorkflowDto } from '../workflow.controller';
import { WorkflowVersionService } from '../workflow-version.service';

describe('technical identifiers', () => {
  it('slugs English names to uppercase codes', () => {
    expect(slugFromEnglishName('Custom Finish')).toBe('CUSTOM_FINISH');
    expect(slugFromEnglishName('  CNC mill  ')).toBe('CNC_MILL');
  });

  it('generates a unique code when omitted', () => {
    expect(resolveGeneratedCode(undefined, 'Custom Finish', [])).toBe('CUSTOM_FINISH');
  });

  it('suffixes colliding generated codes (duplicate display names allowed)', () => {
    expect(resolveGeneratedCode(undefined, 'Custom Finish', ['CUSTOM_FINISH'])).toBe(
      'CUSTOM_FINISH_2',
    );
    expect(
      nextUniqueCode('CUSTOM_FINISH', ['CUSTOM_FINISH', 'CUSTOM_FINISH_2']),
    ).toBe('CUSTOM_FINISH_3');
  });

  it('keeps an explicit CNC code after normalize', () => {
    expect(resolveGeneratedCode('CNC', 'Anything', ['FOAM'])).toBe('CNC');
    expect(resolveGeneratedCode('  cnc mill ', 'X', [])).toBe('CNC_MILL');
  });

  it('does not change a stored code when renaming (patch strips code)', () => {
    const patch = pickStagePatch({
      nameEn: 'Hand Finish',
      code: 'SHOULD_NOT_APPLY',
      nameAr: 'تشطيب يدوي',
    });
    expect(patch).toEqual({ nameEn: 'Hand Finish', nameAr: 'تشطيب يدوي' });
    expect(patch.code).toBeUndefined();
  });

  it('assigns library sortOrder as max+10 when omitted', () => {
    expect(nextLibrarySortOrder(undefined)).toBe(10);
    expect(nextLibrarySortOrder(40)).toBe(50);
  });

  it('assigns node sortOrder as max+1 when omitted', () => {
    expect(nextNodeSortOrder(undefined)).toBe(0);
    expect(nextNodeSortOrder(3)).toBe(4);
  });

  it('omitted nodeKey equals the stage code, then suffixes on collision', () => {
    expect(resolveNodeKey(undefined, 'FOAM', [])).toBe('FOAM');
    expect(resolveNodeKey(undefined, 'FOAM', ['FOAM'])).toBe('FOAM_2');
    expect(resolveNodeKey('CUSTOM_A', 'FOAM', ['FOAM'])).toBe('CUSTOM_A');
  });

  it('reconnects predecessors to successors (Cartesian, skip self)', () => {
    expect(cartesianReconnect(['a', 'b'], ['c'])).toEqual([
      { fromNodeId: 'a', toNodeId: 'c' },
      { fromNodeId: 'b', toNodeId: 'c' },
    ]);
    expect(cartesianReconnect(['a'], ['a', 'b'])).toEqual([{ fromNodeId: 'a', toNodeId: 'b' }]);
    expect(cartesianReconnect(['a'], [])).toEqual([]);
  });
});

describe('optional identifier DTOs', () => {
  it('CreateWorkflowDto accepts omitted code', async () => {
    const dto = plainToInstance(CreateWorkflowDto, {
      nameEn: 'Sofa path',
      nameAr: 'مسار الكنب',
      nameHe: 'מסלול ספה',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('CreateStageDto accepts omitted code', async () => {
    const dto = plainToInstance(CreateStageDto, {
      nameEn: 'Custom Finish',
      nameAr: 'تشطيب خاص',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('AddNodeDto accepts omitted nodeKey', async () => {
    const dto = plainToInstance(AddNodeDto, { stageDefinitionId: 'sd-1' });
    expect(await validate(dto)).toHaveLength(0);
  });
});

function makeService(tx: Record<string, unknown>) {
  const prisma = {
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };
  return new WorkflowVersionService(prisma as never);
}

describe('WorkflowVersionService identifier generation', () => {
  it('createWorkflow generates a unique code from nameEn', async () => {
    const tx = {
      productionWorkflow: {
        findMany: jest.fn().mockResolvedValue([{ code: 'SOFA_PATH' }]),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'wf-1', ...data })),
      },
      productionWorkflowVersion: {
        create: jest.fn().mockResolvedValue({ id: 'v-1', versionNumber: 1 }),
      },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = makeService(tx);
    const result = await service.createWorkflow({
      nameEn: 'Sofa path',
      nameAr: 'مسار',
      createdById: 'user-1',
    });
    expect(tx.productionWorkflow.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'SOFA_PATH_2', nameEn: 'Sofa path' }),
      }),
    );
    expect(result.code).toBe('SOFA_PATH_2');
  });

  it('addNode omits nodeKey → stage.code and assigns sortOrder', async () => {
    const created: Record<string, unknown> = {};
    const tx = {
      productionWorkflowVersion: {
        findUnique: jest.fn().mockResolvedValue({ id: 'ver-1', status: 'DRAFT', revision: 1 }),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      productionStageDefinition: {
        findUnique: jest.fn().mockResolvedValue({ id: 'sd-1', code: 'FOAM' }),
      },
      productionWorkflowNode: {
        findMany: jest.fn().mockResolvedValue([{ nodeKey: 'CARPENTRY', sortOrder: 0 }]),
        create: jest.fn().mockImplementation(({ data }) => {
          Object.assign(created, data);
          return Promise.resolve({ id: 'node-1', ...data });
        }),
      },
      productionWorkflowEdge: { create: jest.fn() },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = makeService(tx);
    await service.addNode('ver-1', { stageDefinitionId: 'sd-1' }, 'user-1');
    expect(created.nodeKey).toBe('FOAM');
    expect(created.sortOrder).toBe(1);
  });

  it('removeNode reconnects pred × succ', async () => {
    const upserts: Array<{ fromNodeId: string; toNodeId: string }> = [];
    const tx = {
      productionWorkflowVersion: {
        findUnique: jest.fn().mockResolvedValue({ id: 'ver-1', status: 'DRAFT' }),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      productionWorkflowEdge: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ fromNodeId: 'a' }, { fromNodeId: 'b' }])
          .mockResolvedValueOnce([{ toNodeId: 'c' }]),
        upsert: jest.fn().mockImplementation(({ create }) => {
          upserts.push({ fromNodeId: create.fromNodeId, toNodeId: create.toNodeId });
          return Promise.resolve({});
        }),
        deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
      productionWorkflowNode: { delete: jest.fn().mockResolvedValue({}) },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = makeService(tx);
    await service.removeNode('ver-1', 'mid', { reconnect: true }, 'user-1');
    expect(upserts).toEqual([
      { fromNodeId: 'a', toNodeId: 'c' },
      { fromNodeId: 'b', toNodeId: 'c' },
    ]);
    expect(tx.productionWorkflowNode.delete).toHaveBeenCalledWith({ where: { id: 'mid' } });
  });
});
