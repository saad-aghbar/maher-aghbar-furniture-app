import { InventoryService } from './inventory.service';
import { stripInventoryCostFields } from './inventory-cost.util';
import type { PrismaService } from '../../common/prisma.service';
import type { SequenceService } from '../../common/sequence.service';
import type { PurchasingService } from '../purchasing/purchasing.service';

const ITEM_ID = 'item-1';
const WAREHOUSE_ID = 'wh-1';

const baseItem = {
  id: ITEM_ID,
  sku: 'FAB-001',
  nameEn: 'Linen Beige',
  nameAr: 'كتان بيج',
  unit: 'm',
  category: 'FABRIC',
  materialType: 'Linen',
  minStock: 10,
  standardCost: 42.5,
  imageUrl: 'https://images.unsplash.com/photo-velvet-demo',
  archivedAt: null,
  balances: [
    {
      id: 'bal-1',
      availableQty: 8,
      warehouseId: WAREHOUSE_ID,
      warehouse: { id: WAREHOUSE_ID, code: 'MAIN', nameEn: 'Main', nameAr: 'رئيسي' },
    },
  ],
};

describe('inventory cost visibility', () => {
  it('stripInventoryCostFields omits costs without inventory.cost.read', () => {
    const stripped = stripInventoryCostFields(
      { standardCost: 10, unitCost: 5, sku: 'X' },
      ['inventory.read'],
    );
    expect(stripped).toEqual({ sku: 'X' });
    expect(stripped).not.toHaveProperty('standardCost');
    expect(stripped).not.toHaveProperty('unitCost');
  });

  it('stripInventoryCostFields keeps imageUrl', () => {
    const stripped = stripInventoryCostFields(
      { standardCost: 10, imageUrl: 'https://cdn.example/x.jpg', sku: 'X' },
      ['inventory.read'],
    );
    expect(stripped).toEqual({ sku: 'X', imageUrl: 'https://cdn.example/x.jpg' });
  });

  it('stripInventoryCostFields keeps costs with inventory.cost.read', () => {
    const kept = stripInventoryCostFields(
      { standardCost: 10, unitCost: 5, sku: 'X' },
      ['inventory.read', 'inventory.cost.read'],
    );
    expect(kept).toEqual({ standardCost: 10, unitCost: 5, sku: 'X' });
  });

  function makeService() {
    const prisma = {
      inventoryItem: {
        findFirst: jest.fn().mockResolvedValue(baseItem),
        findMany: jest.fn().mockResolvedValue([baseItem]),
        count: jest.fn().mockResolvedValue(1),
        findFirstOrThrow: jest.fn().mockResolvedValue(baseItem),
        update: jest.fn().mockImplementation(async ({ data }: { data: object }) => ({
          ...baseItem,
          ...data,
        })),
      },
      inventoryTransaction: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'tx-1',
            number: 'INV-1',
            type: 'PURCHASE_RECEIPT',
            inventoryItemId: ITEM_ID,
            warehouseId: WAREHOUSE_ID,
            quantity: 5,
            unitCost: 12.5,
            referenceType: null,
            referenceId: null,
            notes: 'Receipt',
            createdAt: new Date('2026-01-01'),
            createdById: 'u1',
          },
        ]),
      },
      warehouse: {
        findMany: jest.fn().mockResolvedValue([
          { id: WAREHOUSE_ID, code: 'MAIN', nameEn: 'Main', nameAr: 'رئيسي' },
        ]),
      },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(async (arg: unknown) => {
        if (Array.isArray(arg)) {
          return Promise.all(arg);
        }
        return (arg as (tx: unknown) => unknown)(prisma);
      }),
    } as unknown as PrismaService;

    const sequences = {} as SequenceService;
    const purchasing = {} as PurchasingService;

    return {
      service: new InventoryService(prisma, sequences, purchasing),
      prisma,
    };
  }

  it('getItem includes imageUrl for a raw material without inventory.cost.read', async () => {
    const { service } = makeService();
    const result = await service.getItem(ITEM_ID, ['inventory.read']);
    expect(result).toHaveProperty('imageUrl', 'https://images.unsplash.com/photo-velvet-demo');
    expect(result).not.toHaveProperty('standardCost');
  });

  it('updateItem stores a raw-material imageUrl and clears it with null', async () => {
    const { service, prisma } = makeService();
    await service.updateItem(ITEM_ID, { imageUrl: ' https://cdn.example/foam.jpg ' }, 'admin-1');
    expect((prisma.inventoryItem.update as jest.Mock).mock.calls[0][0].data.imageUrl).toBe(
      'https://cdn.example/foam.jpg',
    );
    await service.updateItem(ITEM_ID, { imageUrl: null }, 'admin-1');
    expect((prisma.inventoryItem.update as jest.Mock).mock.calls[1][0].data.imageUrl).toBeNull();
  });

  it('getItem includes standardCost when inventory.cost.read is granted', async () => {
    const { service } = makeService();
    const result = await service.getItem(ITEM_ID, [
      'inventory.read',
      'inventory.cost.read',
    ]);
    expect(result).toHaveProperty('standardCost', 42.5);
  });

  it('listItems omits standardCost for unauthorized readers', async () => {
    const { service } = makeService();
    const result = await service.listItems(
      { page: 1, pageSize: 20 },
      ['inventory.read'],
    );
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).not.toHaveProperty('standardCost');
    expect(result.data[0]).toHaveProperty('imageUrl', 'https://images.unsplash.com/photo-velvet-demo');
  });

  it('listItemTransactions omits unitCost for unauthorized readers', async () => {
    const { service } = makeService();
    const result = await service.listItemTransactions(
      ITEM_ID,
      { page: 1, pageSize: 20 },
      ['inventory.read'],
    );
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).not.toHaveProperty('unitCost');
    expect(result.data[0]).toMatchObject({
      type: 'PURCHASE_RECEIPT',
      warehouse: { code: 'MAIN' },
    });
  });

  it('listItemTransactions includes unitCost when inventory.cost.read is granted', async () => {
    const { service } = makeService();
    const result = await service.listItemTransactions(
      ITEM_ID,
      { page: 1, pageSize: 20 },
      ['inventory.read', 'inventory.cost.read'],
    );
    expect(result.data[0]).toHaveProperty('unitCost', 12.5);
  });

  it('updateItem does not accept or apply quantity / availableQty', async () => {
    const { service, prisma } = makeService();
    await service.updateItem(
      ITEM_ID,
      {
        nameEn: 'Linen Beige Updated',
        ...( {
          quantity: 999,
          availableQty: 999,
        } as object),
      } as Parameters<InventoryService['updateItem']>[1],
      'admin-1',
    );

    const updateCall = (prisma.inventoryItem.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty('quantity');
    expect(updateCall.data).not.toHaveProperty('availableQty');
    expect(updateCall.data.nameEn).toBe('Linen Beige Updated');
  });

  it('lowStock omits standardCost without inventory.cost.read', async () => {
    const { service } = makeService();
    const result = await service.lowStock(['inventory.read']);
    expect(result[0]).not.toHaveProperty('standardCost');
    expect(result[0]).toHaveProperty('availableQty', 8);
  });
});
