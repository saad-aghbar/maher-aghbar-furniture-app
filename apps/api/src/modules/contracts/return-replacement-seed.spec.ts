jest.mock('../production/ensure-fabric-procurements', () => ({
  ensureFabricProcurementsForProductionOrder: jest.fn(async () => 1),
}));

import {
  seedReplacementProductionOrder,
  specSnapshotFromLine,
  specificationsFromSnapshot,
} from './return-replacement-seed';

describe('return replacement seed', () => {
  it('copies the original line manufacturing baseline', () => {
    const snapshot = specSnapshotFromLine({
      productId: 'prod-1',
      variantId: 'var-250',
      variantSku: 'KAR-250',
      variantLabel: 'Ukrainian 250',
      description: 'Model 204 Chair',
      specifications: 'Walnut · Velvet 302',
      orderSpec: { width: 75, fabric: 'Velvet 302 Sand', orientation: 'LEFT' },
      manufacturingComplexity: 'MODIFIED',
      productionSetup: {
        workflowId: 'wf-1',
        factoryNotes: 'Special 75 cm width',
        orderDimensions: { width: 75 },
        materialRequirements: [
          {
            inventoryItemId: 'item-1',
            sku: 'VEL-302',
            displayName: 'Velvet 302',
            category: 'FABRIC',
            expectedQty: 4,
            unit: 'm',
            requestedFabricLabel: 'Velvet 302 Sand',
            fabricRole: 'MAIN',
          },
        ],
      },
    });
    expect(snapshot.productId).toBe('prod-1');
    expect(snapshot.variantId).toBe('var-250');
    expect(snapshot.variantLabel).toBe('Ukrainian 250');
    expect((snapshot.orderSpec as { width: number; orientation?: string }).width).toBe(75);
    expect((snapshot.orderSpec as { orientation?: string }).orientation).toBe('LEFT');
    expect(snapshot.workflowId).toBe('wf-1');
    expect(snapshot.materials).toHaveLength(1);
    expect(snapshot.materials?.[0]?.sku).toBe('VEL-302');
    expect(specificationsFromSnapshot(snapshot)).toBe('Walnut · Velvet 302');
  });

  it('seeds material requirements so repair orders are not empty-BOM', async () => {
    const created: unknown[] = [];
    const db = {
      salesOrderLineMaterialRequirement: {
        create: jest.fn(async ({ data }: { data: unknown }) => {
          created.push(data);
          return data;
        }),
      },
    };
    const snapshot = specSnapshotFromLine({
      description: 'Repair chair',
      productionSetup: {
        materialRequirements: [
          { inventoryItemId: 'foam-1', displayName: 'Foam', expectedQty: 2, unit: 'pcs' },
        ],
      },
    });
    await seedReplacementProductionOrder(db as never, 'po-rw', snapshot);
    expect(created).toHaveLength(1);
    expect(created[0]).toEqual(expect.objectContaining({ productionOrderId: 'po-rw', displayName: 'Foam' }));
  });

  it('falls back to orderSpec JSON when specifications are empty', () => {
    expect(
      specificationsFromSnapshot({
        orderSpec: { width: 75 },
      }),
    ).toBe(JSON.stringify({ width: 75 }));
  });
});
