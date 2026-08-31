import {
  buildMaterialCostMap,
  costBreakdownFromMaterialRows,
  costMaterialLinesFromBomRows,
  productionPriceFromBreakdown,
  productionUnitCost,
  resolveBomLineUnitCost,
  setupBomRowsFromOrder,
} from './order-costing.util';

describe('resolveBomLineUnitCost', () => {
  const costs = new Map([['FAB-001', 12.5]]);

  it('uses a positive explicit BOM unit cost', () => {
    expect(resolveBomLineUnitCost('FAB-001', 9, costs)).toBe(9);
  });

  it('falls back to inventory cost when explicit cost is 0', () => {
    expect(resolveBomLineUnitCost('FAB-001', 0, costs)).toBe(12.5);
  });

  it('falls back to inventory cost when explicit cost is missing', () => {
    expect(resolveBomLineUnitCost('FAB-001', undefined, costs)).toBe(12.5);
  });
});

describe('buildMaterialCostMap', () => {
  it('seeds from inventory standardCost', () => {
    const map = buildMaterialCostMap({
      standardCosts: [{ sku: 'FAB-001', standardCost: '15.000' }],
    });
    expect(map.get('FAB-001')).toBe(15);
  });

  it('lets purchase receipts override standardCost', () => {
    const map = buildMaterialCostMap({
      standardCosts: [{ sku: 'FAB-001', standardCost: 15 }],
      transactions: [
        { sku: 'FAB-001', unitCost: 18, type: 'PURCHASE_RECEIPT' },
        { sku: 'FAB-001', unitCost: 99, type: 'ISSUE' },
      ],
    });
    expect(map.get('FAB-001')).toBe(18);
  });
});

describe('productionUnitCost', () => {
  it('uses inventory unit price when BOM line unitCost is 0', () => {
    const { unitCost, breakdown } = productionUnitCost(
      {
        bomDefaults: {
          materials: [{ sku: 'FAB-001', qty: 2, unitCost: 0, category: 'FABRIC' }],
        },
      },
      new Map([['FAB-001', 10]]),
    );
    expect(unitCost).toBe(20);
    expect(breakdown.fabricCost).toBe(20);
  });
});

describe('costBreakdownFromMaterialRows', () => {
  it('rolls plan BOM into fabric/wood/foam/accessories', () => {
    const breakdown = costBreakdownFromMaterialRows(
      [
        { sku: 'FAB-1', category: 'FABRIC', qty: 2, unitCost: 10 },
        { sku: 'WOOD-1', category: 'WOOD', qty: 1, unitCost: 50 },
        { sku: 'FOAM-1', category: 'FOAM', qty: 3, unitCost: 4 },
        { sku: 'ACC-1', category: 'DECORATIVE_ACCESSORY', qty: 5, unitCost: 2 },
      ],
      new Map(),
    );
    expect(breakdown.fabricCost).toBe(20);
    expect(breakdown.woodCost).toBe(50);
    expect(breakdown.foamCost).toBe(12);
    expect(breakdown.accessoriesCost).toBe(10);
    expect(productionPriceFromBreakdown(breakdown)).toBe(92);
  });
});

describe('setupBomRowsFromOrder', () => {
  it('multiplies expected qty by sales-order line quantity', () => {
    const rows = setupBomRowsFromOrder({
      lines: [{ id: 'line-1', quantity: 2 }],
      setupLines: [
        {
          salesOrderLineId: 'line-1',
          materialRequirements: [
            {
              sku: 'WOOD-1',
              category: 'WOOD',
              expectedQty: 3,
              displayName: 'Oak',
            },
          ],
        },
      ],
    });
    expect(rows).toEqual([
      {
        sku: 'WOOD-1',
        category: 'WOOD',
        qty: 6,
        name: 'Oak',
        inventoryItemId: null,
        unitCost: undefined,
      },
    ]);
  });
});

describe('costMaterialLinesFromBomRows', () => {
  it('builds chosen-material lines with category buckets', () => {
    const lines = costMaterialLinesFromBomRows(
      [
        {
          sku: 'ACC-1',
          category: 'ACCESSORY',
          qty: 37,
          unitCost: 23.081,
          name: 'Hardware kit',
        },
        {
          sku: 'FOAM-1',
          category: 'FOAM',
          qty: 3,
          unitCost: 92,
          name: 'Seat foam',
        },
      ],
      new Map(),
    );
    expect(lines).toHaveLength(2);
    expect(lines.find((l) => l.sku === 'ACC-1')).toMatchObject({
      category: 'accessories',
      qty: 37,
      name: 'Hardware kit',
    });
    expect(lines.find((l) => l.sku === 'FOAM-1')?.category).toBe('foam');
  });
});
