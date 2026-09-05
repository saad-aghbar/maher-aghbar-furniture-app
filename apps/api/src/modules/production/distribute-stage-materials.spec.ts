import { distributeMaterialsToSnapshotNodes } from './distribute-stage-materials';

const carpentry = {
  id: 'snap-carp',
  stageCode: 'CARPENTRY',
  sourceWorkflowNodeId: 'wn-carp',
  stageDefinitionId: 'sd-carp',
  consumesRawMaterials: true,
  sortOrder: 1,
};
const foam = {
  id: 'snap-foam',
  stageCode: 'FOAM',
  sourceWorkflowNodeId: 'wn-foam',
  stageDefinitionId: 'sd-foam',
  consumesRawMaterials: true,
  sortOrder: 2,
};
const upholstery = {
  id: 'snap-uph',
  stageCode: 'UPHOLSTERY',
  sourceWorkflowNodeId: 'wn-uph',
  stageDefinitionId: 'sd-uph',
  consumesRawMaterials: true,
  sortOrder: 3,
};
const delivery = {
  id: 'snap-del',
  stageCode: 'DELIVERY',
  sourceWorkflowNodeId: 'wn-del',
  stageDefinitionId: 'sd-del',
  consumesRawMaterials: false,
  sortOrder: 4,
};

const catalog = [
  {
    inventoryItemId: 'inv-wood',
    workflowNodeId: 'wn-carp',
    stageDefinitionId: 'sd-carp',
    qtyPerUnit: 4,
    unit: 'pcs',
  },
  {
    inventoryItemId: 'inv-foam',
    workflowNodeId: 'wn-foam',
    stageDefinitionId: 'sd-foam',
    qtyPerUnit: 2,
    unit: 'pcs',
  },
  {
    inventoryItemId: 'inv-fabric',
    workflowNodeId: 'wn-uph',
    stageDefinitionId: 'sd-uph',
    qtyPerUnit: 24,
    unit: 'm',
  },
];

describe('distributeMaterialsToSnapshotNodes', () => {
  it('places each override on the catalog stage that consumes it', () => {
    const rows = distributeMaterialsToSnapshotNodes(
      [carpentry, foam, upholstery, delivery],
      catalog,
      [
        { inventoryItemId: 'inv-wood', sku: 'WOOD-1', qtyPerUnit: 4, unit: 'pcs' },
        { inventoryItemId: 'inv-foam', sku: 'FOAM-1', qtyPerUnit: 2, unit: 'pcs' },
        { inventoryItemId: 'inv-fabric', sku: 'FAB-VEL', qtyPerUnit: 24, unit: 'm' },
      ],
    );
    expect(rows.map((r) => ({ stage: r.stageCode, sku: r.sku, qty: r.qtyPerUnit }))).toEqual([
      { stage: 'CARPENTRY', sku: 'WOOD-1', qty: 4 },
      { stage: 'FOAM', sku: 'FOAM-1', qty: 2 },
      { stage: 'UPHOLSTERY', sku: 'FAB-VEL', qty: 24 },
    ]);
  });

  it('does not dump every material onto the first raw-consuming node', () => {
    const rows = distributeMaterialsToSnapshotNodes(
      [carpentry, foam, upholstery],
      catalog,
      [
        { inventoryItemId: 'inv-wood', sku: 'WOOD-1', qtyPerUnit: 4 },
        { inventoryItemId: 'inv-fabric', sku: 'FAB-VEL', qtyPerUnit: 24, unit: 'm' },
      ],
    );
    const byNode = new Map(rows.map((r) => [r.snapshotNodeId, r.sku]));
    expect(byNode.get('snap-carp')).toBe('WOOD-1');
    expect(byNode.get('snap-uph')).toBe('FAB-VEL');
    expect(byNode.has('snap-foam')).toBe(false);
  });

  it('splits a shared SKU across stages by catalog ratio when qty is overridden', () => {
    const rows = distributeMaterialsToSnapshotNodes(
      [carpentry, foam],
      [
        {
          inventoryItemId: 'inv-glue',
          workflowNodeId: 'wn-carp',
          qtyPerUnit: 1,
          unit: 'L',
        },
        {
          inventoryItemId: 'inv-glue',
          workflowNodeId: 'wn-foam',
          qtyPerUnit: 3,
          unit: 'L',
        },
      ],
      [{ inventoryItemId: 'inv-glue', sku: 'GLUE-1', qtyPerUnit: 8, unit: 'L' }],
    );
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.stageCode === 'CARPENTRY')?.qtyPerUnit).toBe(2);
    expect(rows.find((r) => r.stageCode === 'FOAM')?.qtyPerUnit).toBe(6);
  });

  it('puts factory-added items with no catalog map on the first raw-consuming node', () => {
    const rows = distributeMaterialsToSnapshotNodes(
      [delivery, carpentry, upholstery],
      catalog,
      [{ inventoryItemId: 'inv-extra', sku: 'ACC-1', qtyPerUnit: 3, unit: 'pcs' }],
    );
    expect(rows).toEqual([
      expect.objectContaining({
        snapshotNodeId: 'snap-carp',
        stageCode: 'CARPENTRY',
        sku: 'ACC-1',
        qtyPerUnit: 3,
      }),
    ]);
  });

  it('returns empty when there are no overrides or no nodes', () => {
    expect(distributeMaterialsToSnapshotNodes([], catalog, [])).toEqual([]);
    expect(
      distributeMaterialsToSnapshotNodes([carpentry], catalog, []),
    ).toEqual([]);
  });
});
