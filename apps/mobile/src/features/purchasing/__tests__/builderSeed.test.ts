import {
  parseBuilderSeedIds,
  seedBuilderLines,
  suggestedBuilderQty,
  toBuilderMaterial,
} from '../orderBuilder';

describe('builder seed helpers', () => {
  it('parses itemId and itemIds, splits commas, and dedupes', () => {
    expect(parseBuilderSeedIds({ itemIds: 'a,b, a', itemId: 'c' })).toEqual(['a', 'b', 'c']);
    expect(parseBuilderSeedIds({ itemId: ['oak', 'foam'] })).toEqual(['oak', 'foam']);
    expect(parseBuilderSeedIds({})).toEqual([]);
  });

  it('maps inventory items to builder materials in the active locale', () => {
    const material = toBuilderMaterial(
      {
        id: 'oak',
        sku: 'OAK',
        nameEn: 'Oak',
        nameAr: 'بلوط',
        unit: 'pcs',
        category: 'WOOD',
        onHandQty: 2,
        minStock: 8,
        standardCost: 12,
        preferredSupplierId: 's1',
        reorderQty: 20,
      },
      'ar',
    );
    expect(material.name).toBe('بلوط');
    expect(material.onHandQty).toBe(2);
    expect(material.reorderQty).toBe(20);
    expect(material.preferredSupplierId).toBe('s1');
  });

  it('prefers reorder qty and otherwise covers the shortfall', () => {
    expect(suggestedBuilderQty({ reorderQty: 40, minStock: 8, onHandQty: 2 })).toBe('40');
    expect(suggestedBuilderQty({ minStock: 8, onHandQty: 2 })).toBe('6');
    expect(suggestedBuilderQty({ minStock: 2, onHandQty: 8 })).toBe('1');
  });

  it('seeds missing lines with warehouse, supplier, and suggested qty', () => {
    const oak = toBuilderMaterial(
      {
        id: 'oak',
        sku: 'OAK',
        nameEn: 'Oak',
        unit: 'pcs',
        category: 'WOOD',
        minStock: 8,
        onHandQty: 2,
        preferredSupplierId: 's1',
        standardCost: 10,
      },
      'en',
    );
    const seeded = seedBuilderLines({}, [oak], {
      defaultWarehouseId: 'wh-1',
      defaultWarehouseName: 'Raw',
      supplierNameById: { s1: 'Mill' },
    });
    expect(seeded.oak?.quantity).toBe('6');
    expect(seeded.oak?.warehouseId).toBe('wh-1');
    expect(seeded.oak?.supplierId).toBe('s1');
    expect(seeded.oak?.supplierName).toBe('Mill');
    expect(seedBuilderLines(seeded, [oak], {
      defaultWarehouseId: 'wh-2',
      supplierNameById: { s1: 'Mill' },
    })).toBe(seeded);
  });
});
