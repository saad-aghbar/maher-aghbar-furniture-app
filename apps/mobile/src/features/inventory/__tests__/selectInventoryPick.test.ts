import type { InventoryItem } from '../api';
import {
  buildInventoryPickQuery,
  filterPickableItems,
  inventoryPickCopyKey,
  isTransferableFromWarehouse,
  selectInventoryPickRow,
  showsRawCategoryRail,
  transferableQty,
  warehouseScopedQty,
} from '../selectInventoryPick';

function item(partial: Partial<InventoryItem> & Pick<InventoryItem, 'id' | 'sku'>): InventoryItem {
  return {
    nameEn: partial.nameEn ?? partial.sku,
    nameAr: partial.nameAr ?? partial.sku,
    category: partial.category ?? 'WOOD',
    unit: partial.unit ?? 'pcs',
    minStock: partial.minStock ?? 0,
    ...partial,
  };
}

describe('showsRawCategoryRail', () => {
  it('is only true for materials', () => {
    expect(showsRawCategoryRail('materials')).toBe(true);
    expect(showsRawCategoryRail('semiFinished')).toBe(false);
    expect(showsRawCategoryRail('finished')).toBe(false);
  });
});

describe('buildInventoryPickQuery', () => {
  it('keeps Fabric/Foam/Wood/Accessories for RAW and scopes to the source warehouse', () => {
    expect(
      buildInventoryPickQuery({
        lifecycle: 'materials',
        warehouseId: 'raw-a',
        categoryGroup: 'wood',
      }),
    ).toEqual({
      page: 1,
      pageSize: 80,
      itemClass: 'RAW_MATERIAL',
      warehouseId: 'raw-a',
      categoryGroup: 'wood',
    });
  });

  it('does not send raw category groups for semi-finished', () => {
    const query = buildInventoryPickQuery({
      lifecycle: 'semiFinished',
      warehouseId: 'semi-a',
      categoryGroup: 'fabric',
    });
    expect(query.itemClass).toBe('SEMI_FINISHED_GOOD');
    expect(query.warehouseId).toBe('semi-a');
    expect(query.categoryGroup).toBeUndefined();
  });

  it('does not send raw category groups for finished goods', () => {
    const query = buildInventoryPickQuery({
      lifecycle: 'finished',
      warehouseId: 'fin-a',
      categoryGroup: 'wood',
    });
    expect(query.itemClass).toBe('FINISHED_GOOD');
    expect(query.warehouseId).toBe('fin-a');
    expect(query.categoryGroup).toBeUndefined();
  });

  it('uses the same lifecycle query for transfer and count callers', () => {
    const transfer = buildInventoryPickQuery({
      lifecycle: 'semiFinished',
      warehouseId: 'semi-a',
    });
    const count = buildInventoryPickQuery({
      lifecycle: 'semiFinished',
      warehouseId: 'semi-a',
    });
    expect(transfer).toEqual(count);
    expect(transfer.itemClass).not.toBe('RAW_MATERIAL');
  });
});

describe('warehouse-scoped transfer eligibility', () => {
  const milano = item({
    id: 'milano-frame',
    sku: 'UAT-SOFA-A-FRAME',
    nameEn: 'Milano Sofa Frame',
    nameAr: 'هيكل كنبة ميلانو',
    itemClass: 'SEMI_FINISHED_GOOD',
    balances: [
      { id: 'b-a', warehouseId: 'semi-a', availableQty: 6, reservedQty: 0, freeQty: 6 },
      { id: 'b-b', warehouseId: 'semi-b', availableQty: 0, reservedQty: 0, freeQty: 0 },
    ],
  });
  const chair = item({
    id: 'chair-frame',
    sku: 'UAT-CHAIR-FRAME',
    nameEn: 'Chair Frame',
    nameAr: 'هيكل كرسي',
    itemClass: 'SEMI_FINISHED_GOOD',
    balances: [
      { id: 'c-a', warehouseId: 'semi-a', availableQty: 0, reservedQty: 0, freeQty: 0 },
      { id: 'c-b', warehouseId: 'semi-b', availableQty: 12, reservedQty: 0, freeQty: 12 },
    ],
  });
  const lumber = item({
    id: 'beech',
    sku: 'UAT-WOOD',
    nameEn: 'UAT beech lumber',
    nameAr: 'خشب اختبار',
    itemClass: 'RAW_MATERIAL',
    category: 'WOOD',
    balances: [
      { id: 'r-a', warehouseId: 'raw-a', availableQty: 80, reservedQty: 0, freeQty: 80 },
    ],
  });

  it('reads qty from the selected warehouse, not the other warehouse', () => {
    expect(warehouseScopedQty(milano, 'semi-a').freeQty).toBe(6);
    expect(warehouseScopedQty(milano, 'semi-b').freeQty).toBe(0);
    expect(warehouseScopedQty(chair, 'semi-a').freeQty).toBe(0);
    expect(warehouseScopedQty(chair, 'semi-b').freeQty).toBe(12);
  });

  it('allows transferring reserved finished goods by on-hand, not free qty', () => {
    const reservedFg = item({
      id: 'fg-1',
      sku: 'FG-1',
      itemClass: 'FINISHED_GOOD',
      balances: [
        {
          id: 'b1',
          warehouseId: 'fin-a',
          availableQty: 3,
          reservedQty: 3,
          freeQty: 0,
          onHandQty: 3,
        },
      ],
    });
    expect(transferableQty(reservedFg, 'fin-a')).toBe(3);
    expect(isTransferableFromWarehouse(reservedFg, 'fin-a')).toBe(true);
    expect(transferableQty(reservedFg, 'fin-b')).toBe(0);
  });

  it('keeps raw materials limited to free qty', () => {
    const reservedRaw = item({
      id: 'raw-1',
      sku: 'RAW-1',
      itemClass: 'RAW_MATERIAL',
      balances: [
        {
          id: 'b1',
          warehouseId: 'raw-a',
          availableQty: 10,
          reservedQty: 8,
          freeQty: 2,
        },
      ],
    });
    expect(transferableQty(reservedRaw, 'raw-a')).toBe(2);
  });

  it('hides zero-availability items from transfer in warehouse A', () => {
    const transferable = filterPickableItems([milano, chair, lumber], {
      warehouseId: 'semi-a',
      mode: 'transfer',
    });
    expect(transferable.map((row) => row.sku)).toEqual(['UAT-SOFA-A-FRAME']);
    expect(isTransferableFromWarehouse(chair, 'semi-a')).toBe(false);
  });

  it('keeps zero-qty items visible for stock count', () => {
    const countable = filterPickableItems([milano, chair], {
      warehouseId: 'semi-a',
      mode: 'count',
    });
    expect(countable.map((row) => row.sku)).toEqual(['UAT-SOFA-A-FRAME', 'UAT-CHAIR-FRAME']);
  });

  it('does not treat a RAW SKU as transferable from a SEMI warehouse', () => {
    expect(isTransferableFromWarehouse(lumber, 'semi-a')).toBe(false);
    expect(filterPickableItems([lumber], { warehouseId: 'semi-a', mode: 'transfer' })).toEqual([]);
  });
});

describe('selectInventoryPickRow', () => {
  it('shows localized name, SKU, unit, and warehouse-scoped qty without raw IDs', () => {
    const row = selectInventoryPickRow(
      item({
        id: 'secret-db-id',
        sku: 'UAT-SOFA-A-FG',
        nameEn: 'Milano Sofa',
        nameAr: 'كنبة ميلانو',
        itemClass: 'FINISHED_GOOD',
        unit: 'pcs',
        product: { id: 'prod-id', sku: 'UAT-SOFA-A', nameEn: 'Milano Sofa A', nameAr: 'كنبة ميلانو أ', imageUrl: 'https://cdn.example/sofa.jpg' },
        balances: [
          { id: 'bal-id', warehouseId: 'fin-a', availableQty: 4, reservedQty: 1, freeQty: 3 },
        ],
      }),
      'fin-a',
      'en',
    );
    expect(row.name).toBe('Milano Sofa');
    expect(row.sku).toBe('UAT-SOFA-A-FG');
    expect(row.unit).toBe('pcs');
    expect(row.freeQty).toBe(3);
    expect(row.displayQty).toBe(4);
    expect(row.imageUrl).toBe('https://cdn.example/sofa.jpg');
    expect(row.productName).toBe('Milano Sofa A');
    expect(row.productName).not.toContain('prod-id');
    expect(row.sku).not.toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe('inventoryPickCopyKey', () => {
  it('does not call WIP or finished goods a material', () => {
    expect(inventoryPickCopyKey('materials').pickItem).toBe('mobile.inventory.pickItem');
    expect(inventoryPickCopyKey('semiFinished').pickItem).toBe('mobile.inventory.pickSemiItem');
    expect(inventoryPickCopyKey('finished').pickItem).toBe('mobile.inventory.pickFinishedItem');
    expect(inventoryPickCopyKey('semiFinished').item).not.toBe('mobile.inventory.item');
    expect(inventoryPickCopyKey('finished').item).not.toBe('mobile.inventory.item');
  });
});
