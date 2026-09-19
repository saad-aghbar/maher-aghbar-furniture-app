import { describe, expect, it } from 'vitest';
import {
  defaultBinId,
  warehouseTypeForItemClass,
  warehousesForItem,
} from './inventory-warehouse';

const warehouses = [
  {
    id: 'raw',
    code: 'RAW',
    type: 'RAW_MATERIALS',
    locations: [
      { id: 'a', code: 'A', isActive: true },
      { id: 'b', code: 'B', isDefault: true, isActive: true },
    ],
  },
  { id: 'fin', code: 'FIN', type: 'FINISHED_GOODS' },
];

describe('inventory warehouse helpers', () => {
  it('maps item class to lifecycle warehouse type', () => {
    expect(warehouseTypeForItemClass('FINISHED_GOOD')).toBe('FINISHED_GOODS');
    expect(warehouseTypeForItemClass(null, 'WOOD')).toBe('RAW_MATERIALS');
  });

  it('filters warehouses for a finished item', () => {
    expect(warehousesForItem(warehouses, { itemClass: 'FINISHED_GOOD' }).map((w) => w.id)).toEqual([
      'fin',
    ]);
  });

  it('prefers the default bin', () => {
    expect(defaultBinId(warehouses, 'raw')).toBe('b');
    expect(defaultBinId(warehouses, 'raw', 'a')).toBe('a');
  });
});
