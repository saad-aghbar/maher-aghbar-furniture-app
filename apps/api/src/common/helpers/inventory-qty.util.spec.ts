import { aggregateStockQty, decorateStockQty, withStockQty } from './inventory-qty.util';

describe('inventory qty DTO', () => {
  it('treats stored availableQty as on-hand and freeQty as on-hand minus reserved', () => {
    expect(decorateStockQty({ availableQty: 10, reservedQty: 3 })).toEqual({
      onHandQty: 10,
      reservedQty: 3,
      freeQty: 7,
    });
  });

  it('keeps availableQty on the record for compatibility', () => {
    const row = withStockQty({ availableQty: 4, reservedQty: 4, warehouseId: 'wh' });
    expect(row.availableQty).toBe(4);
    expect(row.freeQty).toBe(0);
    expect(row.onHandQty).toBe(4);
  });

  it('aggregates balances', () => {
    expect(
      aggregateStockQty([
        { availableQty: 5, reservedQty: 1 },
        { availableQty: 2, reservedQty: 0 },
      ]),
    ).toEqual({ onHandQty: 7, reservedQty: 1, freeQty: 6 });
  });
});
