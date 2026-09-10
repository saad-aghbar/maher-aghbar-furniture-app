import { resolveInventoryCostLinks } from './inventory-cost-links';

describe('resolveInventoryCostLinks', () => {
  it('keeps explicit FKs', async () => {
    const tx = {
      productionTask: { findUnique: jest.fn() },
      productionOrder: { findUnique: jest.fn() },
    };
    await expect(
      resolveInventoryCostLinks(tx as never, {
        productionTaskId: 'task-1',
        productionOrderId: 'po-1',
        salesOrderId: 'so-1',
      }),
    ).resolves.toEqual({
      productionTaskId: 'task-1',
      productionOrderId: 'po-1',
      salesOrderId: 'so-1',
    });
    expect(tx.productionTask.findUnique).not.toHaveBeenCalled();
  });

  it('fills PO and SO from a ProductionTask reference', async () => {
    const tx = {
      productionTask: {
        findUnique: jest.fn(async () => ({
          productionOrderId: 'po-1',
          productionOrder: { salesOrderId: 'so-1' },
        })),
      },
      productionOrder: { findUnique: jest.fn() },
    };
    await expect(
      resolveInventoryCostLinks(tx as never, {
        referenceType: 'ProductionTask',
        referenceId: 'task-1',
      }),
    ).resolves.toEqual({
      productionTaskId: 'task-1',
      productionOrderId: 'po-1',
      salesOrderId: 'so-1',
    });
  });

  it('fills SO from a ProductionOrder reference', async () => {
    const tx = {
      productionTask: { findUnique: jest.fn() },
      productionOrder: {
        findUnique: jest.fn(async () => ({ salesOrderId: 'so-9' })),
      },
    };
    await expect(
      resolveInventoryCostLinks(tx as never, {
        referenceType: 'ProductionOrder',
        referenceId: 'po-9',
      }),
    ).resolves.toEqual({
      productionTaskId: undefined,
      productionOrderId: 'po-9',
      salesOrderId: 'so-9',
    });
  });
});
