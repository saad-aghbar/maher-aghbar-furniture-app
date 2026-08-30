import { MaterialUsageService } from './material-usage.service';
import type { PrismaService } from '../../common/prisma.service';
import type { InventoryService } from '../inventory/inventory.service';

function makeService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = {
    productionTask: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 'task-1',
        productionOrderId: 'po-1',
        stageInstanceId: null,
        productionOrder: {
          id: 'po-1',
          quantity: 1,
          productId: null,
          product: null,
        },
        stageInstance: null,
      }),
    },
    productionOrderWorkflowSnapshotNode: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    productionOrderWorkflowSnapshotMaterialInput: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    productStageMaterialInput: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    productionTaskMaterialUsage: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    inventoryItem: {
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    inventoryBalance: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    ...prismaOverrides,
  } as unknown as PrismaService;
  const inventory = {} as InventoryService;
  return {
    service: new MaterialUsageService(prisma, inventory),
    prisma,
  };
}

describe('MaterialUsageService.identifyScan', () => {
  it('returns MATCH for expected SKU without mutating stock', async () => {
    const { service, prisma } = makeService();
    (prisma.productionTaskMaterialUsage.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'u1',
        inventoryItemId: 'item-ply',
        sku: 'MAT-PLY',
        expectedQty: 4,
        actualQty: 4,
        returnedQty: 0,
        scrapQty: 0,
        isExtra: false,
      },
    ]);
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({
      id: 'item-ply',
      sku: 'MAT-PLY',
      nameEn: 'Plywood',
      nameAr: 'خشب رقائقي',
      nameHe: null,
      imageUrl: null,
      unit: 'sheet',
      itemClass: 'RAW_MATERIAL',
    });

    const result = await service.identifyScan('task-1', 'MAT-PLY');
    expect(result.status).toBe('MATCH');
    if (result.status === 'MATCH') {
      expect(result.sku).toBe('MAT-PLY');
      expect(result.expectedQty).toBe(4);
    }
    expect(prisma.inventoryItem.findFirst).toHaveBeenCalled();
  });

  it('returns EXTRA when scanned SKU is not on the task (allow substitute)', async () => {
    const { service, prisma } = makeService();
    (prisma.productionTaskMaterialUsage.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'u1',
        inventoryItemId: 'item-ply',
        sku: 'MAT-PLY',
        expectedQty: 4,
        actualQty: 4,
        returnedQty: 0,
        scrapQty: 0,
        isExtra: false,
      },
    ]);
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({
      id: 'item-foam',
      sku: 'MAT-FOAM-HD',
      nameEn: 'Foam',
      nameAr: 'إسفنج',
      nameHe: null,
      imageUrl: null,
      unit: 'm',
      itemClass: 'RAW_MATERIAL',
    });

    const result = await service.identifyScan('task-1', 'MAT-FOAM-HD');
    expect(result.status).toBe('EXTRA');
    if (result.status === 'EXTRA') {
      expect(result.sku).toBe('MAT-FOAM-HD');
      expect(result.inventoryItemId).toBe('item-foam');
    }
  });

  it('returns WRONG when scanned item is SEMI_FINISHED_GOOD', async () => {
    const { service, prisma } = makeService();
    (prisma.productionTaskMaterialUsage.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'u1',
        inventoryItemId: 'item-ply',
        sku: 'MAT-PLY',
        expectedQty: 4,
        actualQty: 0,
        returnedQty: 0,
        scrapQty: 0,
        isExtra: false,
      },
    ]);
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({
      id: 'item-semi',
      sku: 'SEMI-FRAME',
      nameEn: 'Wooden frame',
      nameAr: 'هيكل خشبي',
      nameHe: null,
      imageUrl: null,
      unit: 'pcs',
      itemClass: 'SEMI_FINISHED_GOOD',
    });

    const result = await service.identifyScan('task-1', 'SEMI-FRAME');
    expect(result.status).toBe('WRONG');
  });

  it('returns NOT_FOUND for unknown codes', async () => {
    const { service, prisma } = makeService();
    (prisma.productionTaskMaterialUsage.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await service.identifyScan('task-1', 'NO-SUCH-CODE');
    expect(result).toEqual({ status: 'NOT_FOUND', code: 'NO-SUCH-CODE' });
  });

  it('returns EXTRA when the task has no expected lines yet', async () => {
    const { service, prisma } = makeService();
    (prisma.productionTaskMaterialUsage.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({
      id: 'item-ply',
      sku: 'MAT-PLY',
      nameEn: 'Plywood',
      nameAr: 'خشب رقائقي',
      nameHe: null,
      imageUrl: null,
      unit: 'sheet',
      itemClass: 'RAW_MATERIAL',
    });

    const result = await service.identifyScan('task-1', 'MAT-PLY');
    expect(result.status).toBe('EXTRA');
    if (result.status === 'EXTRA') {
      expect(result.sku).toBe('MAT-PLY');
    }
  });
});
