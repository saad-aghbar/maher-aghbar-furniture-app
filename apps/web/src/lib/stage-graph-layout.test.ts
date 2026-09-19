import { describe, expect, it } from 'vitest';
import { displayStageEdges, layoutStageGraph } from './stage-graph-layout';

function stage(
  code: string,
  dependsOnCodes: string[],
  sortOrder: number,
) {
  return { code, dependsOnCodes, sortOrder };
}

describe('layoutStageGraph', () => {
  it('lays out a linear path one node per level', () => {
    const layout = layoutStageGraph([
      stage('A', [], 0),
      stage('B', ['A'], 1),
      stage('C', ['B'], 2),
    ]);
    expect(layout.levelCount).toBe(3);
    expect(layout.maxLanes).toBe(1);
    expect(layout.nodes.map((n) => `${n.code}:${n.level}`)).toEqual(['A:0', 'B:1', 'C:2']);
  });

  it('places fork siblings on the same level in distinct lanes', () => {
    const layout = layoutStageGraph([
      stage('CARPENTRY', [], 0),
      stage('FOAM', ['CARPENTRY'], 1),
      stage('PAINTING', ['CARPENTRY'], 2),
    ]);
    const foam = layout.nodes.find((n) => n.code === 'FOAM')!;
    const paint = layout.nodes.find((n) => n.code === 'PAINTING')!;
    expect(foam.level).toBe(paint.level);
    expect(foam.lane).not.toBe(paint.lane);
    expect(layout.maxLanes).toBe(2);
  });

  it('places a merge one level after both parents', () => {
    const layout = layoutStageGraph([
      stage('CARPENTRY', [], 0),
      stage('FOAM', ['CARPENTRY'], 1),
      stage('PAINTING', ['CARPENTRY'], 2),
      stage('UPHOLSTERY', ['FOAM', 'PAINTING'], 3),
    ]);
    const uph = layout.nodes.find((n) => n.code === 'UPHOLSTERY')!;
    const foam = layout.nodes.find((n) => n.code === 'FOAM')!;
    expect(uph.level).toBe(foam.level + 1);
    const edges = displayStageEdges(layout);
    expect(edges).toEqual(
      expect.arrayContaining([
        { from: 'CARPENTRY', to: 'FOAM' },
        { from: 'CARPENTRY', to: 'PAINTING' },
        { from: 'FOAM', to: 'UPHOLSTERY' },
        { from: 'PAINTING', to: 'UPHOLSTERY' },
      ]),
    );
  });

  it('is deterministic for a 15-node graph', () => {
    const stages = Array.from({ length: 15 }, (_, i) =>
      stage(`S${i}`, i === 0 ? [] : [`S${i - 1}`], i),
    );
    const a = layoutStageGraph(stages);
    const b = layoutStageGraph(stages);
    expect(a.nodes.map((n) => `${n.code}:${n.level}:${n.lane}`)).toEqual(
      b.nodes.map((n) => `${n.code}:${n.level}:${n.lane}`),
    );
    expect(a.levelCount).toBe(15);
  });
});
