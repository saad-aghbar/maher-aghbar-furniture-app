import { layoutStageGraph } from '@/features/sales-orders/stageGraphLayout';
import {
  insertParallelJoinHubs,
  isJoinHubCode,
  joinHubProgress,
  layoutMapEdges,
} from '../parallelJoinLayout';

function stage(
  code: string,
  dependsOnCodes: string[],
  sortOrder: number,
  progressPercent = 0,
  status = 'PENDING',
) {
  return {
    code,
    name: code,
    status,
    progressPercent,
    dependsOnCodes,
    sortOrder,
  };
}

describe('insertParallelJoinHubs', () => {
  it('inserts a hub for parallel → parallel with shared preds', () => {
    const stages = [
      stage('s1', [], 0),
      stage('s2', [], 1),
      stage('s3', ['s1', 's2'], 2),
      stage('s4', ['s1', 's2'], 3),
    ];
    const withJoins = insertParallelJoinHubs(layoutStageGraph(stages));
    expect(withJoins.joins).toHaveLength(1);
    expect(withJoins.joins[0]!.feederCodes).toEqual(['s1', 's2']);
    expect(withJoins.joins[0]!.successorCodes).toEqual(['s3', 's4']);
  });

  it('does not hub parallel → one or independent lanes', () => {
    expect(
      insertParallelJoinHubs(
        layoutStageGraph([
          stage('s1', [], 0),
          stage('s2', [], 1),
          stage('s3', ['s1', 's2'], 2),
        ]),
      ).joins,
    ).toHaveLength(0);
    expect(
      insertParallelJoinHubs(
        layoutStageGraph([
          stage('s1', [], 0),
          stage('s2', [], 1),
          stage('s3', ['s1'], 2),
          stage('s4', ['s2'], 3),
        ]),
      ).joins,
    ).toHaveLength(0);
  });

  it('independent lanes then merge: no Together; both lane ends feed Next', () => {
    const stages = [
      stage('foam', [], 0),
      stage('assy', [], 1),
      stage('uph', ['foam'], 2),
      stage('paint', ['assy'], 3),
      stage('next', ['uph', 'paint'], 4),
    ];
    const withJoins = insertParallelJoinHubs(layoutStageGraph(stages));
    expect(withJoins.joins).toHaveLength(0);
    const drawn = layoutMapEdges(withJoins);
    expect(drawn).toEqual(
      expect.arrayContaining([
        { from: 'foam', to: 'uph' },
        { from: 'assy', to: 'paint' },
        { from: 'uph', to: 'next' },
        { from: 'paint', to: 'next' },
      ]),
    );
    expect(drawn.some((e) => e.from === 'foam' && e.to === 'next')).toBe(false);
  });
});

describe('layoutMapEdges (canonical edges only — no second TR)', () => {
  it('draws reduced dependsOn as-is; keeps parallel fan-out', () => {
    const stages = [
      stage('prep', [], 0),
      stage('carp', ['prep'], 1),
      stage('foam', ['carp'], 2),
      stage('uph', ['carp'], 3),
      stage('insp', ['foam', 'uph'], 4),
    ];
    const layout = layoutStageGraph(stages);
    const drawn = layoutMapEdges(layout);
    expect(drawn.some((e) => e.from === 'prep' && e.to === 'insp')).toBe(false);
    expect(drawn.some((e) => e.from === 'carp' && e.to === 'foam')).toBe(true);
    expect(drawn.some((e) => e.from === 'carp' && e.to === 'uph')).toBe(true);
    expect(drawn.some((e) => e.from === 'foam' && e.to === 'insp')).toBe(true);
    expect(drawn.some((e) => e.from === 'uph' && e.to === 'insp')).toBe(true);
  });

  it('keeps sole-path long edge (Painting → Inspection)', () => {
    const stages = [
      stage('prep', [], 0),
      stage('paint', [], 1),
      stage('carp', ['prep'], 2),
      stage('foam', ['carp'], 3),
      stage('insp', ['foam', 'paint'], 4),
    ];
    const drawn = layoutMapEdges(layoutStageGraph(stages));
    expect(drawn.some((e) => e.from === 'paint' && e.to === 'insp')).toBe(true);
  });
});

describe('joinHubProgress', () => {
  it('averages feeder progress and requires all done', () => {
    const map = new Map([
      ['a', { status: 'IN_PROGRESS', progressPercent: 50 }],
      ['b', { status: 'COMPLETED', progressPercent: 100 }],
    ]);
    expect(joinHubProgress(['a', 'b'], map)).toEqual({ percent: 75, allDone: false });
    map.set('a', { status: 'DONE', progressPercent: 100 });
    expect(joinHubProgress(['a', 'b'], map).allDone).toBe(true);
  });
});
