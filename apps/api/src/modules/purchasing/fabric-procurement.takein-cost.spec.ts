import { FabricProcurementService } from './fabric-procurement.service';

describe('fabric take-in cost capture', () => {
  it('passes lot unitCost and production FKs onto the issue movement and usage row', async () => {
    const applyMovement = jest.fn();
    const usageCreate = jest.fn();
    const prisma = {
      productionTask: {
        findUnique: jest.fn(async () => ({
          id: 'task-1',
          productionOrderId: 'po-1',
          productionOrder: { id: 'po-1', salesOrderId: 'so-1', salesOrderLineId: 'sol-1' },
          stageDefinition: { code: 'UPHOLSTERY' },
        })),
      },
      inventoryLot: {
        findFirst: jest.fn(async () => ({
          id: 'lot-1',
          qrCode: 'FB-SO-1-001',
          status: 'AVAILABLE',
          remainingQty: 12,
          quantity: 12,
          warehouseId: 'wh-1',
          inventoryItemId: 'inv-vel',
          salesOrderId: 'so-1',
          unitCost: 22.5,
          fabricProcurementId: 'fp-1',
          inventoryItem: {
            id: 'inv-vel',
            sku: 'FAB-VEL',
            nameEn: 'Velvet',
            category: 'FABRIC',
            standardCost: 18,
          },
          fabricProcurement: {
            id: 'fp-1',
            requirement: {
              stageCode: 'UPHOLSTERY',
              inventoryItemId: 'inv-vel',
              expectedQty: 12,
            },
          },
        })),
      },
      productionTaskMaterialUsage: { findUnique: jest.fn(async () => null) },
      $transaction: jest.fn(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) =>
        fn({
          inventoryLot: { update: jest.fn() },
          productionTaskMaterialUsage: { create: usageCreate, update: jest.fn() },
          fabricProcurementEvent: { create: jest.fn() },
        }),
      ),
    };
    const svc = new FabricProcurementService(
      prisma as never,
      {} as never,
      {} as never,
      { applyMovement } as never,
      { send: jest.fn() } as never,
    );

    await svc.takeInLot({
      taskId: 'task-1',
      qrCode: 'FB-SO-1-001',
      user: { id: 'user-1', permissions: ['production.material-usage.record'] } as never,
    });

    expect(applyMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'PRODUCTION_ISSUE',
        quantity: 12,
        unitCost: 22.5,
        productionTaskId: 'task-1',
        productionOrderId: 'po-1',
        salesOrderId: 'so-1',
      }),
    );
    expect(usageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          inventoryLotId: 'lot-1',
          unitCost: 22.5,
        }),
      }),
    );
  });
});
