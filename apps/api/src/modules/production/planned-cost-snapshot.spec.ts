import { freezePlannedCostAtRelease } from './planned-cost-snapshot';

describe('freezePlannedCostAtRelease', () => {
  it('writes a one-time snapshot and splits the header across work orders', async () => {
    const tx = {
      salesOrder: {
        findUnique: jest.fn(async () => ({
          manufacturingCost: 90,
          costBreakdown: { woodCost: 90 },
          plannedCostFrozenAt: null,
          productionOrders: [
            { id: 'po-1', quantity: 2, productId: 'p1', variantId: null },
            { id: 'po-2', quantity: 1, productId: 'p1', variantId: null },
          ],
        })),
        update: jest.fn(),
      },
      productionOrder: { update: jest.fn() },
    };

    const frozenAt = await freezePlannedCostAtRelease(tx as never, 'so-1');
    expect(frozenAt).toBeInstanceOf(Date);
    expect(tx.salesOrder.update).toHaveBeenCalledWith({
      where: { id: 'so-1' },
      data: { plannedCostFrozenAt: frozenAt },
    });
    expect(tx.productionOrder.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'po-1' },
      data: {
        plannedMaterialCost: 60,
        plannedLaborCost: null,
        plannedCostBreakdown: { woodCost: 90, labor: null },
        plannedCostFrozenAt: frozenAt,
      },
    });
    expect(tx.productionOrder.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'po-2' },
      data: {
        plannedMaterialCost: 30,
        plannedLaborCost: null,
        plannedCostBreakdown: { woodCost: 90, labor: null },
        plannedCostFrozenAt: frozenAt,
      },
    });
  });

  it('does not rewrite an already frozen snapshot', async () => {
    const frozen = new Date('2026-01-01');
    const tx = {
      salesOrder: {
        findUnique: jest.fn(async () => ({
          manufacturingCost: 10,
          costBreakdown: null,
          plannedCostFrozenAt: frozen,
          productionOrders: [],
        })),
        update: jest.fn(),
      },
      productionOrder: { update: jest.fn() },
    };
    await expect(freezePlannedCostAtRelease(tx as never, 'so-1')).resolves.toEqual(frozen);
    expect(tx.salesOrder.update).not.toHaveBeenCalled();
  });

  it('treats the header as material-only and adds estimated labor on top', async () => {
    const tx = {
      salesOrder: {
        findUnique: jest.fn(async () => ({
          manufacturingCost: 90,
          costBreakdown: { woodCost: 90 },
          plannedCostFrozenAt: null,
          productionOrders: [
            { id: 'po-1', quantity: 2, productId: 'p1', variantId: null },
            { id: 'po-2', quantity: 1, productId: 'p1', variantId: null },
          ],
        })),
        update: jest.fn(),
      },
      productionOrder: { update: jest.fn() },
      laborRate: {
        findMany: jest.fn(async () => [
          {
            stageDefinitionId: 'uph',
            hourlyRate: 30,
            effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
            effectiveTo: null,
          },
        ]),
      },
      productStageEstimate: {
        findMany: jest.fn(async () => [
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
    };

    const frozenAt = await freezePlannedCostAtRelease(tx as never, 'so-1');
    expect(tx.productionOrder.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'po-1' },
      data: {
        plannedMaterialCost: 60,
        plannedLaborCost: 60,
        plannedCostBreakdown: {
          woodCost: 90,
          labor: expect.objectContaining({ estimated: 60 }),
        },
        plannedCostFrozenAt: frozenAt,
      },
    });
    expect(tx.productionOrder.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'po-2' },
      data: {
        plannedMaterialCost: 30,
        plannedLaborCost: 30,
        plannedCostBreakdown: {
          woodCost: 90,
          labor: expect.objectContaining({ estimated: 30 }),
        },
        plannedCostFrozenAt: frozenAt,
      },
    });
  });
});
