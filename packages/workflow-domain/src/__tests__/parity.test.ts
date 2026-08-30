import {
  edgePairs,
  fromRawGraph,
  simulateWorkflowMutation,
  type PlacementIntent,
} from '@maher/workflow-domain';

/**
 * Mobile/web parity: same placement intent → identical canonical edge pairs.
 */
describe('mobile/web same semantics', () => {
  const nodes = [
    { id: 'prep', code: 'MATERIAL_PREP', sortOrder: 0 },
    { id: 'carp', code: 'CARPENTRY', sortOrder: 1 },
    { id: 'foam', code: 'FOAM', sortOrder: 2 },
    { id: 'insp', code: 'INSPECTION', sortOrder: 90 },
    { id: 'pack', code: 'PACKAGING', sortOrder: 91 },
    { id: 'del', code: 'DELIVERY', sortOrder: 92 },
  ];
  const edges = [
    { from: 'prep', to: 'carp' },
    { from: 'carp', to: 'foam' },
    { from: 'foam', to: 'insp' },
    { from: 'insp', to: 'pack' },
    { from: 'pack', to: 'del' },
  ];

  const intents: PlacementIntent[] = [
    { kind: 'START' },
    { kind: 'AFTER', predecessorIds: ['carp'] },
    { kind: 'AFTER', predecessorIds: ['carp', 'foam'] },
    { kind: 'PARALLEL', referenceNodeIds: ['foam'] },
  ];

  for (const intent of intents) {
    it(`ADD ${intent.kind} identical edge set`, () => {
      const g = fromRawGraph(nodes, edges);
      const a = simulateWorkflowMutation(g, {
        kind: 'ADD',
        nodeId: 'x',
        code: 'X',
        placement: intent,
      });
      const b = simulateWorkflowMutation(g, {
        kind: 'ADD',
        nodeId: 'x',
        code: 'X',
        placement: intent,
      });
      expect(edgePairs(a.edges)).toEqual(edgePairs(b.edges));
    });
  }
});
