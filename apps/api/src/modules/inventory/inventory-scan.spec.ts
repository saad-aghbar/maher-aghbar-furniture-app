import { readFileSync } from 'fs';
import { join } from 'path';
import { inventoryScanPayload } from '@maher/types';
import { InventoryService } from './inventory.service';
import type { PrismaService } from '../../common/prisma.service';
import type { SequenceService } from '../../common/sequence.service';
import type { PurchasingService } from '../purchasing/purchasing.service';

const inventoryDir = __dirname;

function makeService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = {
    inventoryItem: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    purchaseOrder: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    inventoryTransaction: {},
    warehouse: {},
    auditEvent: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(async (arg: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg);
      return (arg as (tx: unknown) => unknown)(prisma);
    }),
    ...prismaOverrides,
  } as unknown as PrismaService;

  const sequences = {
    next: jest.fn().mockResolvedValue('FAB-0001'),
  } as unknown as SequenceService;
  const purchasing = {} as PurchasingService;
  return {
    service: new InventoryService(prisma, sequences, purchasing),
    prisma,
    sequences,
  };
}

describe('inventory scan identity', () => {
  it('getItem and findByCode expose scanCode from the shared helper', async () => {
    const item = {
      id: 'i1',
      sku: 'MAT-ITAL-VEL',
      qrCode: 'MAT-ITAL-VEL',
      barcode: null,
      archivedAt: null,
      isActive: true,
      balances: [],
    };
    const { service, prisma } = makeService();
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue(item);

    const byId = await service.getItem('i1', ['inventory.read']);
    const byCode = await service.findByCode('MAT-ITAL-VEL', ['inventory.read']);
    expect(byId.scanCode).toBe(inventoryScanPayload(item));
    expect(byCode.scanCode).toBe('MAT-ITAL-VEL');
    expect(byId.scanCode).toBe(byCode.scanCode);
  });

  it('findByCode matches sku, barcode, or qrCode and includes archived items', async () => {
    const { service, prisma } = makeService();
    const archived = {
      id: 'old',
      sku: 'MAT-OLD',
      qrCode: 'MAT-OLD',
      barcode: '1234567890123',
      archivedAt: new Date('2026-01-01'),
      isActive: false,
      balances: [],
    };
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue(archived);
    const found = await service.findByCode('MAT-OLD', ['inventory.read']);
    expect(found.id).toBe('old');
    expect(found.archivedAt).toBeTruthy();
    expect(found.scanCode).toBe('MAT-OLD');
    const where = (prisma.inventoryItem.findFirst as jest.Mock).mock.calls[0][0].where;
    expect(where).not.toHaveProperty('archivedAt');
    expect(where.OR).toEqual([
      { sku: 'MAT-OLD' },
      { barcode: 'MAT-OLD' },
      { qrCode: 'MAT-OLD' },
    ]);
  });

  it('createItem sets qrCode to sku and scanCode; does not set barcode', async () => {
    const { service, prisma } = makeService();
    (prisma.inventoryItem.create as jest.Mock).mockImplementation(async ({ data }: { data: object }) => ({
      id: 'new',
      ...data,
    }));
    const created = await service.createItem(
      { nameAr: 'مخمل', nameEn: 'Velvet', category: 'FABRIC', sku: 'MAT-TEST-001' },
      'admin-1',
    );
    const data = (prisma.inventoryItem.create as jest.Mock).mock.calls[0][0].data;
    expect(data.qrCode).toBe('MAT-TEST-001');
    expect(data.barcode).toBeUndefined();
    expect(created.scanCode).toBe('MAT-TEST-001');
    expect(created.qrCode).toBe('MAT-TEST-001');
  });

  it('accessory create uses the same qrCode=sku default', async () => {
    const { service, prisma } = makeService();
    (prisma.inventoryItem.create as jest.Mock).mockImplementation(async ({ data }: { data: object }) => ({
      id: 'hw',
      ...data,
    }));
    const created = await service.createItem(
      { nameAr: 'طقم', nameEn: 'Hardware kit', category: 'METAL_ACCESSORY', sku: 'MAT-HW-UAT' },
      'admin-1',
    );
    const data = (prisma.inventoryItem.create as jest.Mock).mock.calls[0][0].data;
    expect(data.qrCode).toBe('MAT-HW-UAT');
    expect(data.barcode).toBeUndefined();
    expect(created.scanCode).toBe('MAT-HW-UAT');
  });

  it('createItem without sku still defaults qrCode to the generated sku', async () => {
    const { service, prisma } = makeService();
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.inventoryItem.create as jest.Mock).mockImplementation(async ({ data }: { data: object }) => ({
      id: 'new',
      ...data,
    }));
    const created = await service.createItem(
      { nameAr: 'مخمل', nameEn: 'Velvet', category: 'FABRIC' },
      'admin-1',
    );
    const data = (prisma.inventoryItem.create as jest.Mock).mock.calls[0][0].data;
    expect(data.sku).toBe('FAB-0001');
    expect(data.qrCode).toBe('FAB-0001');
    expect(data.barcode).toBeUndefined();
    expect(created.scanCode).toBe('FAB-0001');
  });

  it('createItem keeps an explicit barcode separate from qrCode/scanCode', async () => {
    const { service, prisma } = makeService();
    (prisma.inventoryItem.create as jest.Mock).mockImplementation(async ({ data }: { data: object }) => ({
      id: 'new',
      ...data,
    }));
    const created = await service.createItem(
      {
        nameAr: 'مخمل',
        nameEn: 'Velvet',
        category: 'FABRIC',
        sku: 'MAT-TEST-001',
        barcode: 'SUP-BAR-99',
      },
      'admin-1',
    );
    const data = (prisma.inventoryItem.create as jest.Mock).mock.calls[0][0].data;
    expect(data.qrCode).toBe('MAT-TEST-001');
    expect(data.barcode).toBe('SUP-BAR-99');
    expect(created.scanCode).toBe('MAT-TEST-001');
  });

  it('CreateInventoryItemDto still accepts optional qrCode; UpdateInventoryItemDto does not', () => {
    const src = readFileSync(join(inventoryDir, 'inventory.controller.ts'), 'utf8');
    const createDto = src.slice(
      src.indexOf('class CreateInventoryItemDto'),
      src.indexOf('class UpdateInventoryItemDto'),
    );
    const updateDto = src.slice(
      src.indexOf('class UpdateInventoryItemDto'),
      src.indexOf('class StockMovementDto'),
    );
    expect(createDto).toContain('qrCode?: string');
    expect(updateDto).toContain('barcode?: string');
    expect(updateDto).not.toContain('qrCode');
    expect(updateDto).not.toContain('sku?:');
  });

  it('updateItem name/image/cost does not change qrCode', async () => {
    const existing = {
      id: 'i1',
      sku: 'MAT-ITAL-VEL',
      qrCode: 'MAT-ITAL-VEL',
      archivedAt: null,
    };
    const prisma = {
      inventoryItem: {
        findFirstOrThrow: jest.fn().mockResolvedValue(existing),
        update: jest.fn().mockImplementation(async ({ data }: { data: object }) => ({
          ...existing,
          ...data,
        })),
      },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    } as unknown as PrismaService;
    const service = new InventoryService(prisma, {} as SequenceService, {} as PurchasingService);
    const updated = await service.updateItem(
      'i1',
      { nameEn: 'Italian velvet deluxe', imageUrl: 'https://cdn.example/v.jpg', standardCost: 30 },
      'admin-1',
    );
    const data = (prisma.inventoryItem.update as jest.Mock).mock.calls[0][0].data;
    expect(data).not.toHaveProperty('qrCode');
    expect(data).not.toHaveProperty('sku');
    expect(updated.qrCode).toBe('MAT-ITAL-VEL');
    expect(updated.scanCode).toBe('MAT-ITAL-VEL');
  });

  it('open-receipts is gated by inventory.receive and omits costs', () => {
    const src = readFileSync(join(inventoryDir, 'inventory.controller.ts'), 'utf8');
    const idx = src.indexOf("@Get('items/:id/open-receipts')");
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 280);
    expect(block).toContain("RequirePermissions('inventory.receive')");
    expect(block).not.toContain('purchase-order.read');
    const serviceSrc = readFileSync(join(inventoryDir, 'inventory.service.ts'), 'utf8');
    const method = serviceSrc.slice(serviceSrc.indexOf('async listOpenReceipts'));
    expect(method).not.toContain('unitPrice');
    expect(method).not.toContain('standardCost');
    expect(method).not.toContain('subtotal');
    expect(method).not.toContain('materialDemand');
  });

  it('item report uses report builder; QR print uses centered inventory label builder', () => {
    const src = readFileSync(
      join(inventoryDir, '../documents/pdf.controller.ts'),
      'utf8',
    );
    expect(src).toContain("Get('inventory/items/:id/label')");
    expect(src).toContain("Get('inventory/items/:id/qr-label')");
    expect(src).toContain('buildInventoryItemReportPdf');
    expect(src).toContain('buildInventoryLabelPdf');
    expect(src).toContain('inventoryItemReport.getReportData');
    expect(src).toContain('inventoryScanPayload(item)');
    expect(src).not.toContain("printableScanCode(item.qrCode");
  });

  it('listOpenReceipts returns remaining qty and skips fully received POs', async () => {
    const { service, prisma } = makeService();
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({
      id: 'i1',
      sku: 'MAT-X',
      unit: 'm',
      archivedAt: null,
      isActive: true,
    });
    (prisma.purchaseOrder.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'po1',
        number: 'PORD-1',
        status: 'SENT',
        expectedDeliveryDate: new Date('2026-08-20'),
        warehouseId: 'wh1',
        supplier: { name: '', nameEn: 'Abdali', nameAr: null, nameHe: null },
        lines: [{ inventoryItemId: 'i1', quantity: 24, unit: 'm' }],
        goodsReceipts: [{ lines: [{ receivedQty: 6 }] }],
      },
      {
        id: 'po2',
        number: 'PORD-2',
        status: 'SENT',
        expectedDeliveryDate: null,
        warehouseId: 'wh1',
        supplier: { nameEn: 'Done', name: '', nameAr: null, nameHe: null },
        lines: [{ inventoryItemId: 'i1', quantity: 10, unit: 'm' }],
        goodsReceipts: [{ lines: [{ receivedQty: 10 }] }],
      },
    ]);
    const rows = await service.listOpenReceipts('i1');
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.purchaseOrderId).toBe('po1');
    expect(Number(row.remainingQty)).toBe(18);
    expect(Number(row.orderedQty)).toBe(24);
    expect(Number(row.receivedQty)).toBe(6);
    expect(JSON.stringify(rows)).not.toMatch(/unitPrice|standardCost|subtotal/);
  });
});
