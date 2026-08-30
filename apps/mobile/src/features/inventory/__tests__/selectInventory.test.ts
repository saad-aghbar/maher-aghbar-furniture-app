import {
  humanizeInventoryEnumLabel,
  inventoryItemLifecycleEyebrow,
  selectInventoryItemCard,
  selectInventoryItemDetail,
  selectInventoryTransaction,
} from '../selectInventory';
import type { InventoryItem, InventoryTransaction } from '../api';
import { inventoryItemUnitCost } from '@/api/modules/inventory';

const baseItem: InventoryItem = {
  id: 'item-1',
  sku: 'FAB-001',
  nameEn: 'Linen Beige',
  nameAr: 'كتان بيج',
  unit: 'm',
  category: 'FABRIC',
  materialType: 'Linen',
  minStock: 10,
  balances: [{ id: 'b1', availableQty: 8, warehouseId: 'wh-1' }],
};

describe('selectInventory cost visibility', () => {
  it('hides cost when API omits standardCost (unauthorized)', () => {
    const card = selectInventoryItemCard(baseItem, 'en');
    expect(card.showCost).toBe(false);
    expect(card.costLabel).toBeNull();

    const detail = selectInventoryItemDetail(baseItem, 'en');
    expect(detail.showCost).toBe(false);
    expect(detail.costLabel).toBeNull();
  });

  it('shows cost when API includes standardCost', () => {
    const withCost: InventoryItem = { ...baseItem, standardCost: 42.5 };
    const card = selectInventoryItemCard(withCost, 'en');
    expect(card.showCost).toBe(true);
    expect(card.costLabel).toBeTruthy();
    expect(card.costLabel).not.toMatch(/undefined|null/i);
    expect(card.costLabel).toMatch(/₪/);
    expect(card.costLabel).toMatch(/42\.50/);
  });

  it('formats zero standardCost as shekel money, not a bare 0', () => {
    const zeroCost: InventoryItem = { ...baseItem, standardCost: 0 };
    const card = selectInventoryItemCard(zeroCost, 'en');
    expect(card.showCost).toBe(true);
    expect(card.standardCost).toBe(0);
    expect(card.costLabel).toMatch(/₪0\.00/);
    expect(card.costLabel).not.toBe('0');
  });

  it('hides accessory photo flags for fabric items', () => {
    const card = selectInventoryItemCard(baseItem, 'en');
    expect(card.isAccessory).toBe(false);
    expect(card.imageUrl).toBeNull();
  });

  it('flags accessories and keeps optional imageUrl', () => {
    const accessory: InventoryItem = {
      ...baseItem,
      id: 'acc-1',
      sku: 'MAT-HW-KIT',
      category: 'METAL_ACCESSORY',
      imageUrl: 'https://example.com/a.jpg',
    };
    const card = selectInventoryItemCard(accessory, 'en');
    expect(card.isAccessory).toBe(true);
    expect(card.imageUrl).toBe('https://example.com/a.jpg');
  });

  it('marks low stock from backend balances vs minStock', () => {
    const card = selectInventoryItemCard(baseItem, 'en');
    expect(card.isLowStock).toBe(true);
    expect(card.stockStatus).toBe('LOW_STOCK');
    expect(card.onHand).toBe(8);
  });

  it('collapses location balances into one row per warehouse', () => {
    const item: InventoryItem = {
      ...baseItem,
      balances: [
        {
          id: 'b1',
          availableQty: 8,
          warehouseId: 'wh-1',
          warehouse: { id: 'wh-1', code: 'MAIN', nameEn: 'Main', nameAr: 'الرئيسي' },
        },
        {
          id: 'b2',
          availableQty: 3,
          warehouseId: 'wh-1',
          warehouse: { id: 'wh-1', code: 'MAIN', nameEn: 'Main', nameAr: 'الرئيسي' },
        },
        {
          id: 'b3',
          availableQty: 2,
          warehouseId: 'wh-2',
          warehouse: { id: 'wh-2', code: 'SEC', nameEn: 'Second', nameAr: 'الثاني' },
        },
      ],
    };
    const card = selectInventoryItemCard(item, 'en');
    expect(card.balances).toHaveLength(2);
    expect(card.balances.map((b) => b.warehouseId)).toEqual(['wh-1', 'wh-2']);
    expect(card.balances[0]?.availableQty).toBe(11);
    expect(card.balances[0]?.warehouseName).toBe('Main');
    expect(card.balances[1]?.availableQty).toBe(2);
    expect(card.onHand).toBe(13);
  });

  it('aggregates reserved and free quantity from balances', () => {
    const item: InventoryItem = {
      ...baseItem,
      minStock: 0,
      quarantinedQty: 1,
      balances: [
        {
          id: 'b1',
          availableQty: 36,
          reservedQty: 26,
          warehouseId: 'wh-1',
          warehouse: { id: 'wh-1', code: 'FG', nameEn: 'Finished Goods', nameAr: 'تامة' },
        },
      ],
    };
    const card = selectInventoryItemCard(item, 'en');
    expect(card.onHand).toBe(36);
    expect(card.reservedQty).toBe(26);
    expect(card.freeQty).toBe(10);
    expect(card.quarantined).toBe(true);
    expect(card.balances[0]?.reservedQty).toBe(26);
    expect(card.balances[0]?.freeQty).toBe(10);
  });

  it('hides transaction unitCost when omitted', () => {
    const tx: InventoryTransaction = {
      id: 'tx-1',
      number: 'INV-1',
      type: 'PURCHASE_RECEIPT',
      inventoryItemId: 'item-1',
      warehouseId: 'wh-1',
      quantity: 5,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const row = selectInventoryTransaction(tx, 'en', 'm');
    expect(row.showCost).toBe(false);
    expect(row.costLabel).toBeNull();
  });
});

describe('inventoryItemUnitCost', () => {
  it('reads numeric and string standardCost', () => {
    expect(inventoryItemUnitCost({ standardCost: 12.5 })).toBe(12.5);
    expect(inventoryItemUnitCost({ standardCost: '8.000' })).toBe(8);
  });

  it('treats missing or zero as 0', () => {
    expect(inventoryItemUnitCost({})).toBe(0);
    expect(inventoryItemUnitCost({ standardCost: 0 })).toBe(0);
    expect(inventoryItemUnitCost({ standardCost: '0' })).toBe(0);
  });
});

describe('inventoryItemLifecycleEyebrow', () => {
  const LABELS: Record<string, string> = {
    'mobile.inventory.lifecycle.finished': 'Finished',
    'mobile.inventory.lifecycle.semiFinished': 'Semi-finished',
    'mobile.inventory.lifecycle.materials': 'Materials',
  };
  const t = (key: string) => LABELS[key] ?? key;

  it('humanizes known item classes without leaking enums', () => {
    expect(inventoryItemLifecycleEyebrow('FINISHED_GOOD', t)).toBe('Finished');
    expect(inventoryItemLifecycleEyebrow('SEMI_FINISHED_GOOD', t)).toBe('Semi-finished');
    expect(inventoryItemLifecycleEyebrow('RAW_MATERIAL', t)).toBe('Materials');
  });

  it('humanizes FINISHED_OUTBOUND as Finished / outbound', () => {
    expect(humanizeInventoryEnumLabel('FINISHED_OUTBOUND')).toBe('Finished / outbound');
    expect(inventoryItemLifecycleEyebrow('FINISHED_OUTBOUND', t)).toBe('Finished / outbound');
    expect(inventoryItemLifecycleEyebrow('FINISHED_OUTBOUND', t)).not.toMatch(
      /FINISHED_OUTBOUND|FINISHED OUTBOUND/,
    );
  });

  it('drops warehouse codes instead of inventing a warehouse', () => {
    expect(inventoryItemLifecycleEyebrow('FIN', t)).toBeNull();
    expect(inventoryItemLifecycleEyebrow('FIN-2', t)).toBeNull();
    expect(inventoryItemLifecycleEyebrow(null, t)).toBeNull();
  });
});
