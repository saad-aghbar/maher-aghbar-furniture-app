import { readFileSync } from 'fs';
import { join } from 'path';
import {
  inventoryItemListQueryForCaller,
  warehouseListTypeForCaller,
} from './inventory-list-scope';

describe('inventoryItemListQueryForCaller', () => {
  it('leaves warehouse readers unconstrained', () => {
    expect(
      inventoryItemListQueryForCaller(
        { itemClass: 'FINISHED_GOOD', categoryGroup: 'wood' },
        ['inventory.read'],
      ),
    ).toEqual({ itemClass: 'FINISHED_GOOD', categoryGroup: 'wood' });
  });

  it('limits material-usage pickers to raw stock', () => {
    expect(
      inventoryItemListQueryForCaller(
        { categoryGroup: 'fabric', itemClass: 'FINISHED_GOOD' },
        ['production.material-usage.record'],
      ),
    ).toEqual({ categoryGroup: 'fabric', itemClass: 'RAW_MATERIAL' });
  });

  it('limits floor warehouse lists to RAW stock', () => {
    expect(warehouseListTypeForCaller(undefined, ['production.material-usage.record'])).toBe(
      'RAW_MATERIALS',
    );
    expect(warehouseListTypeForCaller('FINISHED_GOODS', ['inventory.read'])).toBe(
      'FINISHED_GOODS',
    );
  });

  it('GET /inventory/warehouses allows floor material-usage without warehouse desk read', () => {
    const src = readFileSync(join(__dirname, 'inventory.controller.ts'), 'utf8');
    const start = src.indexOf("@Get('warehouses')");
    const block = src.slice(start, src.indexOf("@Get('low-stock')"));
    expect(block).toContain('production.material-usage.record');
    expect(block).toContain('warehouseListTypeForCaller');
  });

  it('GET /inventory/items allows floor material-usage without warehouse desk read', () => {
    const src = readFileSync(join(__dirname, 'inventory.controller.ts'), 'utf8');
    const start = src.indexOf("@Get('items')");
    const block = src.slice(start, src.indexOf('@Post(\'items\')'));
    expect(block).toContain(
      "RequireAnyPermissions('inventory.read', 'production.material-usage.record')",
    );
    expect(block).toContain('inventoryItemListQueryForCaller');
  });
});
