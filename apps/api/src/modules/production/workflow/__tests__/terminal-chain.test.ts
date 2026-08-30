import {
  validateTerminalChain,
  planTerminalChainAppend,
  compileWorkflow,
  type CompilerNode,
} from '../domain';

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

describe('validateTerminalChain', () => {
  it('accepts INSPECTION → PACKAGING → DELIVERY', () => {
    const issues = validateTerminalChain(
      [
        { id: 'i', nodeKey: 'INSPECTION', stageCode: 'INSPECTION', isRequired: true },
        { id: 'p', nodeKey: 'PACKAGING', stageCode: 'PACKAGING', isRequired: true },
        { id: 'd', nodeKey: 'DELIVERY', stageCode: 'DELIVERY', isRequired: true },
      ],
      [
        { fromNodeId: 'i', toNodeId: 'p' },
        { fromNodeId: 'p', toNodeId: 'd' },
      ],
    );
    expect(issues).toEqual([]);
  });

  it('rejects missing DELIVERY', () => {
    const issues = validateTerminalChain(
      [
        { id: 'i', nodeKey: 'INSPECTION', stageCode: 'INSPECTION', isRequired: true },
        { id: 'p', nodeKey: 'PACKAGING', stageCode: 'PACKAGING', isRequired: true },
      ],
      [{ fromNodeId: 'i', toNodeId: 'p' }],
    );
    expect(issues.some((i) => i.code === 'TERMINAL_CHAIN_MISSING')).toBe(true);
  });

  it('rejects wrong order', () => {
    const issues = validateTerminalChain(
      [
        { id: 'i', nodeKey: 'INSPECTION', stageCode: 'INSPECTION', isRequired: true },
        { id: 'p', nodeKey: 'PACKAGING', stageCode: 'PACKAGING', isRequired: true },
        { id: 'd', nodeKey: 'DELIVERY', stageCode: 'DELIVERY', isRequired: true },
      ],
      [
        { fromNodeId: 'p', toNodeId: 'i' },
        { fromNodeId: 'i', toNodeId: 'd' },
      ],
    );
    expect(issues.some((i) => i.code === 'TERMINAL_CHAIN_ORDER')).toBe(true);
  });
});

describe('planTerminalChainAppend', () => {
  it('plans missing DELIVERY and edge', () => {
    const plan = planTerminalChainAppend(
      [{ stageCode: 'INSPECTION' }, { stageCode: 'PACKAGING' }],
      [{ fromStageCode: 'INSPECTION', toStageCode: 'PACKAGING' }],
    );
    expect(plan.addStageCodes).toEqual(['DELIVERY']);
    expect(plan.addEdges).toContainEqual(['PACKAGING', 'DELIVERY']);
  });
});

describe('compileWorkflow terminal chain', () => {
  it('rejects graphs that omit the locked finishing chain', () => {
    const compiled = compileWorkflow({
      nodes: [node('a', 'CARPENTRY'), node('b', 'ASSEMBLY')],
      edges: [{ fromNodeId: 'a', toNodeId: 'b' }],
    });
    expect(compiled.issues.some((i) => i.code.startsWith('TERMINAL_CHAIN_'))).toBe(true);
  });

  it('accepts a full locked finishing chain', () => {
    const compiled = compileWorkflow({
      nodes: [
        node('m', 'MATERIAL_PREP', { sortOrder: 0 }),
        node('c', 'CARPENTRY', { sortOrder: 1 }),
        node('i', 'INSPECTION', { sortOrder: 2 }),
        node('p', 'PACKAGING', { sortOrder: 3 }),
        node('d', 'DELIVERY', { sortOrder: 4 }),
      ],
      edges: [
        { fromNodeId: 'm', toNodeId: 'c' },
        { fromNodeId: 'c', toNodeId: 'i' },
        { fromNodeId: 'i', toNodeId: 'p' },
        { fromNodeId: 'p', toNodeId: 'd' },
      ],
    });
    expect(compiled.issues.filter((i) => i.code.startsWith('TERMINAL_CHAIN_'))).toEqual([]);
    expect(compiled.issues.filter((i) => i.code.startsWith('OPENING_CHAIN_'))).toEqual([]);
    expect(compiled.included.find((n) => n.stageCode === 'DELIVERY')?.executionKind).toBe(
      'LOGISTICS',
    );
    expect(compiled.included.find((n) => n.stageCode === 'INSPECTION')?.executionKind).toBe(
      'QUALITY',
    );
  });
});
