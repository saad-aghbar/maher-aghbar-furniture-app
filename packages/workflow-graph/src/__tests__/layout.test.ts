import { displayWorkflowGraphEdges, layoutWorkflowGraph } from '../index';

const stages = [
  {
    code: 'MATERIAL_PREP',
    sortOrder: 1,
    dependsOnCodes: [] as string[],
  },
  {
    code: 'CARPENTRY',
    sortOrder: 2,
    dependsOnCodes: ['MATERIAL_PREP'],
  },
  {
    code: 'PAINTING',
    sortOrder: 3,
    dependsOnCodes: ['MATERIAL_PREP'],
  },
  {
    code: 'UPHOLSTERY',
    sortOrder: 4,
    dependsOnCodes: ['CARPENTRY'],
  },
  {
    code: 'ASSEMBLY',
    sortOrder: 5,
    dependsOnCodes: ['CARPENTRY', 'PAINTING', 'UPHOLSTERY'],
  },
];

describe('layoutWorkflowGraph', () => {
  it('places roots at level 0 and builds parallel branches', () => {
    const layout = layoutWorkflowGraph(stages);
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
        { from: 'CARPENTRY', to: 'UPHOLSTERY' },
        { from: 'CARPENTRY', to: 'ASSEMBLY' },
      ]),
    );
  });

  it('returns empty layout for no stages', () => {
    expect(layoutWorkflowGraph([])).toEqual({
      nodes: [],
      edges: [],
      levelCount: 0,
      maxLanes: 0,
    });
  });

  it('supports dependsOnKeys alias', () => {
    const keyed = [
      { id: 'prep', code: 'PREP', sortOrder: 0, dependsOnKeys: [] as string[] },
      { id: 'cut', code: 'CUT', sortOrder: 1, dependsOnKeys: ['prep'] },
      { id: 'foam', code: 'FOAM', sortOrder: 2, dependsOnKeys: ['cut'] },
    ];
    const layout = layoutWorkflowGraph(keyed);
    expect(layout.edges).toEqual([
      { from: 'prep', to: 'cut' },
      { from: 'cut', to: 'foam' },
    ]);
  });

  it('display edges stay adjacent and fill barrel merges', () => {
    const layout = layoutWorkflowGraph(stages);
    const shown = displayWorkflowGraphEdges(layout);
    expect(shown).toEqual(
      expect.arrayContaining([
        { from: 'MATERIAL_PREP', to: 'CARPENTRY' },
        { from: 'MATERIAL_PREP', to: 'PAINTING' },
        { from: 'CARPENTRY', to: 'UPHOLSTERY' },
        { from: 'PAINTING', to: 'UPHOLSTERY' },
        { from: 'UPHOLSTERY', to: 'ASSEMBLY' },
      ]),
    );
    expect(shown.find((e) => e.from === 'CARPENTRY' && e.to === 'ASSEMBLY')).toBeUndefined();
    expect(shown.find((e) => e.from === 'PAINTING' && e.to === 'ASSEMBLY')).toBeUndefined();
  });
});
