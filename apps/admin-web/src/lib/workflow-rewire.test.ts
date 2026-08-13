import { describe, expect, it } from 'vitest';
import {
  editConnectionPatches,
  spliceSuccessorPreds,
  wouldCreateCycle,
} from './workflow-rewire';

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
});
