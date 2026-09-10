import { readFileSync } from 'fs';
import { join } from 'path';
import { InventoryService } from './inventory.service';

describe('inventory item reorderQty', () => {
  function makeService() {
    const stored: Record<string, unknown> = {
      id: 'item-1',
      sku: 'WOOD-0001',
      qrCode: 'WOOD-0001',
      nameEn: 'Oak',
      nameAr: 'بلوط',
      minStock: 10,
      reorderQty: 50,
    };
    const prisma = {
      inventoryItem: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(stored, data, { id: 'item-1' });
          return { ...stored };
        }),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(stored, data);
          return { ...stored };
        }),
        findFirstOrThrow: jest.fn(async () => ({ ...stored, archivedAt: null })),
      },
      auditEvent: { create: jest.fn(async () => ({})) },
    };
    const sequences = { next: jest.fn() };
    const service = new InventoryService(prisma as never, sequences as never, {} as never);
    return { service, prisma, stored };
  }

  it('createItem persists reorderQty', async () => {
    const { service, prisma } = makeService();
    const item = await service.createItem(
      {
        sku: 'WOOD-0001',
        nameAr: 'بلوط',
        nameEn: 'Oak',
        category: 'WOOD',
        minStock: 10,
        reorderQty: 50,
      },
      'user-1',
    );
    expect(prisma.inventoryItem.create).toHaveBeenCalled();
    expect(Number(item.reorderQty)).toBe(50);
  });

  it('updateItem writes reorderQty when provided', async () => {
    const { service, stored } = makeService();
    const item = await service.updateItem('item-1', { reorderQty: 80 }, 'user-1');
    expect(Number(item.reorderQty)).toBe(80);
    expect(Number(stored.reorderQty)).toBe(80);
  });

  it('updateItem leaves stored reorderQty alone when omitted', async () => {
    const { service, stored, prisma } = makeService();
    await service.updateItem('item-1', { nameEn: 'Oak plank' }, 'user-1');
    expect(Number(stored.reorderQty)).toBe(50);
    const data = prisma.inventoryItem.update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data).not.toHaveProperty('reorderQty');
  });

  it('updateItem can clear reorderQty with null', async () => {
    const { service, stored } = makeService();
    await service.updateItem('item-1', { reorderQty: null }, 'user-1');
    expect(stored.reorderQty).toBeNull();
  });

  it('create and update DTOs expose reorderQty', () => {
    const src = readFileSync(join(__dirname, 'inventory.controller.ts'), 'utf8');
    expect(src.match(/reorderQty\?: number/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
