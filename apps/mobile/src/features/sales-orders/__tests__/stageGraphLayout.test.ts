import { displayStageEdges, layoutStageGraph } from '../stageGraphLayout';
import type { OrderStageView } from '../selectOrderDetail';

const stages: OrderStageView[] = [
  {
    code: 'MATERIAL_PREP',
    name: 'Material preparation',
    status: 'COMPLETED',
    progressPercent: 100,
    dependsOnCodes: [],
    sortOrder: 1,
  },
  {
    code: 'CARPENTRY',
    name: 'Carpentry',
    status: 'COMPLETED',
    progressPercent: 100,
    dependsOnCodes: ['MATERIAL_PREP'],
    sortOrder: 2,
  },
  {
    code: 'PAINTING',
    name: 'Painting',
    status: 'IN_PROGRESS',
    progressPercent: 40,
    dependsOnCodes: ['MATERIAL_PREP'],
    sortOrder: 3,
  },
  {
    code: 'UPHOLSTERY',
    name: 'Upholstery',
    status: 'PENDING',
    progressPercent: 0,
    dependsOnCodes: ['CARPENTRY'],
    sortOrder: 4,
  },
  {
    code: 'ASSEMBLY',
    name: 'Assembly',
    status: 'PENDING',
    progressPercent: 0,
    dependsOnCodes: ['CARPENTRY', 'PAINTING', 'UPHOLSTERY'],
    sortOrder: 5,
  },
];

describe('layoutStageGraph', () => {
  it('places roots at level 0 and builds parallel branches', () => {
    const layout = layoutStageGraph(stages);
    const byCode = Object.fromEntries(layout.nodes.map((n) => [n.code, n]));

    expect(byCode.MATERIAL_PREP?.level).toBe(0);
    expect(byCode.CARPENTRY?.level).toBe(1);
    expect(byCode.PAINTING?.level).toBe(1);
    expect(byCode.UPHOLSTERY?.level).toBe(2);
    expect(byCode.ASSEMBLY?.level).toBe(3);
    expect(layout.edges).toEqual(
      expect.arrayContaining([
        { from: 'MATERIAL_PREP', to: 'CARPENTRY' },
        { from: 'MATERIAL_PREP', to: 'PAINTING' },
        { from: 'CARPENTRY', to: 'ASSEMBLY' },
      ]),
    );
  });

  it('returns empty layout for no stages', () => {
    expect(layoutStageGraph([])).toEqual({
      nodes: [],
      edges: [],
      levelCount: 0,
      maxLanes: 0,
    });
  });

  it('lays out a denser parallel 12-stage fixture', () => {
    const dense: OrderStageView[] = [
      { code: 'S0', name: 'Prep', status: 'COMPLETED', progressPercent: 100, dependsOnCodes: [], sortOrder: 0 },
      { code: 'S1a', name: 'Cut A', status: 'COMPLETED', progressPercent: 100, dependsOnCodes: ['S0'], sortOrder: 1 },
      { code: 'S1b', name: 'Cut B', status: 'COMPLETED', progressPercent: 100, dependsOnCodes: ['S0'], sortOrder: 2 },
      { code: 'S1c', name: 'Cut C', status: 'IN_PROGRESS', progressPercent: 50, dependsOnCodes: ['S0'], sortOrder: 3 },
      { code: 'S2a', name: 'Paint', status: 'PENDING', progressPercent: 0, dependsOnCodes: ['S1a'], sortOrder: 4 },
      { code: 'S2b', name: 'Stain', status: 'PENDING', progressPercent: 0, dependsOnCodes: ['S1b'], sortOrder: 5 },
      { code: 'S2c', name: 'Foam', status: 'PENDING', progressPercent: 0, dependsOnCodes: ['S1c'], sortOrder: 6 },
      { code: 'S3a', name: 'Upholstery', status: 'PENDING', progressPercent: 0, dependsOnCodes: ['S2a', 'S2c'], sortOrder: 7 },
      { code: 'S3b', name: 'Hardware', status: 'PENDING', progressPercent: 0, dependsOnCodes: ['S2b'], sortOrder: 8 },
      { code: 'S4', name: 'Assembly', status: 'PENDING', progressPercent: 0, dependsOnCodes: ['S3a', 'S3b'], sortOrder: 9 },
      { code: 'S5', name: 'QC', status: 'PENDING', progressPercent: 0, dependsOnCodes: ['S4'], sortOrder: 10 },
      { code: 'S6', name: 'Pack', status: 'PENDING', progressPercent: 0, dependsOnCodes: ['S5'], sortOrder: 11 },
    ];
    const layout = layoutStageGraph(dense);
    expect(layout.nodes).toHaveLength(12);
    expect(layout.maxLanes).toBeGreaterThanOrEqual(3);
    const byCode = Object.fromEntries(layout.nodes.map((n) => [n.code, n]));
    expect(byCode.S0?.level).toBe(0);
    expect(byCode.S1a?.level).toBe(1);
    expect(byCode.S1b?.level).toBe(1);
    expect(byCode.S1c?.level).toBe(1);
    expect(byCode.S4?.level).toBeGreaterThan(byCode.S3a!.level);
    expect(byCode.S6?.level).toBeGreaterThan(byCode.S5!.level);
  });

  it('display edges stay adjacent without fake fan-out spaghetti', () => {
    const layout = layoutStageGraph(stages);
    const shown = displayStageEdges(layout);
    expect(shown).toEqual(
      expect.arrayContaining([
        { from: 'MATERIAL_PREP', to: 'CARPENTRY' },
        { from: 'MATERIAL_PREP', to: 'PAINTING' },
        { from: 'CARPENTRY', to: 'UPHOLSTERY' },
        { from: 'UPHOLSTERY', to: 'ASSEMBLY' },
      ]),
    );
    // No direct skip over UPHOLSTERY in the drawn adjacent set
    expect(shown.find((e) => e.from === 'CARPENTRY' && e.to === 'ASSEMBLY')).toBeUndefined();
    // Fan-out fill-in removed: painting does not falsely depend-link to every next node
    // (may still bridge via UPHOLSTERY when ASSEMBLY needs PAINTING)
    const paintingOut = shown.filter((e) => e.from === 'PAINTING');
    expect(paintingOut.length).toBeLessThanOrEqual(1);
  });

  it('orders parallel lanes near their parents', () => {
    const layout = layoutStageGraph(stages);
    const byCode = Object.fromEntries(layout.nodes.map((n) => [n.code, n]));
    // Carpentry feeds Upholstery — they should sit on nearby lanes when possible
    expect(Math.abs((byCode.CARPENTRY?.lane ?? 0) - (byCode.UPHOLSTERY?.lane ?? 0))).toBeLessThanOrEqual(1);
  });
});
