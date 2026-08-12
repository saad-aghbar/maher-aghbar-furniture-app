import {
  areParentsReady,
  buildDependencyGraph,
  detectCycles,
  mergeWaitInstant,
  topologicalLayers,
} from '../dependency-graph';

describe('dependency-graph', () => {
  const linear = [
    { code: 'PREP', dependsOnCodes: [] },
    { code: 'CUT', dependsOnCodes: ['PREP'] },
    { code: 'ASSEMBLY', dependsOnCodes: ['CUT'] },
  ];

  const parallelMerge = [
    { code: 'PREP', dependsOnCodes: [] },
    { code: 'CUT', dependsOnCodes: ['PREP'] },
    { code: 'FOAM', dependsOnCodes: ['PREP'] },
    { code: 'UPHOLSTERY', dependsOnCodes: ['CUT', 'FOAM'] },
  ];

  it('builds parents and dependents', () => {
    const g = buildDependencyGraph(parallelMerge);
    expect(g.parents.get('UPHOLSTERY')).toEqual(['CUT', 'FOAM']);
    expect(g.dependents.get('PREP')!.sort()).toEqual(['CUT', 'FOAM']);
  });

  it('detects cycles', () => {
    const g = buildDependencyGraph([
      { code: 'A', dependsOnCodes: ['C'] },
      { code: 'B', dependsOnCodes: ['A'] },
      { code: 'C', dependsOnCodes: ['B'] },
    ]);
    const cycle = detectCycles(g);
    expect(cycle.length).toBeGreaterThan(0);
    expect(new Set(cycle)).toEqual(new Set(['A', 'B', 'C']));
  });

  it('returns empty cycle for DAG', () => {
    expect(detectCycles(buildDependencyGraph(linear))).toEqual([]);
  });

  it('layers parallel branches then merge', () => {
    const layers = topologicalLayers(buildDependencyGraph(parallelMerge));
    expect(layers[0]).toEqual(['PREP']);
    expect(layers[1]!.sort()).toEqual(['CUT', 'FOAM']);
    expect(layers[2]).toEqual(['UPHOLSTERY']);
  });

  it('areParentsReady waits for all parents', () => {
    const g = buildDependencyGraph(parallelMerge);
    expect(areParentsReady('UPHOLSTERY', ['CUT'], g)).toBe(false);
    expect(areParentsReady('UPHOLSTERY', ['CUT', 'FOAM'], g)).toBe(true);
  });

  it('mergeWaitInstant uses max parent end', () => {
    const g = buildDependencyGraph(parallelMerge);
    const ends = new Map<string, Date>([
      ['CUT', new Date('2026-08-11T10:00:00.000Z')],
      ['FOAM', new Date('2026-08-11T12:00:00.000Z')],
    ]);
    expect(mergeWaitInstant('UPHOLSTERY', ends, g)?.toISOString()).toBe(
      '2026-08-11T12:00:00.000Z',
    );
  });

  it('throws on cycle during layering', () => {
    const g = buildDependencyGraph([
      { code: 'A', dependsOnCodes: ['B'] },
      { code: 'B', dependsOnCodes: ['A'] },
    ]);
    expect(() => topologicalLayers(g)).toThrow(/cycle/i);
  });
});
