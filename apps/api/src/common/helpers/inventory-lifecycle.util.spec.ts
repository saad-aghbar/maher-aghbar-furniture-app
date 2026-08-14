import {
  classifyInventoryCategory,
  itemClassCompatibleWithWarehouse,
  mapLegacyWarehouseType,
  skuPrefixForItemClass,
  warehouseTypeForItemClass,
  type InventoryItemClassValue,
  type WarehouseTypeValue,
} from './inventory-lifecycle.util';

describe('inventory-lifecycle.util', () => {
  it('maps legacy warehouse types', () => {
    expect(mapLegacyWarehouseType('RAW').type).toBe('RAW_MATERIALS');
    expect(mapLegacyWarehouseType('SEMI').type).toBe('SEMI_FINISHED');
    expect(mapLegacyWarehouseType('FINISHED').type).toBe('FINISHED_GOODS');
    expect(mapLegacyWarehouseType('FIN', 'FIN').type).toBe('FINISHED_GOODS');
    expect(mapLegacyWarehouseType('mystery').reviewRequired).toBe(true);
  });

  it('classifies categories without guessing OTHER', () => {
    expect(classifyInventoryCategory('WOOD')).toMatchObject({
      itemClass: 'RAW_MATERIAL',
      materialGroup: 'WOOD',
    });
    expect(classifyInventoryCategory('PAINT')).toMatchObject({
      itemClass: 'RAW_MATERIAL',
      materialGroup: 'ACCESSORIES',
    });
    expect(classifyInventoryCategory('SEMI_FINISHED').itemClass).toBe('SEMI_FINISHED_GOOD');
    expect(classifyInventoryCategory('FINISHED').isPurchasable).toBe(false);
    expect(classifyInventoryCategory('OTHER').reviewRequired).toBe(true);
  });

  it('enforces warehouse compatibility for every lifecycle mapping', () => {
    const valid: Array<[InventoryItemClassValue, WarehouseTypeValue]> = [
      ['RAW_MATERIAL', 'RAW_MATERIALS'],
      ['SEMI_FINISHED_GOOD', 'SEMI_FINISHED'],
      ['FINISHED_GOOD', 'FINISHED_GOODS'],
    ];
    for (const [itemClass, warehouseType] of valid) {
      expect(itemClassCompatibleWithWarehouse(itemClass, warehouseType)).toBe(true);
      expect(warehouseTypeForItemClass(itemClass)).toBe(warehouseType);
    }

    const invalid: Array<[InventoryItemClassValue, WarehouseTypeValue]> = [
      ['RAW_MATERIAL', 'SEMI_FINISHED'],
      ['RAW_MATERIAL', 'FINISHED_GOODS'],
      ['SEMI_FINISHED_GOOD', 'RAW_MATERIALS'],
      ['SEMI_FINISHED_GOOD', 'FINISHED_GOODS'],
      ['FINISHED_GOOD', 'RAW_MATERIALS'],
      ['FINISHED_GOOD', 'SEMI_FINISHED'],
    ];
    for (const [itemClass, warehouseType] of invalid) {
      expect(itemClassCompatibleWithWarehouse(itemClass, warehouseType)).toBe(false);
    }
  });

  it('uses lifecycle SKU prefixes', () => {
    expect(skuPrefixForItemClass('SEMI_FINISHED_GOOD')).toBe('WIP');
    expect(skuPrefixForItemClass('FINISHED_GOOD')).toBe('FG');
    expect(skuPrefixForItemClass('RAW_MATERIAL', 'FABRIC')).toBe('FAB');
  });
});
