import { leftoverFabricSourceKey } from './goods-receipt-fabric-lots';
import { FabricProcurementService } from './fabric-procurement.service';
import { InventoryAllocationMode } from '@maher/database';

describe('fabric leftover general stock', () => {
  it('keys leftover lots by order bundle, task, and quantity', () => {
    expect(leftoverFabricSourceKey('lot-1', 'task-1', 2)).toBe('fabric-leftover:lot-1:task-1:2');
    expect(leftoverFabricSourceKey('lot-1', 'task-1', 2.0)).toBe(
      leftoverFabricSourceKey('lot-1', 'task-1', 2),
    );
  });

  it('records leftover as GENERAL_STOCK instead of adding qty back onto the order bundle', async () => {
    const usage = { id: 'usage-1', returnedQty: 0, scrapQty: 0, actualQty: 24, unitCost: 12 };
    const createdLots: Array<Record<string, unknown>> = [];
    const prisma = {
      productionTask: {
        findUnique: jest.fn(async () => ({
          id: 'task-1',
          productionOrderId: 'po-1',
          productionOrder: { salesOrderId: 'so-1' },
        })),
      },
      inventoryLot: {
        findFirst: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
          if (where.qrCode) {
            return {
              id: 'lot-1',
              qrCode: 'FB-SOFB1042-001',
              remainingQty: 0,
              quantity: 24,
              warehouseId: 'wh-1',
              locationId: 'loc-1',
              inventoryItemId: 'inv-vel',
              salesOrderId: 'so-1',
              fabricProcurementId: 'fp-1',
              unitCost: 12,
              fabricProcurement: { id: 'fp-1' },
            };
          }
          return null;
        }),
        findUnique: jest.fn(async () => null),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          createdLots.push(data);
          return { id: 'stock-1', qrCode: data.qrCode };
        }),
        update: jest.fn(),
      },
      inventoryItem: {
        findUnique: jest.fn(async () => ({
          sku: 'FAB-VEL',
          nameEn: 'Velvet 302',
          nameAr: 'مخمل 302',
          nameHe: null,
          color: null,
        })),
      },
      fabric: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'fab-1',
          isActive: true,
          nameHe: null,
          color: null,
          ...data,
        })),
        update: jest.fn(),
      },
      productionTaskMaterialUsage: {
        findFirst: jest.fn(async () => usage),
        update: jest.fn(),
      },
      fabricProcurementEvent: { create: jest.fn() },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    const inventory = { applyMovement: jest.fn().mockResolvedValue({}) };
    const svc = new FabricProcurementService(
      prisma as never,
      {} as never,
      {} as never,
      inventory as never,
      { send: jest.fn() } as never,
    );

    const result = await svc.recordDisposition({
      taskId: 'task-1',
      qrCode: 'FB-SOFB1042-001',
      user: { id: 'user-1' } as never,
      returnedQty: 4,
    });

    expect(result).toMatchObject({ ok: true, returnedQty: 4, leftoverQrCode: expect.stringMatching(/^FB-/) });
    expect(prisma.inventoryLot.update).not.toHaveBeenCalled();
    expect(createdLots[0]).toMatchObject({
      inventoryItemId: 'inv-vel',
      allocationMode: InventoryAllocationMode.GENERAL_STOCK,
      sourceKey: leftoverFabricSourceKey('lot-1', 'task-1', 4),
    });
    expect(prisma.fabric.create).toHaveBeenCalled();
  });
});
