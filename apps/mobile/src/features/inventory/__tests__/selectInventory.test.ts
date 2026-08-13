import {
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
