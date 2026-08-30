import {
  canonicalizeWorkflowGraph,
  diffPredecessorSets,
  edgePairs,
  fromRawGraph,
  simulateWorkflowMutation,
  validateCanonicalWorkflowGraph,
  type CanonicalWorkflowGraph,
  type PlacementIntent,
  type WorkflowDomainEdge,
  type WorkflowDomainNode,
} from '../index';

function N(id: string, code: string, sortOrder: number): WorkflowDomainNode {
  return { id, code, sortOrder };
}

function E(from: string, to: string): WorkflowDomainEdge {
  return { from, to };
}

const terminal = [
  N('insp', 'INSPECTION', 90),
  N('pack', 'PACKAGING', 91),
  N('del', 'DELIVERY', 92),
];

function baseSerial(): CanonicalWorkflowGraph {
  return fromRawGraph(
    [N('prep', 'MATERIAL_PREP', 0), N('carp', 'CARPENTRY', 1), N('foam', 'FOAM', 2), ...terminal],
    [
      E('prep', 'carp'),
      E('carp', 'foam'),
      E('foam', 'insp'),
      E('insp', 'pack'),
      E('pack', 'del'),
    ],
  );
}

function assertHealthy(
  g: CanonicalWorkflowGraph,
  explicitStarts: string[] = [],
) {
  const v = validateCanonicalWorkflowGraph(g, {
    explicitStartIds: new Set(explicitStarts),
  });
  expect(v.ok).toBe(true);
  expect(new Set(edgePairs(g.edges)).size).toBe(edgePairs(g.edges).length);
  expect(g.predecessorsByNode.insp?.sort()).toEqual([...g.frontierNodeIds].sort());
  expect(g.predecessorsByNode.pack).toEqual(['insp']);
  expect(g.predecessorsByNode.del).toEqual(['pack']);
}

function applyDiffInMemory(
  before: CanonicalWorkflowGraph,
  after: CanonicalWorkflowGraph,
): CanonicalWorkflowGraph {
  const patches = diffPredecessorSets(before, after);
  const preds: Record<string, string[]> = {};
  for (const n of after.nodes) {
    preds[n.id] = [...(before.predecessorsByNode[n.id] ?? [])];
  }
  for (const p of patches) {
    preds[p.nodeId] = [...p.runsAfterNodeIds];
  }
  // Drop removed nodes
  const nodeIds = new Set(after.nodes.map((n) => n.id));
  for (const id of Object.keys(preds)) {
    if (!nodeIds.has(id)) delete preds[id];
  }
  const edges = Object.entries(preds).flatMap(([to, froms]) =>
    froms.filter((f) => nodeIds.has(f)).map((from) => ({ from, to })),
  );
  return canonicalizeWorkflowGraph({ nodes: after.nodes, edges });
}

function assertPreviewEqualsSaved(
  before: CanonicalWorkflowGraph,
  after: CanonicalWorkflowGraph,
) {
  const reopened = applyDiffInMemory(before, after);
  expect(edgePairs(reopened.edges)).toEqual(edgePairs(after.edges));
}

describe('full mutation matrix', () => {
  const placements: Array<{ name: string; intent: PlacementIntent; starts?: string[] }> = [
    { name: 'START', intent: { kind: 'START' }, starts: ['x'] },
    { name: 'AFTER_ONE', intent: { kind: 'AFTER', predecessorIds: ['carp'] } },
    { name: 'AFTER_MANY', intent: { kind: 'AFTER', predecessorIds: ['carp', 'foam'] } },
    { name: 'PARALLEL_ONE', intent: { kind: 'PARALLEL', referenceNodeIds: ['foam'] } },
  ];

  for (const p of placements) {
    it(`ADD ${p.name} → healthy + preview=saved=reopened`, () => {
      const before = baseSerial();
      const after = simulateWorkflowMutation(before, {
        kind: 'ADD',
        nodeId: 'x',
        code: 'CUSTOM',
        placement: p.intent,
      });
      const starts = [
        ...(p.starts ?? []),
        ...after.productionNodeIds.filter(
          (id) =>
            (after.predecessorsByNode[id] ?? []).length === 0 &&
            after.nodes.find((n) => n.id === id)?.code === 'MATERIAL_PREP',
        ),
      ];
      if (p.intent.kind === 'START') starts.push('x');
      assertHealthy(after, starts);
      assertPreviewEqualsSaved(before, after);
    });
  }

  it('ADD PARALLEL_BAND copies band preds', () => {
    const before = fromRawGraph(
      [
        N('prep', 'MATERIAL_PREP', 0),
        N('foam', 'FOAM', 1),
        N('assy', 'ASSEMBLY', 2),
        ...terminal,
      ],
      [
        E('prep', 'foam'),
        E('prep', 'assy'),
        E('insp', 'pack'),
        E('pack', 'del'),
      ],
    );
    const after = simulateWorkflowMutation(before, {
      kind: 'ADD',
      nodeId: 'x',
      code: 'CUSTOM',
      placement: { kind: 'PARALLEL', referenceNodeIds: ['foam', 'assy'] },
    });
    expect(after.predecessorsByNode.x).toEqual(['prep']);
    assertHealthy(after, []);
    assertPreviewEqualsSaved(before, after);
  });

  for (const p of placements) {
    it(`EDIT foam → ${p.name} → healthy + preview=saved`, () => {
      const before = baseSerial();
      const after = simulateWorkflowMutation(before, {
        kind: 'EDIT_PLACEMENT',
        nodeId: 'foam',
        placement: p.intent,
      });
      const starts =
        p.intent.kind === 'START'
          ? ['foam']
          : [];
      assertHealthy(after, starts);
      assertPreviewEqualsSaved(before, after);
      if (p.intent.kind === 'START') {
        // Downstream continuity: carp stays attached somehow or foam keeps chain
        expect(after.predecessorsByNode.foam).toEqual([]);
      }
    });
  }

  it('EDIT Start critical: Uph keeps Carp', () => {
    const before = fromRawGraph(
      [
        N('prep', 'MATERIAL_PREP', 0),
        N('uph', 'UPHOLSTERY', 1),
        N('carp', 'CARPENTRY', 2),
        ...terminal,
      ],
      [
        E('prep', 'uph'),
        E('uph', 'carp'),
        E('carp', 'insp'),
        E('insp', 'pack'),
        E('pack', 'del'),
      ],
    );
    const after = simulateWorkflowMutation(before, {
      kind: 'EDIT_PLACEMENT',
      nodeId: 'uph',
      placement: { kind: 'START' },
    });
    expect(after.predecessorsByNode.carp).toEqual(['uph']);
    expect(edgePairs(after.edges).some((e) => e === 'uph->insp')).toBe(false);
    assertHealthy(after, ['uph']);
    assertPreviewEqualsSaved(before, after);
  });

  it('REMOVE serial middle', () => {
    const before = baseSerial();
    const after = simulateWorkflowMutation(before, { kind: 'REMOVE', nodeId: 'carp' });
    expect(after.predecessorsByNode.foam).toEqual(['prep']);
    assertHealthy(after, []);
    assertPreviewEqualsSaved(before, after);
  });

  it('REMOVE parallel child', () => {
    const before = fromRawGraph(
      [
        N('carp', 'CARPENTRY', 0),
        N('foam', 'FOAM', 1),
        N('uph', 'UPHOLSTERY', 2),
        N('assy', 'ASSEMBLY', 3),
        ...terminal,
      ],
      [
        E('carp', 'foam'),
        E('carp', 'uph'),
        E('foam', 'assy'),
        E('uph', 'assy'),
        E('insp', 'pack'),
        E('pack', 'del'),
      ],
    );
    const after = simulateWorkflowMutation(before, { kind: 'REMOVE', nodeId: 'foam' });
    expect(edgePairs(after.edges).some((e) => e === 'carp->assy')).toBe(false);
    assertHealthy(after, ['carp']);
    assertPreviewEqualsSaved(before, after);
  });

  it('REMOVE frontier node', () => {
    const before = baseSerial();
    const after = simulateWorkflowMutation(before, { kind: 'REMOVE', nodeId: 'foam' });
    expect(after.frontierNodeIds).toEqual(['carp']);
    assertHealthy(after, []);
    assertPreviewEqualsSaved(before, after);
  });

  it('shared successor continuity on EDIT', () => {
    const before = fromRawGraph(
      [
        N('a', 'A', 0),
        N('x', 'X', 1),
        N('b', 'B', 2),
        N('c', 'C', 3),
        ...terminal,
      ],
      [
        E('a', 'x'),
        E('x', 'c'),
        E('b', 'c'),
        E('c', 'insp'),
        E('insp', 'pack'),
        E('pack', 'del'),
      ],
    );
    const after = simulateWorkflowMutation(before, {
      kind: 'EDIT_PLACEMENT',
      nodeId: 'x',
      placement: { kind: 'START' },
    });
    expect(after.predecessorsByNode.c?.sort()).toEqual(['b', 'x']);
    assertHealthy(after, ['a', 'b', 'x'].filter((id) => (after.predecessorsByNode[id] ?? []).length === 0));
    assertPreviewEqualsSaved(before, after);
  });

  it('legacy spider normalize + reopen', () => {
    const nodes = [
      N('prep', 'MATERIAL_PREP', 0),
      N('carp', 'CARPENTRY', 1),
      N('foam', 'FOAM', 2),
      N('uph', 'UPHOLSTERY', 3),
      N('assy', 'ASSEMBLY', 4),
      ...terminal,
    ];
    const rawEdges = [
      E('prep', 'carp'),
      E('prep', 'foam'),
      E('prep', 'insp'),
      E('carp', 'foam'),
      E('carp', 'uph'),
      E('carp', 'insp'),
      E('foam', 'assy'),
      E('uph', 'assy'),
      E('assy', 'insp'),
      E('insp', 'pack'),
      E('pack', 'del'),
    ];
    const before = {
      ...fromRawGraph(nodes, rawEdges),
      predecessorsByNode: Object.fromEntries(
        nodes.map((n) => [
          n.id,
          rawEdges.filter((e) => e.to === n.id).map((e) => e.from).sort(),
        ]),
      ),
      edges: rawEdges,
    } as CanonicalWorkflowGraph;
    const after = canonicalizeWorkflowGraph({ nodes, edges: rawEdges });
    assertHealthy(after, ['prep']);
    assertPreviewEqualsSaved(before, after);
    expect(edgePairs(after.edges).some((e) => e === 'prep->insp')).toBe(false);
  });

  it('invalid orphan fails validation', () => {
    const g = fromRawGraph(
      [N('prep', 'MATERIAL_PREP', 0), N('orphan', 'ASSEMBLY', 1), ...terminal],
      [E('insp', 'pack'), E('pack', 'del')],
    );
    const v = validateCanonicalWorkflowGraph(g);
    expect(v.issues.some((i) => i.code === 'ILLEGAL_ROOT')).toBe(true);
  });

  it('independent lanes + long edge', () => {
    const g = fromRawGraph(
      [
        N('prep', 'MATERIAL_PREP', 0),
        N('foam', 'FOAM', 1),
        N('uph', 'UPHOLSTERY', 2),
        N('assy', 'ASSEMBLY', 3),
        N('paint', 'PAINTING', 4),
        ...terminal,
      ],
      [
        E('prep', 'foam'),
        E('foam', 'uph'),
        E('prep', 'assy'),
        E('assy', 'paint'),
        E('uph', 'insp'),
        E('paint', 'insp'),
        E('insp', 'pack'),
        E('pack', 'del'),
      ],
    );
    assertHealthy(g, []);
    expect(g.frontierNodeIds.sort()).toEqual(['paint', 'uph']);
    expect(edgePairs(g.edges).some((e) => e === 'foam->insp')).toBe(false);
  });

  it('parallel→parallel join has band detection; parallel→one does not invent Together semantics', () => {
    const g = fromRawGraph(
      [
        N('prep', 'MATERIAL_PREP', 0),
        N('a', 'A', 1),
        N('b', 'B', 2),
        N('c', 'C', 3),
        N('d', 'D', 4),
        N('join', 'JOIN', 5),
        ...terminal,
      ],
      [
        E('prep', 'a'),
        E('prep', 'b'),
        E('a', 'c'),
        E('a', 'd'),
        E('b', 'c'),
        E('b', 'd'),
        E('c', 'join'),
        E('d', 'join'),
        E('join', 'insp'),
        E('insp', 'pack'),
        E('pack', 'del'),
      ],
    );
    assertHealthy(g, []);
    expect(g.parallelBands.some((b) => b.nodeIds.includes('a') && b.nodeIds.includes('b'))).toBe(
      true,
    );
    expect(g.parallelBands.some((b) => b.nodeIds.includes('c') && b.nodeIds.includes('d'))).toBe(
      true,
    );
    // join is single successor of a parallel band — not itself a parallel band
    expect(g.parallelBands.some((b) => b.nodeIds.includes('join'))).toBe(false);
  });
});
