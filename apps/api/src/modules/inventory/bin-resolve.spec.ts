import { pickBinsForIssue, warehouseStockFromBalances } from './bin-resolve';

describe('warehouseStockFromBalances', () => {
  it('sums every bin in the warehouse', () => {
    expect(
      warehouseStockFromBalances([
        { availableQty: 5, reservedQty: 1 },
        { availableQty: 3, reservedQty: 0 },
      ]),
    ).toEqual({ available: 8, reserved: 1, free: 7 });
  });
});

describe('pickBinsForIssue', () => {
  it('returns the named bin when locationId is set', async () => {
    const db = {
      warehouseLocation: {
        findFirst: jest.fn(async () => ({ id: 'loc-a', warehouseId: 'wh-1' })),
      },
    };
    await expect(
      pickBinsForIssue(db as never, {
        inventoryItemId: 'item-1',
        warehouseId: 'wh-1',
        quantity: 4,
        locationId: 'loc-a',
      }),
    ).resolves.toEqual([{ locationId: 'loc-a', warehouseId: 'wh-1', quantity: 4 }]);
  });

  it('draws across bins by available qty descending', async () => {
    const db = {
      inventoryBalance: {
        findMany: jest.fn(async () => [
          { locationId: 'a', availableQty: 3 },
          { locationId: 'b', availableQty: 10 },
        ]),
      },
    };
    db.inventoryBalance.findMany = jest.fn(async () => [
      { locationId: 'b', availableQty: 10 },
      { locationId: 'a', availableQty: 3 },
    ]);
    await expect(
      pickBinsForIssue(db as never, {
        inventoryItemId: 'item-1',
        warehouseId: 'wh-1',
        quantity: 12,
      }),
    ).resolves.toEqual([
      { locationId: 'b', warehouseId: 'wh-1', quantity: 10 },
      { locationId: 'a', warehouseId: 'wh-1', quantity: 2 },
    ]);
  });
});
