import {
  validateWorkflowGraph,
  compileWorkflow,
  calculateWorkflowProgress,
  type CompilerNode,
} from '../domain';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateNodeDto } from '../workflow.controller';

function stage(
  id: string,
  code: string,
  nameEn: string,
): CompilerNode['stage'] {
  return {
    id,
    code,
    nameAr: nameEn,
    nameEn,
    nameHe: nameEn,
    estimatedHours: 1,
    requiresInspection: false,
    requiresPhotos: false,
    responsibleDepartment: 'CARP',
  };
}

function node(
  id: string,
  code: string,
  opts?: Partial<CompilerNode>,
): CompilerNode {
  return {
    id,
    nodeKey: code,
    stageDefinitionId: `sd-${code}`,
    sortOrder: 0,
    isRequiredByDefault: true,
    canBeSkipped: false,
    stage: stage(`sd-${code}`, code, code),
    ...opts,
  };
}

describe('validateWorkflowGraph', () => {
  it('rejects cycles', () => {
    const result = validateWorkflowGraph(
      [
        { id: 'a', nodeKey: 'A' },
        { id: 'b', nodeKey: 'B' },
        { id: 'c', nodeKey: 'C' },
      ],
      [
        { fromNodeId: 'a', toNodeId: 'b' },
        { fromNodeId: 'b', toNodeId: 'c' },
        { fromNodeId: 'c', toNodeId: 'a' },
      ],
    );
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'WORKFLOW_CYCLE')).toBe(true);
  });

  it('rejects self-links', () => {
    const result = validateWorkflowGraph(
      [{ id: 'a', nodeKey: 'A' }],
      [{ fromNodeId: 'a', toNodeId: 'a' }],
    );
    expect(result.issues.some((i) => i.code === 'WORKFLOW_SELF_LINK')).toBe(true);
  });

  it('rejects duplicate edges', () => {
    const result = validateWorkflowGraph(
      [
        { id: 'a', nodeKey: 'A' },
        { id: 'b', nodeKey: 'B' },
      ],
      [
        { fromNodeId: 'a', toNodeId: 'b' },
        { fromNodeId: 'a', toNodeId: 'b' },
      ],
    );
    expect(result.issues.some((i) => i.code === 'WORKFLOW_DUPLICATE_EDGE')).toBe(true);
  });

  it('accepts linear graph', () => {
    const result = validateWorkflowGraph(
      [
        { id: 'a', nodeKey: 'A' },
        { id: 'b', nodeKey: 'B' },
        { id: 'c', nodeKey: 'C' },
      ],
      [
        { fromNodeId: 'a', toNodeId: 'b' },
        { fromNodeId: 'b', toNodeId: 'c' },
      ],
    );
    expect(result.ok).toBe(true);
  });

  it('rejects multiple terminals', () => {
    const result = validateWorkflowGraph(
      [
        { id: 'prep', nodeKey: 'PREP' },
        { id: 'carp', nodeKey: 'CARP' },
        { id: 'del', nodeKey: 'DEL' },
      ],
      [
        { fromNodeId: 'prep', toNodeId: 'carp' },
        { fromNodeId: 'prep', toNodeId: 'del' },
      ],
    );
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'WORKFLOW_MULTIPLE_TERMINALS')).toBe(true);
  });
});

describe('UpdateNodeDto', () => {
  it('accepts connection-only patch without stageDefinitionId', async () => {
    const dto = plainToInstance(UpdateNodeDto, {
      runsAfterNodeIds: ['a', 'b'],
      expectedRevision: 3,
      isRequiredByDefault: true,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('compileWorkflow', () => {
  it('excludes painting and bridges Carpentry → Assembly', () => {
    const compiled = compileWorkflow({
      enforceTerminalChain: false,
      nodes: [
        node('carp', 'CARPENTRY', { sortOrder: 1 }),
        node('paint', 'PAINTING', { sortOrder: 2, canBeSkipped: true, isRequiredByDefault: false }),
        node('asm', 'ASSEMBLY', { sortOrder: 3 }),
      ],
      edges: [
        { fromNodeId: 'carp', toNodeId: 'paint' },
        { fromNodeId: 'paint', toNodeId: 'asm' },
      ],
      productOverrides: [
        {
          stageDefinitionId: 'sd-PAINTING',
          applicability: 'EXCLUDED',
        },
      ],
    });

    expect(compiled.included.map((n) => n.stageCode)).toEqual(['CARPENTRY', 'ASSEMBLY']);
    expect(compiled.excluded.some((n) => n.stageCode === 'PAINTING')).toBe(true);
    expect(compiled.edges).toEqual([
      { fromNodeKey: 'CARPENTRY', toNodeKey: 'ASSEMBLY', dependencyType: 'HARD' },
    ]);
  });

  it('keeps parallel foam and painting then merge to upholstery', () => {
    const compiled = compileWorkflow({
      enforceTerminalChain: false,
      nodes: [
        node('carp', 'CARPENTRY'),
        node('foam', 'FOAM'),
        node('paint', 'PAINTING'),
        node('uph', 'UPHOLSTERY'),
      ],
      edges: [
        { fromNodeId: 'carp', toNodeId: 'foam' },
        { fromNodeId: 'carp', toNodeId: 'paint' },
        { fromNodeId: 'foam', toNodeId: 'uph' },
        { fromNodeId: 'paint', toNodeId: 'uph' },
      ],
    });

    expect(compiled.dependencyMap.UPHOLSTERY?.sort()).toEqual(['FOAM', 'PAINTING'].sort());
    expect(compiled.downstreamMap.CARPENTRY?.sort()).toEqual(['FOAM', 'PAINTING'].sort());
  });

  it('marks estimate review when no duration available', () => {
    const compiled = compileWorkflow({
      enforceTerminalChain: false,
      nodes: [
        node('a', 'A', {
          defaultEstimatedMinutes: null,
          stage: {
            ...stage('sd-A', 'A', 'A'),
            estimatedHours: null,
          },
        }),
      ],
      edges: [],
    });
    expect(compiled.included[0]?.estimateReviewRequired).toBe(true);
  });
});

describe('calculateWorkflowProgress', () => {
  it('uses equal weights when estimates missing', () => {
    expect(
      calculateWorkflowProgress([
        { nodeKey: 'A', status: 'COMPLETED' },
        { nodeKey: 'B', status: 'PENDING' },
      ]),
    ).toBe(50);
  });

  it('excludes skipped from denominator', () => {
    expect(
      calculateWorkflowProgress([
        { nodeKey: 'A', status: 'COMPLETED', estimatedMinutes: 60 },
        { nodeKey: 'B', status: 'SKIPPED', estimatedMinutes: 60, isSkipped: true },
        { nodeKey: 'C', status: 'PENDING', estimatedMinutes: 60 },
      ]),
    ).toBe(50);
  });

  it('weights by estimated minutes', () => {
    expect(
      calculateWorkflowProgress([
        { nodeKey: 'A', status: 'COMPLETED', estimatedMinutes: 90 },
        { nodeKey: 'B', status: 'PENDING', estimatedMinutes: 10 },
      ]),
    ).toBe(90);
  });
});
