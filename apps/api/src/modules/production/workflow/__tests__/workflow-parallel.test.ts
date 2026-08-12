import { compileWorkflow, type CompilerNode } from '../domain';

function node(id: string, code: string, opts?: Partial<CompilerNode>): CompilerNode {
  return {
    id,
    nodeKey: code,
    stageDefinitionId: `sd-${code}`,
    sortOrder: 0,
    isRequiredByDefault: true,
    canBeSkipped: false,
    stage: {
      id: `sd-${code}`,
      code,
      nameAr: code,
      nameEn: code,
      nameHe: code,
      estimatedHours: 1,
      requiresInspection: false,
      requiresPhotos: false,
      responsibleDepartment: 'CARP',
    },
    ...opts,
  };
}

describe('parallel + merge readiness topology', () => {
  it('Foam and Painting both depend on Carpentry; Upholstery waits for both', () => {
    const compiled = compileWorkflow({
      nodes: [
        node('c', 'CARPENTRY'),
        node('f', 'FOAM'),
        node('p', 'PAINTING'),
        node('u', 'UPHOLSTERY'),
      ],
      edges: [
        { fromNodeId: 'c', toNodeId: 'f' },
        { fromNodeId: 'c', toNodeId: 'p' },
        { fromNodeId: 'f', toNodeId: 'u' },
        { fromNodeId: 'p', toNodeId: 'u' },
      ],
    });

    expect(compiled.downstreamMap.CARPENTRY?.sort()).toEqual(['FOAM', 'PAINTING']);
    expect(compiled.dependencyMap.UPHOLSTERY?.sort()).toEqual(['FOAM', 'PAINTING']);
    expect(compiled.dependencyMap.FOAM).toEqual(['CARPENTRY']);
    expect(compiled.dependencyMap.PAINTING).toEqual(['CARPENTRY']);
  });

  it('skipping optional painting leaves Foam → Upholstery', () => {
    const compiled = compileWorkflow({
      nodes: [
        node('c', 'CARPENTRY'),
        node('f', 'FOAM'),
        node('p', 'PAINTING', { canBeSkipped: true, isRequiredByDefault: false }),
        node('u', 'UPHOLSTERY'),
      ],
      edges: [
        { fromNodeId: 'c', toNodeId: 'f' },
        { fromNodeId: 'c', toNodeId: 'p' },
        { fromNodeId: 'f', toNodeId: 'u' },
        { fromNodeId: 'p', toNodeId: 'u' },
      ],
      orderOverrides: [{ nodeKey: 'PAINTING', skip: true }],
    });

    expect(compiled.included.map((n) => n.stageCode).sort()).toEqual(
      ['CARPENTRY', 'FOAM', 'UPHOLSTERY'].sort(),
    );
    expect(compiled.dependencyMap.UPHOLSTERY).toEqual(['FOAM']);
  });
});

describe('snapshot versioning semantics (compile isolation)', () => {
  it('v1 compile stays A→B→C independent of a later v2 topology', () => {
    const v1 = compileWorkflow({
      nodes: [node('a', 'A'), node('b', 'B'), node('c', 'C')],
      edges: [
        { fromNodeId: 'a', toNodeId: 'b' },
        { fromNodeId: 'b', toNodeId: 'c' },
      ],
    });
    const v2 = compileWorkflow({
      nodes: [node('a', 'A'), node('b', 'B'), node('d', 'D'), node('c', 'C')],
      edges: [
        { fromNodeId: 'a', toNodeId: 'b' },
        { fromNodeId: 'b', toNodeId: 'd' },
        { fromNodeId: 'd', toNodeId: 'c' },
      ],
    });

    expect(v1.included.map((n) => n.stageCode)).toEqual(['A', 'B', 'C']);
    expect(v1.edges.map((e) => `${e.fromNodeKey}->${e.toNodeKey}`)).toEqual([
      'A->B',
      'B->C',
    ]);
    expect(v2.included.map((n) => n.stageCode)).toEqual(['A', 'B', 'D', 'C']);
    // v1 unchanged
    expect(v1.edges).toHaveLength(2);
  });
});
