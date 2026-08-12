import {
  editConnectionPatches,
  ensureSingleSinkPatches,
  findTerminals,
  resolveLeadsIntoForSave,
  resolveSinkId,
  resolveSortOrderForInsert,
  spliceSuccessorPreds,
  validLeadsIntoCandidates,
  validRunsAfterCandidates,
  wouldCreateCycle,
} from '../rewireWorkflowEdges';

describe('rewireWorkflowEdges', () => {
  const edges = [
    { fromNodeId: 'a', toNodeId: 'b' },
    { fromNodeId: 'b', toNodeId: 'c' },
  ];

  it('detects a cycle when splicing would loop', () => {
    expect(wouldCreateCycle(edges, 'x', ['c'], ['a'])).toBe(true);
  });

  it('allows start insert that leads into root', () => {
    expect(wouldCreateCycle(edges, 'x', [], ['a'])).toBe(false);
  });

  it('splices successor preds for mid insert', () => {
    const patches = spliceSuccessorPreds(edges, 'x', ['a'], ['b']);
    expect(patches).toEqual([{ nodeId: 'b', runsAfterNodeIds: ['x'] }]);
  });

  it('appends terminal without successor patches', () => {
    expect(spliceSuccessorPreds(edges, 'x', ['c'], [])).toEqual([]);
  });

  it('edit drops former successors and adds new ones', () => {
    const { targetRunsAfter, successorUpdates } = editConnectionPatches(
      edges,
      'b',
      ['a'],
      ['c'],
    );
    expect(targetRunsAfter).toEqual(['a']);
    expect(successorUpdates).toEqual([]);
  });

  it('edit removes target from dropped successor', () => {
    const { successorUpdates } = editConnectionPatches(edges, 'b', ['a'], []);
    expect(successorUpdates).toContainEqual({ nodeId: 'c', runsAfterNodeIds: [] });
  });

  it('resolves sort order for start vs append', () => {
    const nodes = [
      { id: 'a', sortOrder: 0 },
      { id: 'b', sortOrder: 1 },
    ];
    expect(resolveSortOrderForInsert(nodes, [], ['a'])).toBe(0);
    expect(resolveSortOrderForInsert(nodes, ['b'], [])).toBe(2);
  });
});

describe('single sink helpers', () => {
  const nodes = [
    { id: 'prep', sortOrder: 0 },
    { id: 'pack', sortOrder: 1 },
    { id: 'carp', sortOrder: 2 },
    { id: 'asm', sortOrder: 3 },
    { id: 'del', sortOrder: 4 },
  ];

  /** Parallel dead-end: prep→pack→asm→del and prep→carp (no out). */
  const brokenEdges = [
    { fromNodeId: 'prep', toNodeId: 'pack' },
    { fromNodeId: 'pack', toNodeId: 'asm' },
    { fromNodeId: 'asm', toNodeId: 'del' },
    { fromNodeId: 'prep', toNodeId: 'carp' },
  ];

  it('finds multiple terminals including dead-ends', () => {
    expect(findTerminals(brokenEdges, nodes.map((n) => n.id)).sort()).toEqual([
      'carp',
      'del',
    ]);
  });

  it('resolves sink as highest-sortOrder terminal', () => {
    expect(resolveSinkId(nodes, brokenEdges)).toBe('del');
  });

  it('auto-wires empty leadsInto to Delivery for parallel dead-end', () => {
    expect(
      resolveLeadsIntoForSave({
        nodes,
        edges: brokenEdges,
        targetId: '__new__',
        runsAfterIds: ['prep'],
        leadsIntoIds: [],
      }),
    ).toEqual(['del']);
  });

  it('keeps empty leadsInto when appending after the sink (new end)', () => {
    expect(
      resolveLeadsIntoForSave({
        nodes,
        edges: brokenEdges,
        targetId: '__new__',
        runsAfterIds: ['del'],
        leadsIntoIds: [],
      }),
    ).toEqual([]);
  });

  it('keeps empty leadsInto when editing the current sink', () => {
    expect(
      resolveLeadsIntoForSave({
        nodes,
        edges: brokenEdges,
        targetId: 'del',
        runsAfterIds: ['asm'],
        leadsIntoIds: [],
      }),
    ).toEqual([]);
  });

  it('heals multi-terminal graph by wiring dead-ends into sink', () => {
    const patches = ensureSingleSinkPatches(nodes, brokenEdges, 'del');
    expect(patches).toEqual([
      { nodeId: 'del', runsAfterNodeIds: ['asm', 'carp'] },
    ]);
  });

  it('returns no heal patches when already single-sink', () => {
    const healthy = [...brokenEdges, { fromNodeId: 'carp', toNodeId: 'del' }];
    expect(ensureSingleSinkPatches(nodes, healthy, 'del')).toEqual([]);
  });
});

describe('valid pick candidates', () => {
  const nodes = [
    { id: 'foam', sortOrder: 0 },
    { id: 'insp', sortOrder: 1 },
    { id: 'carp', sortOrder: 2 },
    { id: 'del', sortOrder: 3 },
  ];
  const edges = [
    { fromNodeId: 'foam', toNodeId: 'insp' },
    { fromNodeId: 'insp', toNodeId: 'carp' },
    { fromNodeId: 'carp', toNodeId: 'del' },
  ];

  it('hides upstream stages from Leads into when runs after a later stage', () => {
    const leads = validLeadsIntoCandidates(nodes, edges, '__new__', ['carp'], []);
    expect(leads).toContain('del');
    expect(leads).not.toContain('foam');
    expect(leads).not.toContain('insp');
  });

  it('hides downstream stages from Runs after when leading into an early stage', () => {
    const runs = validRunsAfterCandidates(nodes, edges, '__new__', [], ['foam']);
    expect(runs).not.toContain('insp');
    expect(runs).not.toContain('carp');
    // Sink remains selectable: picking it clears Leads into (append-after-end).
    expect(runs).toContain('del');
  });

  it('allows Delivery as Leads into when runs after mid-chain', () => {
    const leads = validLeadsIntoCandidates(nodes, edges, '__new__', ['insp'], []);
    expect(leads).toContain('del');
    expect(leads).toContain('carp');
    expect(leads).not.toContain('foam');
  });

  it('allows sink as Runs after when leadsInto is empty (append-after-end)', () => {
    const runs = validRunsAfterCandidates(nodes, edges, '__new__', [], []);
    expect(runs).toContain('del');
    expect(resolveSinkId(nodes, edges)).toBe('del');
  });

  it('allows sink as Runs after even when it is currently in Leads into', () => {
    const runs = validRunsAfterCandidates(nodes, edges, '__new__', [], ['del']);
    expect(runs).toContain('del');
  });

  it('resolveLeadsIntoForSave with runsAfter=[sink] yields empty (new end)', () => {
    expect(
      resolveLeadsIntoForSave({
        nodes,
        edges,
        targetId: '__new__',
        runsAfterIds: ['del'],
        leadsIntoIds: [],
      }),
    ).toEqual([]);
  });

  it('seed-equivalent append after sink does not cycle', () => {
    expect(wouldCreateCycle(edges, '__new__', ['del'], [])).toBe(false);
  });
});
