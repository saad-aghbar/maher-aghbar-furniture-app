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
            { id: 'po-1', quantity: 2 },
            { id: 'po-2', quantity: 1 },
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
        plannedCostBreakdown: { woodCost: 90 },
        plannedCostFrozenAt: frozenAt,
      },
    });
    expect(tx.productionOrder.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'po-2' },
      data: {
        plannedMaterialCost: 30,
        plannedCostBreakdown: { woodCost: 90 },
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
});
