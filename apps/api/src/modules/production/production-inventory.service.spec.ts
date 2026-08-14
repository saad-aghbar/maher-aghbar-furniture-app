import { QualityResult } from '@maher/database';
import { ProductionInventoryService } from './production-inventory.service';
import type { PrismaService } from '../../common/prisma.service';
import type { InventoryService } from '../inventory/inventory.service';

describe('ProductionInventoryService', () => {
  function service(tx: Record<string, unknown>, applyMovement = jest.fn()) {
    return {
      service: new ProductionInventoryService(
        {} as PrismaService,
        { applyMovement } as unknown as InventoryService,
      ),
      applyMovement,
      tx,
    };
  }

  it('does not produce finished goods when inspection has not passed', async () => {
    const applyMovement = jest.fn();
    const tx = {
      productionTask: { count: jest.fn().mockResolvedValue(0) },
      productionOrderWorkflowSnapshotNode: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'snap-1',
          isSkipped: false,
          inventoryTracking: 'PRODUCES_FINISHED',
          consumesRawMaterials: false,
          consumesSemiFinished: false,
          requiresInspection: true,
          outputQtyPerUnit: 1,
          outputNameAr: null,
          outputNameEn: null,
          outputNameHe: null,
          defaultWarehouseId: null,
        }),
      },
      productionOrder: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'po-1',
          quantity: 1,
          productId: null,
          product: null,
          salesOrderId: null,
          salesOrderLineId: null,
          productDescription: 'Sofa',
        }),
      },
      qualityInspection: { findFirst: jest.fn().mockResolvedValue(null) },
      inventoryLot: { findFirst: jest.fn(), count: jest.fn(), create: jest.fn() },
      warehouse: { findFirst: jest.fn(), findUnique: jest.fn() },
    };
    const { service: svc } = service(tx, applyMovement);
    await svc.onStageTaskComplete({
      productionOrderId: 'po-1',
      stageInstanceId: 'stage-1',
      userId: 'u1',
      tx: tx as never,
    });
    expect(applyMovement).not.toHaveBeenCalled();
  });

  it('produces finished goods after a PASSED inspection', async () => {
    const applyMovement = jest.fn().mockResolvedValue({ id: 'tx-1' });
    const tx = {
      productionTask: { count: jest.fn().mockResolvedValue(0) },
      productionOrderWorkflowSnapshotNode: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'snap-1',
            stageInstanceId: 'stage-1',
            isSkipped: false,
            inventoryTracking: 'PRODUCES_FINISHED',
            outputQtyPerUnit: 1,
            outputNameAr: null,
            outputNameEn: 'Sofa',
            outputNameHe: null,
            defaultWarehouseId: null,
            sourceWorkflowNodeId: null,
            stageDefinitionId: null,
          },
        ]),
      },
      productionOrder: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'po-1',
          quantity: 1,
          productId: 'p1',
          product: { id: 'p1', sku: 'SOFA', nameEn: 'Sofa', nameAr: 'كنبة', nameHe: null },
          salesOrderId: 'so-1',
          salesOrderLineId: 'sol-1',
          productDescription: 'Sofa',
        }),
      },
      qualityInspection: {
        findFirst: jest.fn().mockResolvedValue({ id: 'qc-1', result: QualityResult.PASSED }),
      },
      inventoryLot: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'lot-1' }),
      },
      warehouse: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue({ id: 'fg-wh', type: 'FINISHED_GOODS', isActive: true }),
      },
      inventoryItem: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue({ id: 'fg-item' }),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
    };
    const { service: svc } = service(tx, applyMovement);
    await svc.onInspectionPassed({
      productionOrderId: 'po-1',
      userId: 'u1',
      tx: tx as never,
    });
    expect(applyMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'FINISHED_GOODS_RECEIPT',
        quantity: 1,
        warehouseId: 'fg-wh',
      }),
    );
  });

  it('receives Milano Sofa Frame qty = order qty × output per unit once', async () => {
    const applyMovement = jest.fn().mockResolvedValue({ id: 'tx-1' });
    const tx = {
      productionTask: { count: jest.fn().mockResolvedValue(0) },
      productionOrderWorkflowSnapshotNode: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'snap-carpentry',
          isSkipped: false,
          inventoryTracking: 'PRODUCES_SEMI_FINISHED',
          consumesRawMaterials: false,
          consumesSemiFinished: false,
          requiresInspection: false,
          outputQtyPerUnit: 1,
          outputNameEn: 'Milano Sofa Frame',
          outputNameAr: 'هيكل ميلانو',
          outputNameHe: null,
          outputDefinitionId: 'out-frame',
          outputInventoryItemId: 'frame-item',
          defaultWarehouseId: null,
        }),
      },
      productionOrder: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'po-1',
          quantity: 2,
          productId: 'milano',
          product: { id: 'milano', sku: 'MILANO', nameEn: 'Milano Sofa', nameAr: 'ميلانو', nameHe: null },
          salesOrderId: null,
          salesOrderLineId: null,
          productDescription: 'Milano Sofa',
        }),
      },
      inventoryLot: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'lot-1' }),
      },
      warehouse: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue({ id: 'semi-wh', type: 'SEMI_FINISHED', isActive: true }),
      },
      inventoryItem: {
        findUnique: jest.fn().mockResolvedValue({ id: 'frame-item', nameEn: 'Milano Sofa Frame' }),
      },
    };
    const { service: svc } = service(tx, applyMovement);
    await svc.onStageTaskComplete({
      productionOrderId: 'po-1',
      stageInstanceId: 'carpentry-1',
      userId: 'u1',
      tx: tx as never,
    });
    expect(applyMovement).toHaveBeenCalledTimes(1);
    expect(applyMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SEMI_FINISHED_RECEIPT',
        quantity: 2,
        inventoryItemId: 'frame-item',
      }),
    );
    expect(tx.inventoryLot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quantity: 2,
          inventoryItemId: 'frame-item',
          outputDefinitionId: 'out-frame',
        }),
      }),
    );
  });

  it('rejects WIP shortage without issuing a partial quantity', async () => {
    const applyMovement = jest.fn();
    const tx = {
      productionTask: { count: jest.fn().mockResolvedValue(0) },
      productionOrderWorkflowSnapshotNode: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'snap-uph',
          isSkipped: false,
          inventoryTracking: 'NONE',
          consumesRawMaterials: false,
          consumesSemiFinished: true,
        }),
        findMany: jest.fn().mockResolvedValue([{ outputQtyPerUnit: 1 }]),
      },
      productionOrder: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'po-1',
          quantity: 2,
          product: null,
        }),
      },
      inventoryTransaction: { findFirst: jest.fn().mockResolvedValue(null) },
      inventoryLot: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'lot-1',
            quantity: 1,
            inventoryItemId: 'frame-item',
            warehouseId: 'semi-wh',
            locationId: null,
            status: 'AVAILABLE',
          },
        ]),
        update: jest.fn(),
      },
    };
    const { service: svc } = service(tx, applyMovement);
    await expect(
      svc.onStageTaskComplete({
        productionOrderId: 'po-1',
        stageInstanceId: 'uph-1',
        userId: 'u1',
        tx: tx as never,
      }),
    ).rejects.toMatchObject({ response: { code: 'INSUFFICIENT_SEMI_FINISHED_STOCK' } });
    expect(applyMovement).not.toHaveBeenCalled();
    expect(tx.inventoryLot.update).not.toHaveBeenCalled();
  });

  it('throws WAREHOUSE_CONFIGURATION_REQUIRED instead of creating phantom WIP', async () => {
    const applyMovement = jest.fn();
    const tx = {
      productionTask: { count: jest.fn().mockResolvedValue(0) },
      productionOrderWorkflowSnapshotNode: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'snap-1',
          isSkipped: false,
          inventoryTracking: 'PRODUCES_SEMI_FINISHED',
          consumesRawMaterials: false,
          consumesSemiFinished: false,
          outputQtyPerUnit: 1,
          outputNameEn: 'Frame',
          outputNameAr: 'هيكل',
          outputDefinitionId: null,
          outputInventoryItemId: 'frame-item',
          defaultWarehouseId: null,
        }),
      },
      productionOrder: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'po-1',
          quantity: 1,
          productId: 'p1',
          product: { id: 'p1', nameEn: 'Sofa', nameAr: 'كنبة', nameHe: null, sku: 'S' },
          salesOrderId: null,
          salesOrderLineId: null,
          productDescription: 'Sofa',
        }),
      },
      inventoryLot: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
      },
      warehouse: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      inventoryItem: {
        findUnique: jest.fn().mockResolvedValue({ id: 'frame-item' }),
      },
    };
    const { service: svc } = service(tx, applyMovement);
    await expect(
      svc.onStageTaskComplete({
        productionOrderId: 'po-1',
        stageInstanceId: 'stage-1',
        userId: 'u1',
        tx: tx as never,
      }),
    ).rejects.toMatchObject({ response: { code: 'WAREHOUSE_CONFIGURATION_REQUIRED' } });
    expect(applyMovement).not.toHaveBeenCalled();
    expect(tx.inventoryLot.create).not.toHaveBeenCalled();
  });

  it('returns unused raw material once and refuses more than remaining', async () => {
    const applyMovement = jest.fn().mockResolvedValue({ id: 'ret-1' });
    const tx = {
      inventoryTransaction: {
        findMany: jest.fn().mockResolvedValue([
          { type: 'PRODUCTION_ISSUE', quantity: -10, warehouseId: 'raw-wh' },
          { type: 'PRODUCTION_RETURN', quantity: 0 },
        ]),
      },
      inventoryItem: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'fabric', itemClass: 'RAW_MATERIAL' }),
      },
      warehouse: {
        findUnique: jest.fn().mockResolvedValue({ id: 'raw-wh', type: 'RAW_MATERIALS' }),
        findFirst: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    } as unknown as PrismaService;
    const svc = new ProductionInventoryService(prisma, {
      applyMovement,
    } as unknown as InventoryService);

    await svc.returnUnusedMaterial({
      productionOrderId: 'po-1',
      inventoryItemId: 'fabric',
      quantity: 2,
      userId: 'u1',
      idempotencyKey: 'ret-1',
    });
    expect(applyMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'PRODUCTION_RETURN',
        quantity: 2,
        warehouseId: 'raw-wh',
        idempotencyKey: 'ret-1',
      }),
    );

    tx.inventoryTransaction.findMany.mockResolvedValue([
      { type: 'PRODUCTION_ISSUE', quantity: -10, warehouseId: 'raw-wh' },
      { type: 'PRODUCTION_RETURN', quantity: 2, warehouseId: 'raw-wh' },
    ]);
    await expect(
      svc.returnUnusedMaterial({
        productionOrderId: 'po-1',
        inventoryItemId: 'fabric',
        quantity: 11,
        userId: 'u1',
      }),
    ).rejects.toMatchObject({ response: { code: 'INSUFFICIENT_STOCK' } });
  });

  it('uses snapshotted output qty even if the live product row would differ', async () => {
    const applyMovement = jest.fn().mockResolvedValue({ id: 'tx-1' });
    const tx = {
      productionTask: { count: jest.fn().mockResolvedValue(0) },
      productionOrderWorkflowSnapshotNode: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'snap-1',
          isSkipped: false,
          inventoryTracking: 'PRODUCES_SEMI_FINISHED',
          consumesRawMaterials: false,
          consumesSemiFinished: false,
          outputQtyPerUnit: 1,
          outputNameEn: 'Frame',
          outputInventoryItemId: 'frame-item',
          defaultWarehouseId: null,
        }),
      },
      productionOrder: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'po-a',
          quantity: 1,
          productId: 'p1',
          product: { id: 'p1', sku: 'S', nameEn: 'Sofa', nameAr: 'كنبة', nameHe: null },
          salesOrderId: null,
          salesOrderLineId: null,
          productDescription: 'Sofa',
        }),
      },
      inventoryLot: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'lot' }),
      },
      warehouse: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue({ id: 'semi-wh', type: 'SEMI_FINISHED', isActive: true }),
      },
      inventoryItem: {
        findUnique: jest.fn().mockResolvedValue({ id: 'frame-item' }),
      },
      productStageInventoryOutput: {
        findMany: jest.fn().mockResolvedValue([{ outputQtyPerUnit: 2 }]),
      },
    };
    const { service: svc } = service(tx, applyMovement);
    await svc.onStageTaskComplete({
      productionOrderId: 'po-a',
      stageInstanceId: 'stage-1',
      userId: 'u1',
      tx: tx as never,
    });
    expect(applyMovement).toHaveBeenCalledWith(expect.objectContaining({ quantity: 1 }));
    expect(tx.productStageInventoryOutput.findMany).not.toHaveBeenCalled();
  });

  it('requires both snapshotted WIP inputs and does not partially issue', async () => {
    const applyMovement = jest.fn();
    const tx = {
      productionTask: { count: jest.fn().mockResolvedValue(0) },
      productionOrderWorkflowSnapshotNode: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'snap-uph',
          isSkipped: false,
          inventoryTracking: 'NONE',
          consumesRawMaterials: false,
          consumesSemiFinished: true,
          consumeInventoryItemIds: ['frame-item', 'kit-item'],
        }),
        findMany: jest.fn().mockImplementation(({ where }: { where: { outputInventoryItemId?: { in: string[] } } }) => {
          const ids = where.outputInventoryItemId?.in ?? [];
          return Promise.resolve(
            ids.map((id) => ({
              outputInventoryItemId: id,
              outputQtyPerUnit: 1,
              isSkipped: false,
            })),
          );
        }),
      },
      productionOrder: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'po-1',
          quantity: 1,
          product: null,
        }),
      },
      inventoryTransaction: { findFirst: jest.fn().mockResolvedValue(null) },
      inventoryLot: {
        findMany: jest.fn().mockImplementation(({ where }: { where: { inventoryItemId?: string } }) => {
          if (where.inventoryItemId === 'frame-item') {
            return Promise.resolve([
              {
                id: 'lot-frame',
                quantity: 1,
                inventoryItemId: 'frame-item',
                warehouseId: 'semi-wh',
                locationId: null,
                status: 'AVAILABLE',
              },
            ]);
          }
          return Promise.resolve([]);
        }),
        update: jest.fn(),
      },
    };
    const { service: svc } = service(tx, applyMovement);
    await expect(
      svc.onStageTaskComplete({
        productionOrderId: 'po-1',
        stageInstanceId: 'uph-1',
        userId: 'u1',
        tx: tx as never,
      }),
    ).rejects.toMatchObject({ response: { code: 'INSUFFICIENT_SEMI_FINISHED_STOCK' } });
    expect(applyMovement).not.toHaveBeenCalled();
    expect(tx.inventoryLot.update).not.toHaveBeenCalled();
  });
});
