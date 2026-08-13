import {
  buildMaterialCostMap,
  productionUnitCost,
  resolveBomLineUnitCost,
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
