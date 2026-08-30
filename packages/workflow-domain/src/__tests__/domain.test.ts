import {
  canonicalizeWorkflowGraph,
  computeParallelBands,
  diffPredecessorSets,
  edgePairs,
  fromRawGraph,
  simulateWorkflowMutation,
  validParallelReferenceCandidateIds,
  validPredecessorCandidateIds,
  validateCanonicalWorkflowGraph,
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

describe('canonicalize fixtures', () => {
  it('Fixture 1 — spider reduces; Inspection = frontier only', () => {
    const nodes = [
      N('prep', 'MATERIAL_PREP', 0),
      N('carp', 'CARPENTRY', 1),
      N('foam', 'FOAM', 2),
      N('uph', 'UPHOLSTERY', 3),
      N('assy', 'ASSEMBLY', 4),
      ...terminal,
    ];
    const edges = [
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
    const g = canonicalizeWorkflowGraph({ nodes, edges });
    expect(edgePairs(g.edges)).toEqual(
      [
        'assy->insp',
        'carp->foam',
        'carp->uph',
        'foam->assy',
        'insp->pack',
        'pack->del',
        'prep->carp',
        'uph->assy',
      ].sort(),
    );
    expect(g.frontierNodeIds).toEqual(['assy']);
    expect(g.predecessorsByNode.insp).toEqual(['assy']);
    expect(edgePairs(g.edges).some((p) => p === 'prep->insp')).toBe(false);
    expect(edgePairs(g.edges).some((p) => p === 'carp->insp')).toBe(false);
  });

  it('Fixture 2 — independent lanes; frontier Uph+Paint; no ancestor→Insp', () => {
    const nodes = [
      N('prep', 'MATERIAL_PREP', 0),
      N('foam', 'FOAM', 1),
      N('uph', 'UPHOLSTERY', 2),
      N('assy', 'ASSEMBLY', 3),
      N('paint', 'PAINTING', 4),
      ...terminal,
    ];
    const edges = [
      E('prep', 'foam'),
      E('foam', 'uph'),
      E('prep', 'assy'),
      E('assy', 'paint'),
      E('uph', 'insp'),
      E('paint', 'insp'),
      E('insp', 'pack'),
      E('pack', 'del'),
    ];
    const g = canonicalizeWorkflowGraph({ nodes, edges });
    expect(g.frontierNodeIds.sort()).toEqual(['paint', 'uph']);
    expect(g.predecessorsByNode.insp?.sort()).toEqual(['paint', 'uph']);
    expect(edgePairs(g.edges).some((p) => p === 'foam->insp')).toBe(false);
    expect(edgePairs(g.edges).some((p) => p === 'assy->insp')).toBe(false);
    const bands = computeParallelBands(g.productionNodeIds, g.predecessorsByNode);
    // Foam and Assy may be parallel (same prep); Uph and Paint have different preds — not one Together join
    expect(
      bands.some(
        (b) =>
          b.nodeIds.includes('uph') &&
          b.nodeIds.includes('paint') &&
          b.predecessorIds.includes('foam'),
      ),
    ).toBe(false);
  });

  it('Fixture 3 — parallel→parallel keeps four deps', () => {
    const nodes = [
      N('carp', 'CARPENTRY', 0),
      N('foam', 'FOAM', 1),
      N('assy', 'ASSEMBLY', 2),
      N('uph', 'UPHOLSTERY', 3),
      N('paint', 'PAINTING', 4),
      ...terminal,
    ];
    const edges = [
      E('carp', 'foam'),
      E('carp', 'assy'),
      E('foam', 'uph'),
      E('assy', 'uph'),
      E('foam', 'paint'),
      E('assy', 'paint'),
      E('insp', 'pack'),
      E('pack', 'del'),
    ];
    const g = canonicalizeWorkflowGraph({ nodes, edges });
    const pairs = edgePairs(g.edges);
    expect(pairs).toEqual(
      expect.arrayContaining([
        'foam->uph',
        'assy->uph',
        'foam->paint',
        'assy->paint',
      ]),
    );
    const bands = g.parallelBands;
    expect(bands.some((b) => b.nodeIds.join(',') === 'assy,foam')).toBe(true);
    expect(bands.some((b) => b.nodeIds.join(',') === 'paint,uph')).toBe(true);
  });

  it('Fixture 4 — parallel→one; two edges into Assembly', () => {
    const nodes = [
      N('carp', 'CARPENTRY', 0),
      N('foam', 'FOAM', 1),
      N('uph', 'UPHOLSTERY', 2),
      N('assy', 'ASSEMBLY', 3),
      ...terminal,
    ];
    const edges = [
      E('carp', 'foam'),
      E('carp', 'uph'),
      E('foam', 'assy'),
      E('uph', 'assy'),
      E('insp', 'pack'),
      E('pack', 'del'),
    ];
    const g = canonicalizeWorkflowGraph({ nodes, edges });
    expect(g.predecessorsByNode.assy?.sort()).toEqual(['foam', 'uph']);
    // Target band size 1 → not parallel→parallel Together
    expect(
      g.parallelBands.some((b) => b.nodeIds.includes('assy') && b.nodeIds.length >= 2),
    ).toBe(false);
  });

  it('deterministic under shuffled edges', () => {
    const nodes = [
      N('prep', 'MATERIAL_PREP', 0),
      N('a', 'A', 1),
      N('b', 'B', 2),
      ...terminal,
    ];
    const edges = [
      E('prep', 'a'),
      E('a', 'b'),
      E('prep', 'b'),
      E('prep', 'insp'),
      E('insp', 'pack'),
      E('pack', 'del'),
    ];
    const g1 = canonicalizeWorkflowGraph({ nodes, edges });
    const g2 = canonicalizeWorkflowGraph({
      nodes: [...nodes].reverse(),
      edges: [...edges].reverse(),
    });
    expect(edgePairs(g1.edges)).toEqual(edgePairs(g2.edges));
  });
});

describe('mutations', () => {
  it('Fixture 5 — Edit Start keeps Carp downstream (critical regression)', () => {
    const nodes = [
      N('prep', 'MATERIAL_PREP', 0),
      N('uph', 'UPHOLSTERY', 1),
      N('carp', 'CARPENTRY', 2),
      ...terminal,
    ];
    const edges = [
      E('prep', 'uph'),
      E('uph', 'carp'),
      E('carp', 'insp'),
      E('insp', 'pack'),
      E('pack', 'del'),
    ];
    const before = fromRawGraph(nodes, edges);
    const after = simulateWorkflowMutation(before, {
      kind: 'EDIT_PLACEMENT',
      nodeId: 'uph',
      placement: { kind: 'START' },
    });
    expect(after.predecessorsByNode.uph).toEqual([]);
    expect(after.predecessorsByNode.carp).toEqual(['uph']);
    // Prep (opening) may remain a parallel frontier if it had no other branches.
    expect(after.frontierNodeIds.sort()).toEqual(['carp', 'prep']);
    expect(after.predecessorsByNode.insp?.sort()).toEqual(['carp', 'prep']);
    expect(edgePairs(after.edges).some((p) => p === 'uph->insp')).toBe(false);
    // Carp is not an illegal floating root
    expect(after.predecessorsByNode.carp?.length).toBeGreaterThan(0);
    expect(edgePairs(after.edges)).toEqual(
      expect.arrayContaining(['uph->carp', 'carp->insp']),
    );
    const v = validateCanonicalWorkflowGraph(after, {
      explicitStartIds: new Set(['uph']),
    });
    expect(v.ok).toBe(true);
  });

  it('Edit Start on Inspection leaf joins stage after Material Prep (no skip to Inspection)', () => {
    const nodes = [
      N('prep', 'MATERIAL_PREP', 0),
      N('carp', 'CARPENTRY', 1),
      N('foam', 'FOAM', 2),
      ...terminal,
    ];
    const edges = [
      E('prep', 'carp'),
      E('carp', 'foam'),
      E('foam', 'insp'),
      E('insp', 'pack'),
      E('pack', 'del'),
    ];
    const before = fromRawGraph(nodes, edges);
    const after = simulateWorkflowMutation(before, {
      kind: 'EDIT_PLACEMENT',
      nodeId: 'foam',
      placement: { kind: 'START' },
    });
    expect(after.predecessorsByNode.foam).toEqual([]);
    // Foam enters at Carp (after Prep), does not skip Carp → Inspection
    expect(after.predecessorsByNode.carp?.sort()).toEqual(['foam', 'prep']);
    expect(edgePairs(after.edges).some((p) => p === 'foam->insp')).toBe(false);
    expect(edgePairs(after.edges)).toEqual(
      expect.arrayContaining(['prep->carp', 'foam->carp', 'carp->insp']),
    );
    const v = validateCanonicalWorkflowGraph(after, {
      explicitStartIds: new Set(['foam']),
    });
    expect(v.ok).toBe(true);
  });

  it('ADD Start also joins stage after Material Prep', () => {
    const nodes = [
      N('prep', 'MATERIAL_PREP', 0),
      N('carp', 'CARPENTRY', 1),
      ...terminal,
    ];
    const edges = [
      E('prep', 'carp'),
      E('carp', 'insp'),
      E('insp', 'pack'),
      E('pack', 'del'),
    ];
    const before = fromRawGraph(nodes, edges);
    const after = simulateWorkflowMutation(before, {
      kind: 'ADD',
      nodeId: 'x',
      code: 'CUSTOM',
      placement: { kind: 'START' },
    });
    expect(after.predecessorsByNode.x).toEqual([]);
    expect(after.predecessorsByNode.carp?.sort()).toEqual(['prep', 'x']);
    expect(edgePairs(after.edges).some((p) => p === 'x->insp')).toBe(false);
  });

  it('EDIT Parallel with Material Prep is a valid Start-like root', () => {
    const nodes = [
      N('prep', 'MATERIAL_PREP', 0),
      N('carp', 'CARPENTRY', 1),
      N('foam', 'FOAM', 2),
      ...terminal,
    ];
    const edges = [
      E('prep', 'carp'),
      E('carp', 'foam'),
      E('foam', 'insp'),
      E('insp', 'pack'),
      E('pack', 'del'),
    ];
    const before = fromRawGraph(nodes, edges);
    const after = simulateWorkflowMutation(before, {
      kind: 'EDIT_PLACEMENT',
      nodeId: 'carp',
      placement: { kind: 'PARALLEL', referenceNodeIds: ['prep'] },
    });
    expect(after.predecessorsByNode.carp).toEqual([]);
    // Foam must not float — stays attached via continuity or reattach
    expect((after.predecessorsByNode.foam ?? []).length).toBeGreaterThan(0);
    const v = validateCanonicalWorkflowGraph(after, {
      explicitStartIds: new Set(['carp']),
    });
    expect(v.ok).toBe(true);
  });

  it('Fixture 6 — remove middle A→B→C becomes A→C; preview=saved via diff', () => {
    const nodes = [
      N('a', 'A', 0),
      N('b', 'B', 1),
      N('c', 'C', 2),
      ...terminal,
    ];
    const edges = [
      E('a', 'b'),
      E('b', 'c'),
      E('c', 'insp'),
      E('insp', 'pack'),
      E('pack', 'del'),
    ];
    const before = fromRawGraph(nodes, edges);
    const preview = simulateWorkflowMutation(before, { kind: 'REMOVE', nodeId: 'b' });
    expect(preview.predecessorsByNode.c).toEqual(['a']);
    const patches = diffPredecessorSets(before, preview);
    // Applying patches conceptually: rebuild from new graph edges
    const saved = fromRawGraph(
      preview.nodes,
      preview.edges.map((e) => ({ from: e.from, to: e.to })),
    );
    expect(edgePairs(saved.edges)).toEqual(edgePairs(preview.edges));
    expect(patches.some((p) => p.nodeId === 'c')).toBe(true);
  });

  it('Fixture 7 — remove parallel child Foam; no invented Carp→Assembly', () => {
    const nodes = [
      N('carp', 'CARPENTRY', 0),
      N('foam', 'FOAM', 1),
      N('uph', 'UPHOLSTERY', 2),
      N('assy', 'ASSEMBLY', 3),
      ...terminal,
    ];
    const edges = [
      E('carp', 'foam'),
      E('carp', 'uph'),
      E('foam', 'assy'),
      E('uph', 'assy'),
      E('insp', 'pack'),
      E('pack', 'del'),
    ];
    const before = fromRawGraph(nodes, edges);
    const after = simulateWorkflowMutation(before, { kind: 'REMOVE', nodeId: 'foam' });
    expect(after.predecessorsByNode.uph).toEqual(['carp']);
    expect(after.predecessorsByNode.assy).toEqual(['uph']);
    // Deterministic splice: Foam's pred Carp is unioned into Assy when Foam removed,
    // but Uph still covers — TR should drop Carp→Assy if Carp→Uph→Assy exists.
    expect(edgePairs(after.edges).some((p) => p === 'carp->assy')).toBe(false);
    expect(after.frontierNodeIds).toEqual(['assy']);
  });

  it('ADD AFTER and PARALLEL', () => {
    const nodes = [
      N('prep', 'MATERIAL_PREP', 0),
      N('carp', 'CARPENTRY', 1),
      ...terminal,
    ];
    const edges = [
      E('prep', 'carp'),
      E('carp', 'insp'),
      E('insp', 'pack'),
      E('pack', 'del'),
    ];
    const g = fromRawGraph(nodes, edges);
    const after = simulateWorkflowMutation(g, {
      kind: 'ADD',
      nodeId: 'foam',
      code: 'FOAM',
      placement: { kind: 'AFTER', predecessorIds: ['carp'] },
    });
    expect(after.predecessorsByNode.foam).toEqual(['carp']);
    expect(after.frontierNodeIds).toEqual(['foam']);

    const par = simulateWorkflowMutation(g, {
      kind: 'ADD',
      nodeId: 'foam2',
      code: 'FOAM',
      placement: { kind: 'PARALLEL', referenceNodeIds: ['carp'] },
    });
    expect(par.predecessorsByNode.foam2).toEqual(['prep']);
  });

  it('PREVIEW = SAVED via diff for Edit Start', () => {
    const nodes = [
      N('prep', 'MATERIAL_PREP', 0),
      N('uph', 'UPHOLSTERY', 1),
      N('carp', 'CARPENTRY', 2),
      ...terminal,
    ];
    const edges = [
      E('prep', 'uph'),
      E('uph', 'carp'),
      E('carp', 'insp'),
      E('insp', 'pack'),
      E('pack', 'del'),
    ];
    const before = fromRawGraph(nodes, edges);
    const preview = simulateWorkflowMutation(before, {
      kind: 'EDIT_PLACEMENT',
      nodeId: 'uph',
      placement: { kind: 'START' },
    });
    const patches = diffPredecessorSets(before, preview);
    // Simulate apply: start from before preds, apply patches, canonicalize
    const pred = { ...before.predecessorsByNode };
    for (const p of patches) {
      pred[p.nodeId] = [...p.runsAfterNodeIds];
    }
    const saved = canonicalizeWorkflowGraph({
      nodes: preview.nodes,
      edges: Object.entries(pred).flatMap(([to, froms]) =>
        froms.map((from) => ({ from, to })),
      ),
    });
    expect(edgePairs(saved.edges)).toEqual(edgePairs(preview.edges));
  });

  it('illegal non-Start root fails validation (canonicalize does not invent parent)', () => {
    const nodes = [
      N('prep', 'MATERIAL_PREP', 0),
      N('orphan', 'ASSEMBLY', 1),
      ...terminal,
    ];
    const edges = [E('insp', 'pack'), E('pack', 'del')];
    const g = canonicalizeWorkflowGraph({ nodes, edges });
    // Orphan may become frontier into Inspection, but still illegal root
    const v = validateCanonicalWorkflowGraph(g);
    expect(v.issues.some((i) => i.code === 'ILLEGAL_ROOT')).toBe(true);
  });
});

describe('explicit successorIds (leads to)', () => {
  const nodes = [
    N('prep', 'MATERIAL_PREP', 0),
    N('foam', 'FOAM', 1),
    N('uph', 'UPHOLSTERY', 2),
    N('paint', 'PAINTING', 3),
    N('assy', 'ASSEMBLY', 4),
    N('carp', 'CARPENTRY', 5),
    N('test', 'TEST_CREATE', 6),
    ...terminal,
  ];
  const edges = [
    E('prep', 'foam'),
    E('prep', 'uph'),
    E('foam', 'paint'),
    E('foam', 'assy'),
    E('uph', 'paint'),
    E('uph', 'assy'),
    E('paint', 'carp'),
    E('assy', 'carp'),
    E('carp', 'insp'),
    E('insp', 'pack'),
    E('pack', 'del'),
    E('prep', 'test'),
  ];

  it('empty successorIds on edit leaves inferred outs (Inspection / restore)', () => {
    const before = fromRawGraph(nodes, edges);
    const after = simulateWorkflowMutation(before, {
      kind: 'EDIT_PLACEMENT',
      nodeId: 'test',
      placement: { kind: 'AFTER', predecessorIds: ['prep'] },
    });
    expect(after.successorsByNode.test?.sort()).toEqual(['insp']);
  });

  it('leads to one stage wires a direct edge', () => {
    const before = fromRawGraph(nodes, edges);
    const after = simulateWorkflowMutation(before, {
      kind: 'EDIT_PLACEMENT',
      nodeId: 'test',
      placement: {
        kind: 'AFTER',
        predecessorIds: ['prep'],
        successorIds: ['paint'],
      },
    });
    expect(after.predecessorsByNode.paint).toEqual(
      expect.arrayContaining(['foam', 'test', 'uph']),
    );
    expect(after.predecessorsByNode.assy).not.toContain('test');
    expect(after.successorsByNode.test).toEqual(['paint']);
  });

  it('leads to two parallel stages feeds both (Together band)', () => {
    const before = fromRawGraph(nodes, edges);
    const after = simulateWorkflowMutation(before, {
      kind: 'EDIT_PLACEMENT',
      nodeId: 'test',
      placement: {
        kind: 'AFTER',
        predecessorIds: ['prep'],
        successorIds: ['paint', 'assy'],
      },
    });
    expect(after.predecessorsByNode.paint).toEqual(
      expect.arrayContaining(['foam', 'test', 'uph']),
    );
    expect(after.predecessorsByNode.assy).toEqual(
      expect.arrayContaining(['foam', 'test', 'uph']),
    );
  });

  it('leads to a later join does not keep the Inspection shortcut', () => {
    const before = fromRawGraph(nodes, edges);
    const after = simulateWorkflowMutation(before, {
      kind: 'EDIT_PLACEMENT',
      nodeId: 'test',
      placement: {
        kind: 'AFTER',
        predecessorIds: ['prep'],
        successorIds: ['carp'],
      },
    });
    expect(after.predecessorsByNode.carp).toEqual(
      expect.arrayContaining(['assy', 'paint', 'test']),
    );
    expect(after.successorsByNode.test).toEqual(['carp']);
    expect(after.frontierNodeIds).not.toContain('test');
  });

  it('explicit empty successorIds on edit drops former production outs', () => {
    const wired = canonicalizeWorkflowGraph({
      nodes,
      edges: [
        ...edges.filter((e) => !(e.from === 'prep' && e.to === 'test')),
        E('test', 'paint'),
        E('prep', 'test'),
      ],
    });
    const after = simulateWorkflowMutation(wired, {
      kind: 'EDIT_PLACEMENT',
      nodeId: 'test',
      placement: {
        kind: 'AFTER',
        predecessorIds: ['prep'],
        successorIds: [],
      },
    });
    expect(after.predecessorsByNode.paint).not.toContain('test');
    expect(after.successorsByNode.test).toEqual(['insp']);
  });

  it('refuses a cycle by skipping an ancestor successor', () => {
    const before = fromRawGraph(nodes, edges);
    const after = simulateWorkflowMutation(before, {
      kind: 'EDIT_PLACEMENT',
      nodeId: 'carp',
      placement: {
        kind: 'AFTER',
        predecessorIds: ['paint', 'assy'],
        successorIds: ['foam'],
      },
    });
    expect(after.predecessorsByNode.foam).not.toContain('carp');
  });

  it('START + leads-to subset of after-Prep wires only those (no Inspection skip)', () => {
    const before = fromRawGraph(nodes, edges);
    // Prep currently feeds foam, uph, test
    const after = simulateWorkflowMutation(before, {
      kind: 'ADD',
      nodeId: 'x',
      code: 'CUSTOM',
      placement: {
        kind: 'START',
        successorIds: ['foam'],
      },
    });
    expect(after.predecessorsByNode.x).toEqual([]);
    expect(after.predecessorsByNode.foam).toEqual(expect.arrayContaining(['prep', 'x']));
    expect(after.predecessorsByNode.uph).not.toContain('x');
    expect(after.predecessorsByNode.test).not.toContain('x');
    expect(edgePairs(after.edges).some((p) => p === 'x->insp')).toBe(false);
  });

  it('START + deep stage in payload is ignored (falls back to after-Prep wiring)', () => {
    const before = fromRawGraph(nodes, edges);
    const after = simulateWorkflowMutation(before, {
      kind: 'ADD',
      nodeId: 'x',
      code: 'CUSTOM',
      placement: {
        kind: 'START',
        successorIds: ['carp'],
      },
    });
    expect(after.predecessorsByNode.carp).not.toContain('x');
    // Deep-only pick filters to empty → default after-Prep join
    expect(after.predecessorsByNode.foam).toEqual(expect.arrayContaining(['prep', 'x']));
    expect(after.predecessorsByNode.uph).toEqual(expect.arrayContaining(['prep', 'x']));
  });

  it('PARALLEL + leads-to wires outs; empty Parallel keeps Inspection path', () => {
    const before = fromRawGraph(nodes, edges);
    const withLeads = simulateWorkflowMutation(before, {
      kind: 'ADD',
      nodeId: 'x',
      code: 'CUSTOM',
      placement: {
        kind: 'PARALLEL',
        referenceNodeIds: ['foam'],
        successorIds: ['paint'],
      },
    });
    expect(withLeads.predecessorsByNode.x).toEqual(['prep']);
    expect(withLeads.predecessorsByNode.paint).toEqual(expect.arrayContaining(['x']));

    const emptyLeads = simulateWorkflowMutation(before, {
      kind: 'ADD',
      nodeId: 'y',
      code: 'CUSTOM',
      placement: {
        kind: 'PARALLEL',
        referenceNodeIds: ['foam'],
      },
    });
    expect(emptyLeads.predecessorsByNode.y).toEqual(['prep']);
    expect(emptyLeads.successorsByNode.y).toEqual(['insp']);
  });
});

describe('After / Parallel placement candidates', () => {
  const nodes = [
    N('prep', 'MATERIAL_PREP', 0),
    N('foam', 'FOAM', 1),
    N('uph', 'UPHOLSTERY', 2),
    N('paint', 'PAINTING', 3),
    N('assy', 'ASSEMBLY', 4),
    N('carp', 'CARPENTRY', 5),
    ...terminal,
  ];
  const edges = [
    E('prep', 'foam'),
    E('prep', 'uph'),
    E('foam', 'paint'),
    E('foam', 'assy'),
    E('uph', 'paint'),
    E('uph', 'assy'),
    E('paint', 'carp'),
    E('assy', 'carp'),
    E('carp', 'insp'),
    E('insp', 'pack'),
    E('pack', 'del'),
  ];

  it('After cannot pick a descendant of the target; can pick Prep / upstream', () => {
    const g = fromRawGraph(nodes, edges);
    const allowed = validPredecessorCandidateIds(g, 'assy', []);
    expect(allowed).toContain('prep');
    expect(allowed).toContain('foam');
    expect(allowed).toContain('uph');
    expect(allowed).not.toContain('carp');
    expect(allowed).not.toContain('insp');
    expect(allowed).not.toContain('assy');
  });

  it('After excludes leads-into picks (except Inspection)', () => {
    const g = fromRawGraph(nodes, edges);
    const allowed = validPredecessorCandidateIds(g, 'assy', [], {
      leadsIntoIds: ['paint'],
    });
    expect(allowed).not.toContain('paint');
    expect(allowed).toContain('prep');
  });

  it('After selecting foam rejects paint (chained) but allows uph (same hop sibling)', () => {
    const g = fromRawGraph(nodes, edges);
    const allowed = validPredecessorCandidateIds(g, '__new__', ['foam']);
    expect(allowed).toContain('foam');
    expect(allowed).toContain('uph');
    expect(allowed).not.toContain('paint');
    expect(allowed).not.toContain('assy');
    expect(allowed).not.toContain('carp');
  });

  it('Parallel: foam OK with uph (shared Prep); prep and carp rejected for assy', () => {
    const g = fromRawGraph(nodes, edges);
    const forAssy = validParallelReferenceCandidateIds(g, 'assy', []);
    expect(forAssy).toContain('paint'); // same preds foam|uph
    expect(forAssy).not.toContain('prep');
    expect(forAssy).not.toContain('foam');
    expect(forAssy).not.toContain('carp');

    const forFoam = validParallelReferenceCandidateIds(g, 'foam', []);
    expect(forFoam).toContain('uph');
    expect(forFoam).not.toContain('paint');
    expect(forFoam).not.toContain('prep');
  });

  it('Parallel after selecting foam rejects paint (different preds / downstream)', () => {
    const g = fromRawGraph(nodes, edges);
    const allowed = validParallelReferenceCandidateIds(g, '__new__', ['foam']);
    expect(allowed).toContain('foam');
    expect(allowed).toContain('uph');
    expect(allowed).not.toContain('paint');
    expect(allowed).not.toContain('assy');
    expect(allowed).not.toContain('carp');
  });
});
