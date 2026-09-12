import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '@maher/types';
import { ManufacturingCostService } from './manufacturing-cost.service';
import type { PrismaService } from '../../common/prisma.service';

function adminUser(perms: string[] = ['inventory.cost.read']): AuthUser {
  return {
    id: 'admin-1',
    username: 'admin',
    email: 'a@x.com',
    name: 'Admin',
    roles: ['ADMIN'],
    permissions: perms,
    preferredLanguage: 'en',
  };
}

function makeService(prisma: Partial<PrismaService>) {
  return new ManufacturingCostService(prisma as PrismaService);
}

describe('ManufacturingCostService', () => {
  it('denies dealers and workers without inventory.cost.read', () => {
    const svc = makeService({});
    expect(() =>
      svc.assertCanReadCost({
        ...adminUser([]),
        customerId: 'cust-1',
        roles: ['CUSTOMER'],
      }),
    ).toThrow(ForbiddenException);
    expect(() => svc.assertCanReadCost(adminUser(['production-order.read']))).toThrow(
      ForbiddenException,
    );
  });

  it('preserves estimated when actual exists; computes variance', async () => {
    const finalizedAt = new Date('2026-01-15T12:00:00Z');
    const prisma = {
      productionOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'po-1',
          number: 'PO-1',
          status: 'IN_PROGRESS',
          quantity: 1,
          salesOrderId: 'so-1',
          salesOrderLineId: 'line-1',
          product: { nameEn: 'Sofa' },
        }),
      },
      salesOrderLineSetup: {
        findUnique: jest.fn().mockResolvedValue({
          salesOrderLine: { quantity: 1 },
          materialRequirements: [
            {
              sku: 'FAB-1',
              displayName: 'Velvet',
              category: 'FABRIC',
              expectedQty: 10,
              inventoryItem: { sku: 'FAB-1', nameEn: 'Velvet', category: 'FABRIC' },
            },
          ],
        }),
      },
      productionTaskMaterialUsage: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'u1',
            productionOrderId: 'po-1',
            taskId: 't1',
            sku: 'FAB-1',
            expectedQty: 10,
            actualQty: 12,
            returnedQty: 0,
            scrapQty: 0,
            unitCost: 5,
            extendedCost: 60,
            valuedAt: finalizedAt,
            finalizedAt,
            inventoryItem: { nameEn: 'Velvet', category: 'FABRIC', itemClass: 'RAW_MATERIAL' },
            task: {
              isRework: false,
              stageDefinition: { code: 'CUT' },
              assignedEmployee: { firstName: 'A', lastName: 'B', username: 'carpenter' },
            },
          },
        ]),
      },
      inventoryItem: {
        findMany: jest.fn().mockResolvedValue([{ sku: 'FAB-1', standardCost: 5 }]),
      },
      inventoryTransaction: { findMany: jest.fn().mockResolvedValue([]) },
      salesOrderLineMaterialRequirement: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const payload = await makeService(prisma as never).forProductionOrder('po-1', adminUser());
    expect(payload.estimated.total).toBe(50);
    expect(payload.actual.total).toBe(60);
    expect(payload.variance.cost).toBe(10);
    expect(payload.status).toBe('IN_PROGRESS');
    expect(payload.bySku[0]?.plannedQty).toBe(10);
    expect(payload.bySku[0]?.costedQty).toBe(12);
  });

  it('nets returns and charges scrap in costedQty', async () => {
    const finalizedAt = new Date();
    const prisma = {
      productionOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'po-1',
          number: 'PO-1',
          status: 'IN_PROGRESS',
          quantity: 1,
          salesOrderId: 'so-1',
          salesOrderLineId: null,
          product: { nameEn: 'X' },
        }),
      },
      productionTaskMaterialUsage: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'u1',
            productionOrderId: 'po-1',
            taskId: 't1',
            sku: 'WOOD-1',
            expectedQty: 8,
            actualQty: 8,
            returnedQty: 2,
            scrapQty: 1,
            unitCost: 10,
            // costed = 8+1-2 = 7 → 70
            extendedCost: 70,
            valuedAt: finalizedAt,
            finalizedAt,
            inventoryItem: { nameEn: 'Beech', category: 'WOOD', itemClass: 'RAW_MATERIAL' },
            task: { isRework: false, stageDefinition: { code: 'FRAME' }, assignedEmployee: null },
          },
        ]),
      },
      inventoryItem: { findMany: jest.fn().mockResolvedValue([]) },
      inventoryTransaction: { findMany: jest.fn().mockResolvedValue([]) },
      salesOrderLineMaterialRequirement: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const payload = await makeService(prisma as never).forProductionOrder('po-1', adminUser());
    const row = payload.bySku[0]!;
    expect(row.costedQty).toBe(7);
    expect(row.scrapQty).toBe(1);
    expect(row.returnedQty).toBe(2);
    expect(row.actualCost).toBe(70);
    expect(payload.actual.scrapCost).toBe(10);
    expect(payload.actual.returnCredit).toBe(20);
  });

  it('marks INCOMPLETE when consumed qty has null unitCost — never invents 0', async () => {
    const finalizedAt = new Date();
    const prisma = {
      productionOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'po-1',
          number: 'PO-1',
          status: 'COMPLETED',
          quantity: 1,
          salesOrderId: 'so-1',
          salesOrderLineId: null,
          product: { nameEn: 'X' },
        }),
      },
      productionTaskMaterialUsage: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'u1',
            productionOrderId: 'po-1',
            taskId: 't1',
            sku: 'ZERO',
            expectedQty: 1,
            actualQty: 1,
            returnedQty: 0,
            scrapQty: 0,
            unitCost: null,
            extendedCost: null,
            valuedAt: null,
            finalizedAt,
            inventoryItem: { nameEn: 'No cost', category: 'OTHER', itemClass: 'RAW_MATERIAL' },
            task: { isRework: false, stageDefinition: { code: 'CUT' }, assignedEmployee: null },
          },
        ]),
      },
      inventoryItem: { findMany: jest.fn().mockResolvedValue([{ sku: 'ZERO', standardCost: 0 }]) },
      inventoryTransaction: { findMany: jest.fn().mockResolvedValue([]) },
      salesOrderLineMaterialRequirement: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const payload = await makeService(prisma as never).forProductionOrder('po-1', adminUser());
    expect(payload.status).toBe('INCOMPLETE');
    expect(payload.incomplete).toBe(true);
    expect(payload.actual.total).toBeNull();
    expect(payload.bySku[0]?.actualCost).toBeNull();
    expect(payload.bySku[0]?.costAvailable).toBe(false);
    expect(payload.incompleteSkus.some((s) => s.sku === 'ZERO')).toBe(true);
  });

  it('FINAL when PO COMPLETED and all usages valued', async () => {
    const finalizedAt = new Date('2026-02-01T00:00:00Z');
    const prisma = {
      productionOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'po-1',
          number: 'PO-1',
          status: 'COMPLETED',
          quantity: 1,
          salesOrderId: 'so-1',
          salesOrderLineId: null,
          product: { nameEn: 'X' },
        }),
      },
      productionTaskMaterialUsage: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'u1',
            productionOrderId: 'po-1',
            taskId: 't1',
            sku: 'FAB-1',
            expectedQty: 5,
            actualQty: 5,
            returnedQty: 0,
            scrapQty: 0,
            unitCost: 4,
            extendedCost: 20,
            valuedAt: finalizedAt,
            finalizedAt,
            inventoryItem: { nameEn: 'F', category: 'FABRIC', itemClass: 'RAW_MATERIAL' },
            task: { isRework: false, stageDefinition: { code: 'CUT' }, assignedEmployee: null },
          },
        ]),
      },
      inventoryItem: { findMany: jest.fn().mockResolvedValue([]) },
      inventoryTransaction: { findMany: jest.fn().mockResolvedValue([]) },
      salesOrderLineMaterialRequirement: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const payload = await makeService(prisma as never).forProductionOrder('po-1', adminUser());
    expect(payload.status).toBe('FINAL');
    expect(payload.finalizedAt).toBe(finalizedAt.toISOString());
    expect(payload.actual.total).toBe(20);
  });

  it('uses stored extendedCost after FINAL even if live map would differ', async () => {
    const finalizedAt = new Date();
    const prisma = {
      productionOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'po-1',
          number: 'PO-1',
          status: 'READY_FOR_DELIVERY',
          quantity: 1,
          salesOrderId: 'so-1',
          salesOrderLineId: null,
          product: { nameEn: 'X' },
        }),
      },
      productionTaskMaterialUsage: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'u1',
            productionOrderId: 'po-1',
            taskId: 't1',
            sku: 'FAB-1',
            expectedQty: 2,
            actualQty: 2,
            returnedQty: 0,
            scrapQty: 0,
            unitCost: 3,
            extendedCost: 6,
            valuedAt: finalizedAt,
            finalizedAt,
            inventoryItem: { nameEn: 'F', category: 'FABRIC', itemClass: 'RAW_MATERIAL' },
            task: { isRework: false, stageDefinition: { code: 'CUT' }, assignedEmployee: null },
          },
        ]),
      },
      // Live map would say 99 — must not change actual
      inventoryItem: {
        findMany: jest.fn().mockResolvedValue([{ sku: 'FAB-1', standardCost: 99 }]),
      },
      inventoryTransaction: { findMany: jest.fn().mockResolvedValue([]) },
      salesOrderLineMaterialRequirement: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const payload = await makeService(prisma as never).forProductionOrder('po-1', adminUser());
    expect(payload.status).toBe('FINAL');
    expect(payload.actual.total).toBe(6);
    expect(payload.bySku[0]?.unitCost).toBe(3);
  });

  it('includes rework usage once with REWORK origin', async () => {
    const finalizedAt = new Date();
    const prisma = {
      productionOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'po-1',
          number: 'PO-1',
          status: 'IN_PROGRESS',
          quantity: 1,
          salesOrderId: 'so-1',
          salesOrderLineId: null,
          product: { nameEn: 'X' },
        }),
      },
      productionTaskMaterialUsage: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'u1',
            productionOrderId: 'po-1',
            taskId: 't-orig',
            sku: 'FAB-1',
            expectedQty: 5,
            actualQty: 5,
            returnedQty: 0,
            scrapQty: 0,
            unitCost: 2,
            extendedCost: 10,
            valuedAt: finalizedAt,
            finalizedAt,
            inventoryItem: { nameEn: 'F', category: 'FABRIC', itemClass: 'RAW_MATERIAL' },
            task: { isRework: false, stageDefinition: { code: 'CUT' }, assignedEmployee: null },
          },
          {
            id: 'u2',
            productionOrderId: 'po-1',
            taskId: 't-rw',
            sku: 'FAB-1',
            expectedQty: 0,
            actualQty: 1,
            returnedQty: 0,
            scrapQty: 0,
            unitCost: 2,
            extendedCost: 2,
            valuedAt: finalizedAt,
            finalizedAt,
            inventoryItem: { nameEn: 'F', category: 'FABRIC', itemClass: 'RAW_MATERIAL' },
            task: { isRework: true, stageDefinition: { code: 'CUT' }, assignedEmployee: null },
          },
        ]),
      },
      inventoryItem: { findMany: jest.fn().mockResolvedValue([]) },
      inventoryTransaction: { findMany: jest.fn().mockResolvedValue([]) },
      salesOrderLineMaterialRequirement: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const payload = await makeService(prisma as never).forProductionOrder('po-1', adminUser());
    expect(payload.actual.total).toBe(12);
    expect(payload.actual.reworkCost).toBe(2);
    expect(payload.bySku[0]?.origin).toBe('MIXED');
  });

  it('ignores SEMI/FIN — RAW query only (no double-count)', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      productionOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'po-1',
          number: 'PO-1',
          status: 'IN_PROGRESS',
          quantity: 1,
          salesOrderId: 'so-1',
          salesOrderLineId: null,
          product: { nameEn: 'X' },
        }),
      },
      productionTaskMaterialUsage: { findMany },
      inventoryItem: { findMany: jest.fn().mockResolvedValue([]) },
      inventoryTransaction: { findMany: jest.fn().mockResolvedValue([]) },
      salesOrderLineMaterialRequirement: { findMany: jest.fn().mockResolvedValue([]) },
    };

    await makeService(prisma as never).forProductionOrder('po-1', adminUser());
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          inventoryItem: { itemClass: 'RAW_MATERIAL' },
        }),
      }),
    );
  });

  it('SEMI handoff does not add manufacturing cost (no RAW usage → actual 0)', async () => {
    const prisma = {
      productionOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'po-p8',
          number: 'PO-P8-C',
          status: 'IN_PROGRESS',
          quantity: 1,
          salesOrderId: 'so-p8',
          salesOrderLineId: null,
          product: { nameEn: 'Sofa' },
        }),
      },
      // SEMI receive creates WipHandoff / lot moves — never ProductionTaskMaterialUsage rows.
      productionTaskMaterialUsage: { findMany: jest.fn().mockResolvedValue([]) },
      inventoryItem: { findMany: jest.fn().mockResolvedValue([]) },
      salesOrderLineMaterialRequirement: { findMany: jest.fn().mockResolvedValue([]) },
      inventoryTransaction: {
        findMany: jest.fn().mockResolvedValue([
          {
            type: 'SEMI_FINISHED_RECEIPT',
            quantity: 1,
            inventoryItem: { itemClass: 'SEMI_FINISHED_GOOD', sku: 'FRAME-1' },
          },
        ]),
      },
    };

    const payload = await makeService(prisma as never).forProductionOrder('po-p8', adminUser());
    expect(payload.actual.total).toBeNull();
    expect(payload.bySku).toEqual([]);
    expect(prisma.productionTaskMaterialUsage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          inventoryItem: { itemClass: 'RAW_MATERIAL' },
        }),
      }),
    );
  });

  it('values draft usage from the live map so actual/variance update during production', async () => {
    const prisma = {
      productionOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'po-1',
          number: 'PO-1',
          status: 'IN_PROGRESS',
          quantity: 1,
          salesOrderId: 'so-1',
          salesOrderLineId: 'line-1',
          product: { nameEn: 'Sofa' },
        }),
      },
      salesOrderLineSetup: {
        findUnique: jest.fn().mockResolvedValue({
          salesOrderLine: { quantity: 1 },
          materialRequirements: [
            {
              sku: 'FAB-1',
              displayName: 'Velvet',
              category: 'FABRIC',
              expectedQty: 10,
              inventoryItem: { sku: 'FAB-1', nameEn: 'Velvet', category: 'FABRIC' },
            },
          ],
        }),
      },
      productionTaskMaterialUsage: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'u1',
            productionOrderId: 'po-1',
            taskId: 't1',
            sku: 'FAB-1',
            expectedQty: 10,
            actualQty: 8,
            returnedQty: 0,
            scrapQty: 0,
            unitCost: null,
            extendedCost: null,
            valuedAt: null,
            finalizedAt: null,
            inventoryItem: { nameEn: 'Velvet', category: 'FABRIC', itemClass: 'RAW_MATERIAL' },
            task: {
              isRework: false,
              stageDefinition: { code: 'CUT' },
              assignedEmployee: null,
            },
          },
        ]),
      },
      inventoryItem: {
        findMany: jest.fn().mockResolvedValue([{ sku: 'FAB-1', standardCost: 5 }]),
      },
      inventoryTransaction: { findMany: jest.fn().mockResolvedValue([]) },
      salesOrderLineMaterialRequirement: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const payload = await makeService(prisma as never).forProductionOrder('po-1', adminUser());
    expect(payload.status).toBe('IN_PROGRESS');
    expect(payload.estimated.total).toBe(50);
    expect(payload.actual.total).toBe(40);
    expect(payload.actual.toDate).toBe(40);
    expect(payload.variance.cost).toBe(-10);
    expect(payload.bySku[0]?.costedQty).toBe(8);
    expect(payload.bySku[0]?.actualCost).toBe(40);
    expect(payload.incomplete).toBe(false);
  });

  it('estimates a return work order from production-order material requirements', async () => {
    const prisma = {
      productionOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'rw-1',
          number: 'RW-1',
          status: 'PLANNED',
          quantity: 1,
          salesOrderId: null,
          salesOrderLineId: null,
          product: null,
        }),
      },
      productionTaskMaterialUsage: { findMany: jest.fn().mockResolvedValue([]) },
      salesOrderLineMaterialRequirement: {
        findMany: jest.fn().mockResolvedValue([
          {
            sku: 'FAB-R',
            displayName: 'Rework velvet',
            category: 'FABRIC',
            expectedQty: 4,
            inventoryItem: { sku: 'FAB-R', nameEn: 'Rework velvet', category: 'FABRIC' },
          },
        ]),
      },
      inventoryItem: {
        findMany: jest.fn().mockResolvedValue([{ sku: 'FAB-R', standardCost: 12 }]),
      },
      inventoryTransaction: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const payload = await makeService(prisma as never).forProductionOrder('rw-1', adminUser());
    expect(payload.estimated.total).toBe(48);
    expect(payload.actual.total).toBeNull();
    expect(payload.bySku[0]?.plannedQty).toBe(4);
    expect(payload.status).toBe('ESTIMATED_ONLY');
  });

  it('sums return work-order costs onto the return detail block', async () => {
    const svc = makeService({
      returnRequest: {
        findUnique: jest.fn().mockResolvedValue({ chargeAmount: 0 }),
      },
      productionOrder: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'rw-1', originType: 'RETURN_WORK', returnPieceId: 'p1' },
          { id: 'rw-2', originType: 'REPLACEMENT', returnPieceId: 'p2' },
        ]),
      },
      returnRecoveryLine: { findMany: jest.fn().mockResolvedValue([]) },
    } as never);
    jest.spyOn(svc, 'summaryForProductionOrder')
      .mockResolvedValueOnce({
        status: 'IN_PROGRESS',
        incomplete: false,
        estimatedTotal: 40,
        actualTotal: 10,
        varianceCost: -30,
        variancePct: -75,
        scrapCost: 0,
        finalizedAt: null,
      })
      .mockResolvedValueOnce({
        status: 'ESTIMATED_ONLY',
        incomplete: false,
        estimatedTotal: 20,
        actualTotal: null,
        varianceCost: null,
        variancePct: null,
        scrapCost: 0,
        finalizedAt: null,
      });

    const block = await svc.summaryForReturn('ret-1', adminUser());
    expect(block).toEqual({
      status: 'IN_PROGRESS',
      estimatedTotal: 60,
      actualTotal: 10,
      laborCost: null,
      repairCost: 10,
      replacementCost: null,
      recoveryCost: null,
      recoveredValue: null,
      disposedValue: null,
      factoryAbsorbed: 10,
    });
  });

  it('rolls actual labor per worker rate into the manufacturing payload', async () => {
    const finalizedAt = new Date('2026-01-15T12:00:00Z');
    const prisma = {
      productionOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'po-1',
          number: 'PO-1',
          status: 'IN_PROGRESS',
          quantity: 1,
          salesOrderId: 'so-1',
          salesOrderLineId: 'line-1',
          productId: 'p1',
          variantId: null,
          product: { nameEn: 'Sofa' },
        }),
        findMany: jest.fn().mockResolvedValue([
          { id: 'po-1', productId: 'p1', variantId: null, quantity: 1 },
        ]),
      },
      productionTask: {
        findMany: jest.fn().mockResolvedValue([
          { id: 't1', stageDefinitionId: 'uph', stageDefinition: { code: 'UPH' } },
        ]),
      },
      laborRate: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'a', hourlyRate: 20, effectiveFrom: new Date('2026-01-01'), effectiveTo: null },
          { userId: 'b', hourlyRate: 40, effectiveFrom: new Date('2026-01-01'), effectiveTo: null },
        ]),
      },
      taskTimeEntry: {
        findMany: jest.fn().mockResolvedValue([
          { taskId: 't1', userId: 'a', minutes: 60, startedAt: new Date('2026-01-03'), endedAt: null },
          { taskId: 't1', userId: 'b', minutes: 30, startedAt: new Date('2026-01-03'), endedAt: null },
        ]),
      },
      productStageEstimate: { findMany: jest.fn().mockResolvedValue([]) },
      salesOrderLineSetup: {
        findUnique: jest.fn().mockResolvedValue({
          salesOrderLine: { quantity: 1 },
          materialRequirements: [
            {
              sku: 'FAB-1',
              displayName: 'Velvet',
              category: 'FABRIC',
              expectedQty: 10,
              inventoryItem: { sku: 'FAB-1', nameEn: 'Velvet', category: 'FABRIC' },
            },
          ],
        }),
      },
      productionTaskMaterialUsage: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'u1',
            productionOrderId: 'po-1',
            taskId: 't1',
            sku: 'FAB-1',
            expectedQty: 10,
            actualQty: 10,
            returnedQty: 0,
            scrapQty: 0,
            unitCost: 10,
            extendedCost: 100,
            valuedAt: finalizedAt,
            finalizedAt,
            inventoryItem: { nameEn: 'Velvet', category: 'FABRIC', itemClass: 'RAW_MATERIAL' },
            task: {
              isRework: false,
              stageDefinition: { code: 'CUT' },
              assignedEmployee: { firstName: 'A', lastName: 'B', username: 'carpenter' },
            },
          },
        ]),
      },
      inventoryItem: {
        findMany: jest.fn().mockResolvedValue([{ sku: 'FAB-1', standardCost: 10 }]),
      },
      inventoryTransaction: { findMany: jest.fn().mockResolvedValue([]) },
      salesOrderLineMaterialRequirement: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const payload = await makeService(prisma as never).forProductionOrder('po-1', adminUser());
    expect(payload.actual.total).toBe(140);
    expect(payload.actual.materials).toBe(100);
    expect(payload.actual.labor).toBe(40);
    expect(payload.labor?.actual).toBe(40);
    expect(payload.labor?.byWorker).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: 'a', actual: 20 }),
        expect.objectContaining({ userId: 'b', actual: 20 }),
      ]),
    );
  });

  it('makes estimated.total all-in from materials plus stage-estimate labor', async () => {
    const prisma = {
      productionOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'po-1',
          number: 'PO-1',
          status: 'PLANNED',
          quantity: 1,
          salesOrderId: 'so-1',
          salesOrderLineId: 'line-1',
          productId: 'p1',
          variantId: null,
          product: { nameEn: 'Sofa' },
        }),
        findMany: jest.fn().mockResolvedValue([
          { id: 'po-1', productId: 'p1', variantId: null, quantity: 1 },
        ]),
      },
      productionTask: { findMany: jest.fn().mockResolvedValue([]) },
      laborRate: {
        findMany: jest.fn().mockResolvedValue([
          {
            stageDefinitionId: 'uph',
            hourlyRate: 30,
            effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
            effectiveTo: null,
          },
        ]),
      },
      taskTimeEntry: { findMany: jest.fn().mockResolvedValue([]) },
      productStageEstimate: {
        findMany: jest.fn().mockResolvedValue([
          {
            productId: 'p1',
            variantId: null,
            stageDefinitionId: 'uph',
            quantityScalingMode: 'LINEAR',
            setupMinutes: 0,
            minutesPerUnit: 60,
            fixedMinutes: 0,
            batchSize: null,
            batchMinutes: null,
            maxParallelUnits: null,
            stageDefinition: { code: 'UPH' },
          },
        ]),
      },
      salesOrderLineSetup: {
        findUnique: jest.fn().mockResolvedValue({
          salesOrderLine: { quantity: 1 },
          materialRequirements: [
            {
              sku: 'FAB-1',
              displayName: 'Velvet',
              category: 'FABRIC',
              expectedQty: 10,
              inventoryItem: { sku: 'FAB-1', nameEn: 'Velvet', category: 'FABRIC' },
            },
          ],
        }),
      },
      productionTaskMaterialUsage: { findMany: jest.fn().mockResolvedValue([]) },
      inventoryItem: {
        findMany: jest.fn().mockResolvedValue([{ sku: 'FAB-1', standardCost: 5 }]),
      },
      inventoryTransaction: { findMany: jest.fn().mockResolvedValue([]) },
      salesOrderLineMaterialRequirement: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const payload = await makeService(prisma as never).forProductionOrder('po-1', adminUser());
    expect(payload.estimated.materials).toBe(50);
    expect(payload.estimated.labor).toBe(30);
    expect(payload.estimated.total).toBe(80);
    expect(payload.labor?.estimated).toBe(30);
    expect(payload.actual.total).toBeNull();
  });

  it('splits per-item estimates by quantity share so they sum to the order total', async () => {
    const prisma = {
      salesOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'so-1',
          number: 'SO-1',
          lines: [
            {
              id: 'line-1',
              description: 'Sofa',
              quantity: 2,
              productionSetup: {
                manufacturingName: 'Sofa',
                materialRequirements: [
                  {
                    sku: 'FAB-1',
                    displayName: 'Velvet',
                    category: 'FABRIC',
                    expectedQty: 10,
                    inventoryItem: { sku: 'FAB-1', nameEn: 'Velvet', category: 'FABRIC' },
                  },
                ],
              },
            },
          ],
          productionOrders: [
            { id: 'po-1', number: 'PO-1', status: 'PLANNED', quantity: 1, salesOrderLineId: 'line-1' },
            { id: 'po-2', number: 'PO-2', status: 'PLANNED', quantity: 1, salesOrderLineId: 'line-1' },
          ],
        }),
      },
      productionTaskMaterialUsage: { findMany: jest.fn().mockResolvedValue([]) },
      inventoryItem: {
        findMany: jest.fn().mockResolvedValue([{ sku: 'FAB-1', standardCost: 5 }]),
      },
      inventoryTransaction: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const payload = await makeService(prisma as never).forSalesOrder('so-1', adminUser());
    expect(payload.estimated.materials).toBe(100);
    expect(payload.estimated.total).toBe(100);
    expect(payload.lines).toEqual([
      expect.objectContaining({
        salesOrderLineId: 'line-1',
        quantity: 2,
        estimatedTotal: 100,
      }),
    ]);
    const poEstimates = (payload.productionOrders ?? []).map((row) => row.estimatedTotal);
    expect(poEstimates).toEqual([50, 50]);
    expect(poEstimates.reduce((sum, n) => sum + (n ?? 0), 0)).toBe(payload.estimated.total);
  });
});
