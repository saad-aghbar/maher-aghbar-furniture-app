import {
  preferWarehouseForReceive,
  preferredWarehouseTypeForCategory,
  sortWarehousesForReceive,
} from '../preferWarehouseForReceive';
import type { Warehouse } from '../api';

const warehouses: Warehouse[] = [
  { id: 'fin', code: 'FIN', nameEn: 'Finished Goods', nameAr: 'نهائي', type: 'FINISHED' },
  { id: 'raw', code: 'RAW', nameEn: 'Raw Materials', nameAr: 'خامات', type: 'RAW' },
  { id: 'semi', code: 'SEMI', nameEn: 'Semi-Finished', nameAr: 'نصف', type: 'SEMI' },
];

describe('preferredWarehouseTypeForCategory', () => {
  it('maps materials to RAW', () => {
    expect(preferredWarehouseTypeForCategory('FABRIC')).toBe('RAW');
    expect(preferredWarehouseTypeForCategory('FOAM')).toBe('RAW');
    expect(preferredWarehouseTypeForCategory('WOOD')).toBe('RAW');
    expect(preferredWarehouseTypeForCategory('OTHER')).toBe('RAW');
  });

  it('maps finished / semi categories', () => {
    expect(preferredWarehouseTypeForCategory('FINISHED')).toBe('FINISHED');
    expect(preferredWarehouseTypeForCategory('SEMI_FINISHED')).toBe('SEMI');
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

  it('uses balance warehouse when no type/code match exists', () => {
    const onlyFin: Warehouse[] = [
      { id: 'fin', code: 'X1', nameEn: 'Other', nameAr: 'أخرى', type: 'OTHER' },
    ];
    expect(
      preferWarehouseForReceive(onlyFin, {
        category: 'FABRIC',
        balanceWarehouseIds: ['fin'],
      }),
    ).toBe('fin');
  });
});

describe('sortWarehousesForReceive', () => {
  it('moves preferred warehouse to the front', () => {
    const sorted = sortWarehousesForReceive(warehouses, 'raw');
    expect(sorted.map((w) => w.id)).toEqual(['raw', 'fin', 'semi']);
  });
});
