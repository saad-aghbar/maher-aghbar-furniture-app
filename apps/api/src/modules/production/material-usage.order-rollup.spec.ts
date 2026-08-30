import {
  MaterialUsageService,
  classifyOrderMaterialUsageStatus,
} from './material-usage.service';
import type { PrismaService } from '../../common/prisma.service';
import type { InventoryService } from '../inventory/inventory.service';

describe('classifyOrderMaterialUsageStatus', () => {
  it('classifies over / under / unused / extra / on target', () => {
    expect(classifyOrderMaterialUsageStatus(10, 20)).toBe('OVER');
    expect(classifyOrderMaterialUsageStatus(10, 5)).toBe('UNDER');
    expect(classifyOrderMaterialUsageStatus(10, 0)).toBe('UNUSED');
    expect(classifyOrderMaterialUsageStatus(0, 3)).toBe('EXTRA');
    expect(classifyOrderMaterialUsageStatus(10, 10.4)).toBe('ON_TARGET');
    expect(classifyOrderMaterialUsageStatus(10, 9.6)).toBe('ON_TARGET');
  });
});

describe('MaterialUsageService.listOrderMaterialUsage', () => {
  function makeService() {
    const prisma = {
      productionOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'po-1',
          quantity: 2,
          product: {
            id: 'prod-1',
            bomDefaults: { materials: [{ sku: 'MAT-PLY', qty: 5 }] },
          },
        }),
      },
      inventoryItem: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'item-ply', sku: 'MAT-PLY' },
          {
            id: 'item-ply',
            sku: 'MAT-PLY',
            nameEn: 'Plywood',
            nameAr: 'خشب',
            nameHe: null,
            unit: 'sheet',
            imageUrl: null,
            itemClass: 'RAW_MATERIAL',
          },
        ]),
      },
      productionOrderWorkflowSnapshotNode: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      productionTaskMaterialUsage: {
        findMany: jest.fn().mockResolvedValue([
          {
            taskId: 't1',
            inventoryItemId: 'item-ply',
            sku: 'MAT-PLY',
            expectedQty: 10,
            actualQty: 7,
            returnedQty: 0,
            scrapQty: 0,
            isExtra: false,
            inventoryItem: {
              id: 'item-ply',
              sku: 'MAT-PLY',
              nameEn: 'Plywood',
              nameAr: 'خشب',
              nameHe: null,
              unit: 'sheet',
              imageUrl: null,
              itemClass: 'RAW_MATERIAL',
            },
            task: { id: 't1', number: 'TSK-1', stageDefinition: { code: 'FOAM' } },
          },
          {
            taskId: 't2',
            inventoryItemId: 'item-ply',
            sku: 'MAT-PLY',
            expectedQty: 10,
            actualQty: 4,
            returnedQty: 1,
            scrapQty: 0,
            isExtra: false,
            inventoryItem: {
              id: 'item-ply',
              sku: 'MAT-PLY',
              nameEn: 'Plywood',
              nameAr: 'خشب',
              nameHe: null,
              unit: 'sheet',
              imageUrl: null,
              itemClass: 'RAW_MATERIAL',
            },
            task: { id: 't2', number: 'TSK-2', stageDefinition: { code: 'ASSEMBLY' } },
          },
          {
            taskId: 't2',
            inventoryItemId: 'item-extra',
            sku: 'MAT-EXTRA',
            expectedQty: 0,
            actualQty: 2,
            returnedQty: 0,
            scrapQty: 0,
            isExtra: true,
            inventoryItem: {
              id: 'item-extra',
              sku: 'MAT-EXTRA',
              nameEn: 'Extra foam',
              nameAr: 'إسفنج',
              nameHe: null,
              unit: 'pcs',
              imageUrl: null,
              itemClass: 'RAW_MATERIAL',
            },
            task: { id: 't2', number: 'TSK-2', stageDefinition: { code: 'ASSEMBLY' } },
          },
        ]),
      },
    } as unknown as PrismaService;

    // Second findMany call for meta fill — return empty so first mock covers BOM lookup.
    (prisma.inventoryItem.findMany as jest.Mock)
      .mockResolvedValueOnce([{ id: 'item-ply', sku: 'MAT-PLY' }])
      .mockResolvedValueOnce([]);

    return {
      service: new MaterialUsageService(prisma, {} as InventoryService),
      prisma,
    };
  }

  it('assigns from BOM once and sums used across tasks (no expected sum)', async () => {
    const { service } = makeService();
    const result = await service.listOrderMaterialUsage('po-1');
    const ply = result.materials.find((m) => m.sku === 'MAT-PLY');
    const extra = result.materials.find((m) => m.sku === 'MAT-EXTRA');

    expect(ply).toMatchObject({
      assignedQty: 10, // 5 × order qty 2
      usedQty: 11, // 7 + 4
      returnedQty: 1,
      varianceQty: 1,
      status: 'OVER',
    });
    expect(ply?.tasks).toHaveLength(2);

    expect(extra).toMatchObject({
      assignedQty: 0,
      usedQty: 2,
      status: 'EXTRA',
      isExtra: true,
    });
  });

  it('marks assigned unused when no worker usage', async () => {
    const { service, prisma } = makeService();
    (prisma.productionTaskMaterialUsage.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.inventoryItem.findMany as jest.Mock)
      .mockReset()
      .mockResolvedValueOnce([{ id: 'item-ply', sku: 'MAT-PLY' }])
      .mockResolvedValueOnce([
        {
          id: 'item-ply',
          sku: 'MAT-PLY',
          nameEn: 'Plywood',
          nameAr: 'خشب',
          nameHe: null,
          unit: 'sheet',
          imageUrl: null,
          itemClass: 'RAW_MATERIAL',
        },
      ]);

    const result = await service.listOrderMaterialUsage('po-1');
    expect(result.materials).toEqual([
      expect.objectContaining({
        sku: 'MAT-PLY',
        assignedQty: 10,
        usedQty: 0,
        status: 'UNUSED',
      }),
    ]);
  });

  it('sums assigned qty across stage snapshot maps when present', async () => {
    const { service, prisma } = makeService();
    (prisma.productionOrderWorkflowSnapshotNode.findMany as jest.Mock).mockResolvedValue([
      {
        materialInputs: [
          {
            inventoryItemId: 'item-ply',
            sku: 'MAT-PLY',
            qtyPerUnit: 3,
            quantityMode: 'LINEAR',
            required: true,
            inventoryItem: { id: 'item-ply', itemClass: 'RAW_MATERIAL', sku: 'MAT-PLY' },
          },
        ],
      },
      {
        materialInputs: [
          {
            inventoryItemId: 'item-ply',
            sku: 'MAT-PLY',
            qtyPerUnit: 2,
            quantityMode: 'LINEAR',
            required: true,
            inventoryItem: { id: 'item-ply', itemClass: 'RAW_MATERIAL', sku: 'MAT-PLY' },
          },
        ],
      },
    ]);
    (prisma.productionTaskMaterialUsage.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'item-ply',
        sku: 'MAT-PLY',
        nameEn: 'Plywood',
        nameAr: 'خشب',
        nameHe: null,
        unit: 'sheet',
        imageUrl: null,
        itemClass: 'RAW_MATERIAL',
      },
    ]);

    const result = await service.listOrderMaterialUsage('po-1');
    // 3+2 per unit × order qty 2 = 10
    expect(result.materials[0]).toMatchObject({
      sku: 'MAT-PLY',
      assignedQty: 10,
      usedQty: 0,
      status: 'UNUSED',
    });
  });
});
