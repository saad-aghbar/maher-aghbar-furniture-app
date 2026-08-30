import { describe, expect, it } from 'vitest';
import {
  editConnectionPatches,
  ensureInspectionFeedPatches,
  resolveLeadsIntoForSave,
  sanitizeInspectionPredecessorIds,
  spliceSuccessorPreds,
  wouldCreateCycle,
} from './workflow-rewire';
import {
  isReachableFrom,
  resolveParallelPlacementSafe,
  resolvePlacementAfter,
  resolvePlacementParallelWith,
  resolvePlacementStart,
} from './workflow-terminal';

const edges = [
  { fromNodeId: 'a', toNodeId: 'b' },
  { fromNodeId: 'b', toNodeId: 'c' },
];

describe('workflow-rewire', () => {
  it('detects a cycle A→B→A', () => {
    expect(wouldCreateCycle([{ fromNodeId: 'a', toNodeId: 'b' }], 'b', [], ['a'])).toBe(true);
  });

  it('allows appending after the last stage', () => {
    expect(wouldCreateCycle(edges, 'd', ['c'], [], false)).toBe(false);
  });

  it('splices a new node between preds and succs', () => {
    expect(spliceSuccessorPreds(edges, 'x', ['a'], ['b'])).toEqual([
      { nodeId: 'b', runsAfterNodeIds: ['x'] },
    ]);
  });

  it('editConnectionPatches rewires successors', () => {
    const result = editConnectionPatches(edges, 'b', ['a'], ['c']);
    expect(result.targetRunsAfter).toEqual(['a']);
    expect(result.successorUpdates).toEqual([]);
  });

  it('Edit Start preserves Building successor — no Inspection patch', () => {
    const chain = [
      { fromNodeId: 'prep', toNodeId: 'carp' },
      { fromNodeId: 'carp', toNodeId: 'build' },
      { fromNodeId: 'build', toNodeId: 'insp' },
    ];
    const { targetRunsAfter, successorUpdates } = editConnectionPatches(
      chain,
      'carp',
      [],
      ['build'],
    );
    expect(targetRunsAfter).toEqual([]);
    expect(successorUpdates).toEqual([]);
  });

  it('sanitizes Packaging out of Inspection predecessor lists', () => {
    expect(
      sanitizeInspectionPredecessorIds(
        ['foam', 'pack', 'del', 'insp'],
        (id) =>
          ({ foam: 'FOAM', pack: 'PACKAGING', del: 'DELIVERY', insp: 'INSPECTION' }[id] ?? ''),
      ),
    ).toEqual(['foam']);
  });

  it('empty leadsInto never auto-wires to Delivery', () => {
    const nodes = [
      { id: 'foam', sortOrder: 1 },
      { id: 'insp', sortOrder: 2 },
      { id: 'del', sortOrder: 3 },
    ];
    expect(
      resolveLeadsIntoForSave({
        nodes,
        edges: [{ fromNodeId: 'insp', toNodeId: 'del' }],
        targetId: '__new__',
        runsAfterIds: ['foam'],
        leadsIntoIds: [],
      }),
    ).toEqual([]);
  });

  it('empty leadsInto uses Inspection insertBefore', () => {
    const nodes = [
      { id: 'foam', sortOrder: 1 },
      { id: 'insp', sortOrder: 2 },
      { id: 'del', sortOrder: 3 },
    ];
    expect(
      resolveLeadsIntoForSave({
        nodes,
        edges: [{ fromNodeId: 'insp', toNodeId: 'del' }],
        targetId: '__new__',
        runsAfterIds: ['foam'],
        leadsIntoIds: [],
        insertBeforeNodeId: 'insp',
      }),
    ).toEqual(['insp']);
  });

  it('ensureInspectionFeedPatches is deprecated no-op', () => {
    const nodes = [
      { id: 'foam', sortOrder: 1, stageCode: 'FOAM' },
      { id: 'carp', sortOrder: 2, stageCode: 'CARPENTRY' },
      { id: 'insp', sortOrder: 3, stageCode: 'INSPECTION' },
      { id: 'pack', sortOrder: 4, stageCode: 'PACKAGING' },
      { id: 'del', sortOrder: 5, stageCode: 'DELIVERY' },
    ];
    const broken = [
      { fromNodeId: 'carp', toNodeId: 'insp' },
      { fromNodeId: 'insp', toNodeId: 'pack' },
      { fromNodeId: 'pack', toNodeId: 'del' },
    ];
    expect(ensureInspectionFeedPatches(nodes, broken, 'insp')).toEqual([]);
  });
});

describe('parallel safe placement', () => {
  it('lifts downstream sibling without cycling', () => {
    const chain = [
      { fromNodeId: 'prep', toNodeId: 'carp' },
      { fromNodeId: 'carp', toNodeId: 'paint' },
      { fromNodeId: 'paint', toNodeId: 'insp' },
    ];
    expect(isReachableFrom(chain, 'carp', 'paint')).toBe(true);
    const result = resolveParallelPlacementSafe({
      edges: chain,
      targetId: 'carp',
      siblingNodeIds: ['paint'],
    });
    expect(result.runsAfterIds).toEqual([]);
    expect(result.siblingLiftPatches).toEqual([{ nodeId: 'paint', runsAfterNodeIds: [] }]);
    expect(wouldCreateCycle(chain, 'carp', result.runsAfterIds, ['paint'], true)).toBe(false);
  });

  it('Add parallel unions sibling preds into Inspection', () => {
    const nodes = [
      { id: 'prep', sortOrder: 0, stageDefinition: { code: 'MATERIAL_PREP' } },
      { id: 'carp', sortOrder: 1, stageDefinition: { code: 'CARPENTRY' } },
      { id: 'foam', sortOrder: 2, stageDefinition: { code: 'FOAM' } },
      { id: 'insp', sortOrder: 3, stageDefinition: { code: 'INSPECTION' } },
    ];
    const e = [
      { fromNodeId: 'prep', toNodeId: 'carp' },
      { fromNodeId: 'prep', toNodeId: 'foam' },
      { fromNodeId: 'carp', toNodeId: 'insp' },
      { fromNodeId: 'foam', toNodeId: 'insp' },
    ];
    expect(resolvePlacementStart(nodes).leadsIntoIds).toEqual(['insp']);
    expect(resolvePlacementAfter(nodes, ['carp']).runsAfterIds).toEqual(['carp']);
    expect(resolvePlacementParallelWith(e, nodes, ['carp', 'foam'])).toEqual({
      runsAfterIds: ['prep'],
      leadsIntoIds: ['insp'],
    });
  });
});
