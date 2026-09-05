import { BadRequestException } from '@nestjs/common';
import { FabricProcurementService } from './fabric-procurement.service';

describe('fabric take-in rejection', () => {
  function service(opts: {
    taskSoId: string;
    lotSoId: string;
    requirementItemId: string;
    lotItemId: string;
    stageCode?: string;
    requirementStage?: string | null;
  }) {
    const prisma = {
      productionTask: {
        findUnique: jest.fn(async () => ({
          id: 'task-1',
          productionOrderId: 'po-1',
          productionOrder: { id: 'po-1', salesOrderId: opts.taskSoId, salesOrderLineId: 'sol-1' },
          stageDefinition: { code: opts.stageCode ?? 'UPHOLSTERY' },
        })),
      },
      inventoryLot: {
        findFirst: jest.fn(async () => ({
          id: 'lot-1',
          qrCode: 'FB-SOFB1042-001',
          status: 'AVAILABLE',
          remainingQty: 24,
          quantity: 24,
          warehouseId: 'wh-1',
          inventoryItemId: opts.lotItemId,
          salesOrderId: opts.lotSoId,
          fabricProcurementId: 'fp-1',
          inventoryItem: { id: opts.lotItemId, sku: 'FAB-VEL', nameEn: 'Velvet', category: 'FABRIC' },
          fabricProcurement: {
            id: 'fp-1',
            requirement: {
              stageCode: opts.requirementStage ?? 'UPHOLSTERY',
              inventoryItemId: opts.requirementItemId,
              expectedQty: 24,
              requestedFabricLabel: 'Velvet 302',
            },
          },
        })),
      },
      productionTaskMaterialUsage: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };
    const inventory = { applyMovement: jest.fn() };
    const svc = new FabricProcurementService(
      prisma as never,
      {} as never,
      {} as never,
      inventory as never,
      { send: jest.fn() } as never,
    );
    return { svc, prisma, inventory };
  }

  const user = { id: 'user-1', permissions: ['production.material-usage.record'] } as never;

  async function codeOf(fn: () => Promise<unknown>) {
    try {
      await fn();
      throw new Error('expected take-in to reject');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      return (err as BadRequestException).getResponse() as { code: string };
    }
  }

  it('rejects a bundle allocated to another order', async () => {
    const { svc, prisma, inventory } = service({
      taskSoId: 'so-1',
      lotSoId: 'so-other',
      requirementItemId: 'inv-vel',
      lotItemId: 'inv-vel',
    });
    const body = await codeOf(() => svc.takeInLot({ taskId: 'task-1', qrCode: 'FB-OTHER-001', user }));
    expect(body.code).toBe('FABRIC_WRONG_ORDER');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(inventory.applyMovement).not.toHaveBeenCalled();
  });

  it('rejects a bundle whose SKU does not match the requirement', async () => {
    const { svc, prisma } = service({
      taskSoId: 'so-1',
      lotSoId: 'so-1',
      requirementItemId: 'inv-vel',
      lotItemId: 'inv-linen',
    });
    const body = await codeOf(() => svc.takeInLot({ taskId: 'task-1', qrCode: 'FB-SOFB1042-001', user }));
    expect(body.code).toBe('FABRIC_WRONG_RECEIVED');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
