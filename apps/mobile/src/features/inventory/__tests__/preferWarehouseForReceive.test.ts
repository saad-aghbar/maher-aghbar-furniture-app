import {
  itemClassForLifecycle,
  preferWarehouseForReceive,
  preferredWarehouseTypeForCategory,
  sortWarehousesForReceive,
  warehouseTypeForItemClass,
  warehouseTypeForLifecycle,
  warehousesCompatibleWithItem,
  warehousesForLifecycle,
} from '../preferWarehouseForReceive';
import type { Warehouse } from '../api';

const warehouses: Warehouse[] = [
  { id: 'fin', code: 'FIN', nameEn: 'Finished Goods', nameAr: 'نهائي', type: 'FINISHED_GOODS' },
  { id: 'raw', code: 'RAW', nameEn: 'Raw Materials', nameAr: 'خامات', type: 'RAW_MATERIALS' },
  { id: 'semi', code: 'SEMI', nameEn: 'Semi-Finished', nameAr: 'نصف', type: 'SEMI_FINISHED' },
];

describe('preferredWarehouseTypeForCategory', () => {
  it('maps materials to RAW_MATERIALS', () => {
    expect(preferredWarehouseTypeForCategory('FABRIC')).toBe('RAW_MATERIALS');
    expect(preferredWarehouseTypeForCategory('FOAM')).toBe('RAW_MATERIALS');
    expect(preferredWarehouseTypeForCategory('WOOD')).toBe('RAW_MATERIALS');
    expect(preferredWarehouseTypeForCategory('OTHER')).toBe('RAW_MATERIALS');
  });

  it('maps finished / semi categories', () => {
    expect(preferredWarehouseTypeForCategory('FINISHED')).toBe('FINISHED_GOODS');
    expect(preferredWarehouseTypeForCategory('SEMI_FINISHED')).toBe('SEMI_FINISHED');
  });
});

describe('warehouseTypeForItemClass', () => {
  it('maps each lifecycle class to its warehouse type', () => {
    expect(warehouseTypeForItemClass('RAW_MATERIAL')).toBe('RAW_MATERIALS');
    expect(warehouseTypeForItemClass('SEMI_FINISHED_GOOD')).toBe('SEMI_FINISHED');
    expect(warehouseTypeForItemClass('FINISHED_GOOD')).toBe('FINISHED_GOODS');
  });
});

describe('warehousesCompatibleWithItem', () => {
  const valid: Array<[string, string, string]> = [
    ['RAW_MATERIAL', 'RAW_MATERIALS', 'raw'],
    ['SEMI_FINISHED_GOOD', 'SEMI_FINISHED', 'semi'],
    ['FINISHED_GOOD', 'FINISHED_GOODS', 'fin'],
  ];

  it.each(valid)('%s items list only %s', (itemClass, warehouseType, expectedId) => {
    const visible = warehousesCompatibleWithItem(warehouses, { itemClass });
    expect(visible).toHaveLength(1);
    expect(visible[0]?.id).toBe(expectedId);
    expect(visible[0]?.type).toBe(warehouseType);
  });

  const invalid: Array<[string, string]> = [
    ['RAW_MATERIAL', 'SEMI_FINISHED'],
    ['RAW_MATERIAL', 'FINISHED_GOODS'],
    ['SEMI_FINISHED_GOOD', 'RAW_MATERIALS'],
    ['SEMI_FINISHED_GOOD', 'FINISHED_GOODS'],
    ['FINISHED_GOOD', 'RAW_MATERIALS'],
    ['FINISHED_GOOD', 'SEMI_FINISHED'],
  ];

  it.each(invalid)('%s items never see %s warehouses', (itemClass, hiddenType) => {
    const visible = warehousesCompatibleWithItem(warehouses, { itemClass });
    expect(visible.some((w) => w.type === hiddenType)).toBe(false);
  });
});

describe('preferWarehouseForReceive', () => {
  it('defaults fabric materials to RAW even when FIN is listed first', () => {
    expect(preferWarehouseForReceive(warehouses, { category: 'FABRIC' })).toBe('raw');
  });

  it('defaults finished goods to FIN', () => {
    expect(preferWarehouseForReceive(warehouses, { category: 'FINISHED' })).toBe('fin');
  });

  it('still matches RAW by code when type is omitted', () => {
    const noTypes = warehouses.map(({ type: _t, ...rest }) => rest);
    expect(
      preferWarehouseForReceive(noTypes, {
        category: 'FABRIC',
        balanceWarehouseIds: ['semi'],
      }),
    ).toBe('raw');
  });

  it('does not fall back to an incompatible warehouse', () => {
    const onlyFin: Warehouse[] = [
      { id: 'fin', code: 'X1', nameEn: 'Other', nameAr: 'أخرى', type: 'FINISHED_GOODS' },
    ];
    expect(
      preferWarehouseForReceive(onlyFin, {
        itemClass: 'RAW_MATERIAL',
        category: 'FABRIC',
        balanceWarehouseIds: ['fin'],
      }),
    ).toBe('');
  });
});

describe('sortWarehousesForReceive', () => {
  it('moves preferred warehouse to the front', () => {
    const sorted = sortWarehousesForReceive(warehouses, 'raw');
    expect(sorted.map((w) => w.id)).toEqual(['raw', 'fin', 'semi']);
  });
});

describe('lifecycle warehouse filtering', () => {
  it('maps each inventory tab to its warehouse type and item class', () => {
    expect(warehouseTypeForLifecycle('materials')).toBe('RAW_MATERIALS');
    expect(itemClassForLifecycle('materials')).toBe('RAW_MATERIAL');
    expect(warehouseTypeForLifecycle('semiFinished')).toBe('SEMI_FINISHED');
    expect(itemClassForLifecycle('semiFinished')).toBe('SEMI_FINISHED_GOOD');
    expect(warehouseTypeForLifecycle('finished')).toBe('FINISHED_GOODS');
    expect(itemClassForLifecycle('finished')).toBe('FINISHED_GOOD');
  });

  it('lists only RAW warehouses from Materials', () => {
    expect(warehousesForLifecycle(warehouses, 'materials').map((w) => w.id)).toEqual(['raw']);
  });

  it('lists only SEMI warehouses from Semi-finished', () => {
    expect(warehousesForLifecycle(warehouses, 'semiFinished').map((w) => w.id)).toEqual(['semi']);
  });

  it('lists only FG warehouses from Finished', () => {
    expect(warehousesForLifecycle(warehouses, 'finished').map((w) => w.id)).toEqual(['fin']);
  });
});
