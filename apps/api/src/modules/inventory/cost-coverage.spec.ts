import { applyReceiptPrices, coverageSummary, receiptPriceByItem } from './cost-coverage';

describe('cost-coverage', () => {
  it('takes the first real receipt price per item and ignores zeros', () => {
    const prices = receiptPriceByItem([
      { inventoryItemId: 'a', unitCost: 0 },
      { inventoryItemId: 'a', unitCost: 12.5 },
      { inventoryItemId: 'b', unitCost: null },
    ]);
    expect(prices.get('a')).toBe(12.5);
    expect(prices.has('b')).toBe(false);
  });

  it('only fills items that have no standard cost', () => {
    const result = applyReceiptPrices(
      [
        { id: 'a', sku: 'WOOD-1', standardCost: null },
        { id: 'b', sku: 'FOAM-1', standardCost: 4 },
        { id: 'c', sku: 'ACC-1', standardCost: 0 },
      ],
      new Map([
        ['a', 9],
        ['b', 99],
      ]),
    );
    expect(result.priced).toEqual([{ id: 'a', sku: 'WOOD-1', standardCost: 9 }]);
    expect(result.stillUnpriced).toEqual([{ id: 'c', sku: 'ACC-1' }]);
  });

  it('reports coverage without silently treating gaps as priced', () => {
    expect(coverageSummary(86, 42)).toEqual({
      totalItems: 86,
      pricedItems: 42,
      unpricedItems: 44,
      coveragePct: 48.8,
    });
  });
});
