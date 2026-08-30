import {
  editConnectionPatches,
  ensureInspectionFeedPatches,
  ensureSingleSinkPatches,
  findTerminals,
  frontierPredecessors,
  isReachableFrom,
  reattachOrphanedSuccessorPatches,
  reduceRedundantPredecessorPatches,
  resolveLeadsIntoForSave,
  resolveSinkId,
  resolveSortOrderForInsert,
  spliceSuccessorPreds,
  validLeadsIntoCandidates,
  validParallelSiblingCandidates,
  validRunsAfterCandidates,
  wouldCreateCycle,
} from '../rewireWorkflowEdges';
import {
  defaultAfterPredecessorIds,
  ensureSensibleRootPatches,
  healedEdgesForVersion,
  normalizeWorkflowEdgesForPreview,
} from '../normalizeWorkflowGraph';
import {
  resolveParallelPlacementSafe,
  resolvePlacementAfter,
  resolvePlacementParallelWith,
  resolvePlacementStart,
} from '../workflowTerminal';

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

describe('Edit Start preserves successors', () => {
  const edges = [
    { fromNodeId: 'prep', toNodeId: 'carp' },
    { fromNodeId: 'carp', toNodeId: 'build' },
    { fromNodeId: 'build', toNodeId: 'insp' },
    { fromNodeId: 'insp', toNodeId: 'pack' },
    { fromNodeId: 'pack', toNodeId: 'del' },
  ];

  it('Start edit only clears preds; Building stays as successor — no Inspection patch', () => {
    const { targetRunsAfter, successorUpdates } = editConnectionPatches(
      edges,
      'carp',
      [],
      ['build'],
    );
    expect(targetRunsAfter).toEqual([]);
    expect(successorUpdates).toEqual([]);
  });

  it('forcing Inspection as leadsInto would update Inspection (avoided on Edit)', () => {
    const { successorUpdates } = editConnectionPatches(edges, 'carp', [], ['insp']);
    expect(successorUpdates.some((u) => u.nodeId === 'insp')).toBe(true);
    expect(successorUpdates.some((u) => u.nodeId === 'build')).toBe(true);
  });
});

describe('Parallel safe placement', () => {
  const edges = [
    { fromNodeId: 'prep', toNodeId: 'carp' },
    { fromNodeId: 'carp', toNodeId: 'paint' },
    { fromNodeId: 'paint', toNodeId: 'insp' },
  ];

  it('detects descendant reachability', () => {
    expect(isReachableFrom(edges, 'carp', 'paint')).toBe(true);
    expect(isReachableFrom(edges, 'paint', 'carp')).toBe(false);
  });

  it('Carpentry parallel with downstream Painting → start-level preds + lift Painting', () => {
    const result = resolveParallelPlacementSafe({
      edges,
      targetId: 'carp',
      siblingNodeIds: ['paint'],
    });
    expect(result.runsAfterIds).toEqual([]);
    expect(result.siblingLiftPatches).toEqual([
      { nodeId: 'paint', runsAfterNodeIds: [] },
    ]);
  });

  it('does not create a cycle for that wiring', () => {
    const { runsAfterIds } = resolveParallelPlacementSafe({
      edges,
      targetId: 'carp',
      siblingNodeIds: ['paint'],
    });
    expect(wouldCreateCycle(edges, 'carp', runsAfterIds, ['paint'], true)).toBe(false);
  });

  it('true siblings share Material Prep without lift', () => {
    const siblingEdges = [
      { fromNodeId: 'prep', toNodeId: 'carp' },
      { fromNodeId: 'prep', toNodeId: 'foam' },
      { fromNodeId: 'carp', toNodeId: 'insp' },
      { fromNodeId: 'foam', toNodeId: 'insp' },
    ];
    const result = resolveParallelPlacementSafe({
      edges: siblingEdges,
      targetId: 'carp',
      siblingNodeIds: ['foam'],
    });
    expect(result.runsAfterIds).toEqual(['prep']);
    expect(result.siblingLiftPatches).toEqual([]);
  });
});

describe('Inspection feed (production authoring)', () => {
  const nodes = [
    { id: 'prep', sortOrder: 0, stageCode: 'MATERIAL_PREP' },
    { id: 'foam', sortOrder: 1, stageCode: 'FOAM' },
    { id: 'carp', sortOrder: 2, stageCode: 'CARPENTRY' },
    { id: 'insp', sortOrder: 3, stageCode: 'INSPECTION' },
    { id: 'pack', sortOrder: 4, stageCode: 'PACKAGING' },
    { id: 'del', sortOrder: 5, stageCode: 'DELIVERY' },
  ];

  const brokenEdges = [
    { fromNodeId: 'prep', toNodeId: 'foam' },
    { fromNodeId: 'prep', toNodeId: 'carp' },
    { fromNodeId: 'carp', toNodeId: 'insp' },
    { fromNodeId: 'insp', toNodeId: 'pack' },
    { fromNodeId: 'pack', toNodeId: 'del' },
  ];

  it('empty leadsInto never falls back to Delivery', () => {
    expect(
      resolveLeadsIntoForSave({
        nodes,
        edges: brokenEdges,
        targetId: '__new__',
        runsAfterIds: ['prep'],
        leadsIntoIds: [],
      }),
    ).toEqual([]);
  });

  it('empty leadsInto wires to Inspection when insertBeforeNodeId set', () => {
    expect(
      resolveLeadsIntoForSave({
        nodes,
        edges: brokenEdges,
        targetId: '__new__',
        runsAfterIds: ['prep'],
        leadsIntoIds: [],
        insertBeforeNodeId: 'insp',
      }),
    ).toEqual(['insp']);
  });

  it('ensureInspectionFeedPatches is deprecated no-op (domain owns frontier)', () => {
    const patches = ensureInspectionFeedPatches(nodes, brokenEdges, 'insp');
    expect(patches).toEqual([]);
  });

  it('frontier-drops ancestor Inspection preds when a covering path exists — heal retired', () => {
    const chainEdges = [
      { fromNodeId: 'prep', toNodeId: 'carp' },
      { fromNodeId: 'carp', toNodeId: 'foam' },
      { fromNodeId: 'foam', toNodeId: 'insp' },
      { fromNodeId: 'prep', toNodeId: 'insp' },
      { fromNodeId: 'carp', toNodeId: 'insp' },
      { fromNodeId: 'insp', toNodeId: 'pack' },
      { fromNodeId: 'pack', toNodeId: 'del' },
    ];
    expect(ensureInspectionFeedPatches(nodes, chainEdges, 'insp')).toEqual([]);
  });

  it('frontierPredecessors keeps independent lane ends', () => {
    const edges = [
      { fromNodeId: 'foam', toNodeId: 'uph' },
      { fromNodeId: 'assy', toNodeId: 'paint' },
    ];
    expect(frontierPredecessors(edges, ['uph', 'paint', 'foam', 'assy']).sort()).toEqual([
      'paint',
      'uph',
    ]);
  });

  it('ensureSensibleRootPatches is deprecated no-op (orphans stay illegal roots)', () => {
    const nodes = [
      { id: 'prep', sortOrder: 0, stageDefinition: { code: 'MATERIAL_PREP' } },
      { id: 'assy', sortOrder: 1, stageDefinition: { code: 'ASSEMBLY' } },
      { id: 'insp', sortOrder: 2, stageDefinition: { code: 'INSPECTION' } },
    ];
    expect(ensureSensibleRootPatches(nodes, [])).toEqual([]);
  });

  it('ensureSensibleRootPatches leaves parallel roots that already fan out', () => {
    const nodes = [
      { id: 'prep', sortOrder: 0, stageDefinition: { code: 'MATERIAL_PREP' } },
      { id: 'carp', sortOrder: 1, stageDefinition: { code: 'CARPENTRY' } },
      { id: 'assy', sortOrder: 2, stageDefinition: { code: 'ASSEMBLY' } },
    ];
    const edges = [
      { fromNodeId: 'prep', toNodeId: 'assy' },
      { fromNodeId: 'carp', toNodeId: 'assy' },
    ];
    expect(ensureSensibleRootPatches(nodes, edges)).toEqual([]);
  });

  it('defaultAfterPredecessorIds picks a middle tail or Prep', () => {
    const nodes = [
      { id: 'prep', sortOrder: 0, stageDefinition: { code: 'MATERIAL_PREP' } },
      { id: 'carp', sortOrder: 1, stageDefinition: { code: 'CARPENTRY' } },
      { id: 'foam', sortOrder: 2, stageDefinition: { code: 'FOAM' } },
      { id: 'insp', sortOrder: 3, stageDefinition: { code: 'INSPECTION' } },
    ];
    const edges = [
      { fromNodeId: 'prep', toNodeId: 'carp' },
      { fromNodeId: 'carp', toNodeId: 'foam' },
    ];
    expect(defaultAfterPredecessorIds(nodes, edges)).toEqual(['foam']);
  });

  it('orphaned stage heal retired — domain validate flags illegal root', () => {
    const orphanEdges = [
      { fromNodeId: 'carp', toNodeId: 'insp' },
      { fromNodeId: 'insp', toNodeId: 'pack' },
      { fromNodeId: 'pack', toNodeId: 'del' },
    ];
    expect(ensureInspectionFeedPatches(nodes, orphanEdges, 'insp')).toEqual([]);
  });

  it('does not heal Packaging/Delivery into Inspection', () => {
    const edgesNoOut = [
      { fromNodeId: 'prep', toNodeId: 'insp' },
      { fromNodeId: 'insp', toNodeId: 'pack' },
    ];
    const patches = ensureInspectionFeedPatches(nodes, edgesNoOut, 'insp');
    expect(patches).toEqual([]);
  });

  it('legacy ensureSingleSinkPatches still wires into provided sink', () => {
    const patches = ensureSingleSinkPatches(nodes, brokenEdges, 'del');
    expect(patches[0]?.nodeId).toBe('del');
    expect(patches[0]?.runsAfterNodeIds).toContain('foam');
  });
});

describe('placement helpers', () => {
  const nodes = [
    { id: 'prep', sortOrder: 0, stageDefinition: { code: 'MATERIAL_PREP' } },
    { id: 'carp', sortOrder: 1, stageDefinition: { code: 'CARPENTRY' } },
    { id: 'foam', sortOrder: 2, stageDefinition: { code: 'FOAM' } },
    { id: 'insp', sortOrder: 3, stageDefinition: { code: 'INSPECTION' } },
    { id: 'pack', sortOrder: 4, stageDefinition: { code: 'PACKAGING' } },
    { id: 'del', sortOrder: 5, stageDefinition: { code: 'DELIVERY' } },
  ];
  const edges = [
    { fromNodeId: 'prep', toNodeId: 'carp' },
    { fromNodeId: 'prep', toNodeId: 'foam' },
    { fromNodeId: 'carp', toNodeId: 'insp' },
    { fromNodeId: 'foam', toNodeId: 'insp' },
    { fromNodeId: 'insp', toNodeId: 'pack' },
    { fromNodeId: 'pack', toNodeId: 'del' },
  ];

  it('start placement is root into Inspection', () => {
    expect(resolvePlacementStart(nodes)).toEqual({
      runsAfterIds: [],
      leadsIntoIds: ['insp'],
    });
  });

  it('after placement uses selected preds into Inspection', () => {
    expect(resolvePlacementAfter(nodes, ['carp'])).toEqual({
      runsAfterIds: ['carp'],
      leadsIntoIds: ['insp'],
    });
  });

  it('parallelWith unions sibling preds into Inspection', () => {
    expect(resolvePlacementParallelWith(edges, nodes, ['carp', 'foam'])).toEqual({
      runsAfterIds: ['prep'],
      leadsIntoIds: ['insp'],
    });
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

  it('finds terminals', () => {
    expect(findTerminals(edges, nodes.map((n) => n.id))).toEqual(['del']);
  });

  it('resolves sink', () => {
    expect(resolveSinkId(nodes, edges)).toBe('del');
  });

  it('allows Delivery as Leads into when runs after mid-chain', () => {
    const leads = validLeadsIntoCandidates(nodes, edges, '__new__', ['insp'], []);
    expect(leads).toContain('del');
    expect(leads).toContain('carp');
    expect(leads).not.toContain('foam');
  });

  it('seed-equivalent append after sink does not cycle', () => {
    expect(wouldCreateCycle(edges, '__new__', ['del'], [])).toBe(false);
  });

  it('validRunsAfterCandidates still returns candidates', () => {
    const runs = validRunsAfterCandidates(nodes, edges, '__new__', [], []);
    expect(runs.length).toBeGreaterThan(0);
  });
});

describe('sanitizeInspectionPredecessorIds', () => {
  it('strips Packaging/Delivery/Inspection from Inspection pred lists', () => {
    const { sanitizeInspectionPredecessorIds } = require('../rewireWorkflowEdges');
    const codeOf = (id: string) =>
      ({ prep: 'MATERIAL_PREP', foam: 'FOAM', pack: 'PACKAGING', del: 'DELIVERY', insp: 'INSPECTION' }[
        id
      ] ?? '');
    expect(
      sanitizeInspectionPredecessorIds(['prep', 'foam', 'pack', 'del', 'insp'], codeOf),
    ).toEqual(['prep', 'foam']);
  });
});

describe('buildPlacementPreviewPath', () => {
  const { buildPlacementPreviewPath } = require('../buildPlacementPreviewPath');
  const nodes = [
    { id: 'prep', sortOrder: 0, stageDefinition: { code: 'MATERIAL_PREP' } },
    { id: 'carp', sortOrder: 1, stageDefinition: { code: 'CARPENTRY' } },
    { id: 'foam', sortOrder: 2, stageDefinition: { code: 'FOAM' } },
    { id: 'uph', sortOrder: 3, stageDefinition: { code: 'UPHOLSTERY' } },
    { id: 'insp', sortOrder: 4, stageDefinition: { code: 'INSPECTION' } },
    { id: 'pack', sortOrder: 5, stageDefinition: { code: 'PACKAGING' } },
    { id: 'del', sortOrder: 6, stageDefinition: { code: 'DELIVERY' } },
  ];
  const edges = [
    { fromNodeId: 'prep', toNodeId: 'carp' },
    { fromNodeId: 'carp', toNodeId: 'foam' },
    { fromNodeId: 'foam', toNodeId: 'uph' },
    { fromNodeId: 'uph', toNodeId: 'insp' },
    { fromNodeId: 'insp', toNodeId: 'pack' },
    { fromNodeId: 'pack', toNodeId: 'del' },
  ];

  function flatCodes(path: { segments: Array<{ chips: Array<{ code?: string; kind: string }> }> }) {
    return path.segments.flatMap((s) =>
      s.chips.map((c) => (c.kind === 'you' ? 'YOU' : c.code)),
    );
  }

  it('After Foam shows every stage with You after Foam', () => {
    const path = buildPlacementPreviewPath({
      nodes,
      edges,
      runsAfterIds: ['foam'],
      leadsIntoIds: ['insp'],
      targetId: 'uph',
    });
    expect(flatCodes(path)).toEqual([
      'MATERIAL_PREP',
      'CARPENTRY',
      'FOAM',
      'YOU',
      'INSPECTION',
      'PACKAGING',
      'DELIVERY',
    ]);
    expect(path.segments[0].chips[0].locked).toBe(true);
  });

  it('Start shows Prep‖You then all other stages', () => {
    const path = buildPlacementPreviewPath({
      nodes,
      edges,
      runsAfterIds: [],
      leadsIntoIds: ['insp'],
      startBesidePrep: true,
      targetId: 'uph',
    });
    expect(path.segments[0].together).toBe(false); // independent lanes — no Together hub
    expect(flatCodes(path)).toEqual([
      'MATERIAL_PREP',
      'YOU',
      'CARPENTRY',
      'FOAM',
      'INSPECTION',
      'PACKAGING',
      'DELIVERY',
    ]);
  });

  it('Parallel with Foam groups You with Foam and keeps other stages', () => {
    const path = buildPlacementPreviewPath({
      nodes,
      edges,
      runsAfterIds: ['carp'],
      leadsIntoIds: ['insp'],
      parallelSiblingIds: ['foam'],
      targetId: 'uph',
    });
    const codes = flatCodes(path);
    expect(codes).toContain('CARPENTRY');
    expect(codes).toContain('YOU');
    expect(codes).toContain('FOAM');
    expect(codes).toContain('INSPECTION');
    // Inside parallel band — Together hub ABSENT
    expect(path.segments.some((s: { together: boolean }) => s.together)).toBe(false);
  });
});

describe('spider-web reduction + filtered picks', () => {
  const spiderNodes = [
    {
      id: 'prep',
      sortOrder: 0,
      stageDefinition: {
        id: 'sd-prep',
        code: 'MATERIAL_PREP',
        nameEn: 'Prep',
        nameAr: 'p',
        nameHe: 'p',
        sortOrder: 0,
        isActive: true,
      },
    },
    {
      id: 'carp',
      sortOrder: 1,
      stageDefinition: {
        id: 'sd-carp',
        code: 'CARPENTRY',
        nameEn: 'Carpentry',
        nameAr: 'c',
        nameHe: 'c',
        sortOrder: 1,
        isActive: true,
      },
    },
    {
      id: 'assy',
      sortOrder: 2,
      stageDefinition: {
        id: 'sd-assy',
        code: 'ASSEMBLY',
        nameEn: 'Assembly',
        nameAr: 'a',
        nameHe: 'a',
        sortOrder: 2,
        isActive: true,
      },
    },
    {
      id: 'paint',
      sortOrder: 3,
      stageDefinition: {
        id: 'sd-paint',
        code: 'PAINTING',
        nameEn: 'Painting',
        nameAr: 'paint',
        nameHe: 'paint',
        sortOrder: 3,
        isActive: true,
      },
    },
    {
      id: 'insp',
      sortOrder: 4,
      stageDefinition: {
        id: 'sd-insp',
        code: 'INSPECTION',
        nameEn: 'Inspection',
        nameAr: 'i',
        nameHe: 'i',
        sortOrder: 4,
        isActive: true,
      },
    },
  ];

  const spiderEdges = [
    { fromNodeId: 'prep', toNodeId: 'assy' },
    { fromNodeId: 'carp', toNodeId: 'assy' },
    { fromNodeId: 'assy', toNodeId: 'paint' },
    { fromNodeId: 'paint', toNodeId: 'insp' },
    // redundant spider edges
    { fromNodeId: 'prep', toNodeId: 'paint' },
    { fromNodeId: 'prep', toNodeId: 'insp' },
    { fromNodeId: 'carp', toNodeId: 'insp' },
    { fromNodeId: 'assy', toNodeId: 'insp' },
  ];

  it('reduceRedundantPredecessorPatches drops transitive preds', () => {
    const patches = reduceRedundantPredecessorPatches(
      spiderNodes.map((n) => n.id),
      spiderEdges,
    );
    expect(patches).toEqual(
      expect.arrayContaining([
        { nodeId: 'paint', runsAfterNodeIds: ['assy'] },
        { nodeId: 'insp', runsAfterNodeIds: ['paint'] },
      ]),
    );
  });

  it('normalizeWorkflowEdgesForPreview keeps covering edges only', () => {
    const version = {
      id: 'v1',
      versionNumber: 1,
      status: 'DRAFT',
      revision: 1,
      nodes: spiderNodes,
      edges: spiderEdges.map((e, i) => ({ id: `e${i}`, ...e })),
    } as import('@/api/modules/workflow').WorkflowVersion;

    const normalized = normalizeWorkflowEdgesForPreview(version, spiderNodes as never);
    const pairs = normalized.map((e) => `${e.fromNodeId}->${e.toNodeId}`).sort();
    expect(pairs).toEqual(
      ['assy->paint', 'carp->assy', 'paint->insp', 'prep->assy'].sort(),
    );
    expect(pairs.some((p) => p === 'prep->insp')).toBe(false);
    expect(pairs.some((p) => p === 'carp->insp')).toBe(false);
  });

  it('edit with Inspection-only leadsInto drops former multi-outs', () => {
    const edges = [
      { fromNodeId: 'prep', toNodeId: 'assy' },
      { fromNodeId: 'assy', toNodeId: 'paint' },
      { fromNodeId: 'assy', toNodeId: 'insp' },
      { fromNodeId: 'paint', toNodeId: 'insp' },
    ];
    const { successorUpdates } = editConnectionPatches(edges, 'assy', ['prep'], ['insp']);
    expect(successorUpdates).toContainEqual({
      nodeId: 'paint',
      runsAfterNodeIds: [],
    });
    // Inspection already has assy — no add patch required
    expect(successorUpdates.every((u) => u.nodeId !== 'insp' || u.runsAfterNodeIds.includes('assy'))).toBe(
      true,
    );
  });

  it('After picker excludes descendants of the target', () => {
    const nodes = spiderNodes.map((n) => ({ id: n.id, sortOrder: n.sortOrder }));
    const chain = [
      { fromNodeId: 'prep', toNodeId: 'assy' },
      { fromNodeId: 'assy', toNodeId: 'paint' },
      { fromNodeId: 'paint', toNodeId: 'insp' },
    ];
    const allowed = validRunsAfterCandidates(nodes, chain, 'assy', [], ['insp'], true);
    expect(allowed).toContain('prep');
    expect(allowed).not.toContain('paint');
    expect(allowed).not.toContain('insp');
  });

  it('Parallel picker excludes ancestors and descendants', () => {
    const edges = [
      { fromNodeId: 'prep', toNodeId: 'foam' },
      { fromNodeId: 'prep', toNodeId: 'assy' },
      { fromNodeId: 'assy', toNodeId: 'paint' },
      { fromNodeId: 'foam', toNodeId: 'insp' },
      { fromNodeId: 'paint', toNodeId: 'insp' },
    ];
    const allowed = validParallelSiblingCandidates(
      edges,
      'assy',
      ['prep', 'foam', 'paint', 'insp'],
      [],
    );
    expect(allowed).toContain('foam');
    expect(allowed).not.toContain('prep');
    expect(allowed).not.toContain('paint');
    expect(allowed).not.toContain('insp');
  });
});

describe('unify connections: Start preserve + After gap-close + healed edges', () => {
  it('reattachOrphanedSuccessorPatches gap-closes empty former outs', () => {
    const updates = [
      { nodeId: 'paint', runsAfterNodeIds: [] as string[] },
      { nodeId: 'insp', runsAfterNodeIds: ['paint', 'assy'] },
    ];
    const next = reattachOrphanedSuccessorPatches('assy', ['prep'], ['insp'], updates);
    expect(next).toContainEqual({ nodeId: 'paint', runsAfterNodeIds: ['prep'] });
    expect(next.find((u) => u.nodeId === 'insp')?.runsAfterNodeIds).toEqual(
      expect.arrayContaining(['assy']),
    );
  });

  it('Start preserve outs leaves Carp after Uph (no empty-pred Carp)', () => {
    const edges = [
      { fromNodeId: 'prep', toNodeId: 'uph' },
      { fromNodeId: 'uph', toNodeId: 'carp' },
      { fromNodeId: 'carp', toNodeId: 'insp' },
    ];
    const { targetRunsAfter, successorUpdates } = editConnectionPatches(
      edges,
      'uph',
      [],
      ['carp'],
    );
    expect(targetRunsAfter).toEqual([]);
    expect(successorUpdates).toEqual([]);
    const reattached = reattachOrphanedSuccessorPatches('uph', [], ['carp'], successorUpdates);
    expect(reattached).toEqual([]);
  });

  it('After dropping multi-outs reattaches next stage then reduce drops Prep→Insp', () => {
    const edges = [
      { fromNodeId: 'prep', toNodeId: 'assy' },
      { fromNodeId: 'assy', toNodeId: 'paint' },
      { fromNodeId: 'paint', toNodeId: 'insp' },
      { fromNodeId: 'assy', toNodeId: 'insp' },
    ];
    const { targetRunsAfter, successorUpdates } = editConnectionPatches(
      edges,
      'assy',
      ['prep'],
      ['insp'],
    );
    const patches = reattachOrphanedSuccessorPatches(
      'assy',
      targetRunsAfter,
      ['insp'],
      successorUpdates,
    );
    expect(patches).toContainEqual({ nodeId: 'paint', runsAfterNodeIds: ['prep'] });

    // After gap-close + keeping chain continuity: paint still covers path to Insp.
    const afterEdit = [
      { fromNodeId: 'prep', toNodeId: 'assy' },
      { fromNodeId: 'prep', toNodeId: 'paint' },
      { fromNodeId: 'assy', toNodeId: 'paint' },
      { fromNodeId: 'paint', toNodeId: 'insp' },
      { fromNodeId: 'assy', toNodeId: 'insp' },
      { fromNodeId: 'prep', toNodeId: 'insp' },
    ];
    const reduced = reduceRedundantPredecessorPatches(
      ['prep', 'assy', 'paint', 'insp'],
      afterEdit,
    );
    expect(reduced).toEqual(
      expect.arrayContaining([
        { nodeId: 'insp', runsAfterNodeIds: ['paint'] },
        { nodeId: 'paint', runsAfterNodeIds: ['assy'] },
      ]),
    );
  });

  it('healedEdgesForVersion matches map depends for spider fixture', () => {
    const version = {
      id: 'v1',
      versionNumber: 1,
      status: 'DRAFT',
      revision: 1,
      nodes: [
        {
          id: 'prep',
          nodeKey: 'MATERIAL_PREP',
          sortOrder: 0,
          isRequiredByDefault: true,
          canBeSkipped: false,
          stageDefinition: {
            id: 'sd-prep',
            code: 'MATERIAL_PREP',
            nameEn: 'Prep',
            nameAr: 'p',
            nameHe: 'p',
            sortOrder: 0,
            isActive: true,
          },
        },
        {
          id: 'carp',
          nodeKey: 'CARPENTRY',
          sortOrder: 1,
          isRequiredByDefault: true,
          canBeSkipped: false,
          stageDefinition: {
            id: 'sd-carp',
            code: 'CARPENTRY',
            nameEn: 'Carp',
            nameAr: 'c',
            nameHe: 'c',
            sortOrder: 1,
            isActive: true,
          },
        },
        {
          id: 'assy',
          nodeKey: 'ASSEMBLY',
          sortOrder: 2,
          isRequiredByDefault: true,
          canBeSkipped: false,
          stageDefinition: {
            id: 'sd-assy',
            code: 'ASSEMBLY',
            nameEn: 'Assy',
            nameAr: 'a',
            nameHe: 'a',
            sortOrder: 2,
            isActive: true,
          },
        },
        {
          id: 'paint',
          nodeKey: 'PAINTING',
          sortOrder: 3,
          isRequiredByDefault: true,
          canBeSkipped: false,
          stageDefinition: {
            id: 'sd-paint',
            code: 'PAINTING',
            nameEn: 'Paint',
            nameAr: 'p',
            nameHe: 'p',
            sortOrder: 3,
            isActive: true,
          },
        },
        {
          id: 'insp',
          nodeKey: 'INSPECTION',
          sortOrder: 4,
          isRequiredByDefault: true,
          canBeSkipped: false,
          stageDefinition: {
            id: 'sd-insp',
            code: 'INSPECTION',
            nameEn: 'Insp',
            nameAr: 'i',
            nameHe: 'i',
            sortOrder: 4,
            isActive: true,
          },
        },
      ],
      edges: [
        { id: 'e1', fromNodeId: 'prep', toNodeId: 'assy' },
        { id: 'e2', fromNodeId: 'carp', toNodeId: 'assy' },
        { id: 'e3', fromNodeId: 'assy', toNodeId: 'paint' },
        { id: 'e4', fromNodeId: 'paint', toNodeId: 'insp' },
        { id: 'e5', fromNodeId: 'prep', toNodeId: 'paint' },
        { id: 'e6', fromNodeId: 'prep', toNodeId: 'insp' },
        { id: 'e7', fromNodeId: 'carp', toNodeId: 'insp' },
        { id: 'e8', fromNodeId: 'assy', toNodeId: 'insp' },
      ],
    } as import('@/api/modules/workflow').WorkflowVersion;

    const healed = healedEdgesForVersion(version)
      .map((e) => `${e.fromNodeId}->${e.toNodeId}`)
      .sort();
    const viaSelect = require('../selectProductionFlowFromWorkflowVersion')
      .selectProductionFlowFromWorkflowVersion(version, 'en') as Array<{
      code: string;
      dependsOnCodes: string[];
    }>;
    const fromStages = viaSelect
      .flatMap((s) => s.dependsOnCodes.map((d) => `${d}->${s.code}`))
      .sort();
    expect(fromStages).toEqual(healed);
  });

  it('placement Start gap-closes former preds onto preserved successor', () => {
    const { buildPlacementPreviewPath } = require('../buildPlacementPreviewPath');
    const nodes = [
      { id: 'prep', sortOrder: 0, stageDefinition: { code: 'MATERIAL_PREP' } },
      { id: 'uph', sortOrder: 1, stageDefinition: { code: 'UPHOLSTERY' } },
      { id: 'carp', sortOrder: 2, stageDefinition: { code: 'CARPENTRY' } },
      { id: 'insp', sortOrder: 3, stageDefinition: { code: 'INSPECTION' } },
    ];
    const edges = [
      { fromNodeId: 'prep', toNodeId: 'uph' },
      { fromNodeId: 'uph', toNodeId: 'carp' },
      { fromNodeId: 'carp', toNodeId: 'insp' },
    ];
    const path = buildPlacementPreviewPath({
      nodes,
      edges,
      runsAfterIds: [],
      leadsIntoIds: ['carp'],
      startBesidePrep: true,
      targetId: 'uph',
    });
    const codes = path.segments.flatMap((s: { chips: Array<{ code?: string; kind: string }> }) =>
      s.chips.map((c) => (c.kind === 'you' ? 'YOU' : c.code)),
    );
    expect(codes).toContain('YOU');
    expect(codes).toContain('CARPENTRY');
    // Should not invent a lone Prep→Inspection-only dump that drops Carp from the chain.
    expect(codes).toContain('MATERIAL_PREP');
  });
});
