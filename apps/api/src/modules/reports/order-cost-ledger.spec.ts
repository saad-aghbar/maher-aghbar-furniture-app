import {
  actualMaterialFromTransactions,
  averagePerUnit,
  coverageStatus,
  costVariance,
  marginFrom,
  saleValueFromSubtotals,
  skuLedgerFromTransactions,
} from './order-cost-ledger';

describe('order-cost-ledger', () => {
  it('computes issue minus return and never treats missing cost as zero', () => {
    const result = actualMaterialFromTransactions([
      { type: 'PRODUCTION_ISSUE', quantity: -10, unitCost: 8 },
      { type: 'PRODUCTION_ISSUE', quantity: -4, unitCost: null },
      { type: 'PRODUCTION_RETURN', quantity: 2, unitCost: 8 },
    ]);
    expect(result.actualCost).toBe(64);
    expect(result.returnCredit).toBe(16);
    expect(result.issueCount).toBe(2);
    expect(result.costedIssueCount).toBe(1);
    expect(result.coverage).toBe('PARTIAL');
  });

  it('stays null when every issue is unpriced', () => {
    expect(
      actualMaterialFromTransactions([{ type: 'PRODUCTION_ISSUE', quantity: -3, unitCost: 0 }]),
    ).toMatchObject({ actualCost: null, coverage: 'UNPRICED' });
  });

  it('is FINAL only when every issue carries a real unit cost', () => {
    expect(coverageStatus(3, 3)).toBe('FINAL');
    expect(coverageStatus(1, 3)).toBe('PARTIAL');
    expect(coverageStatus(0, 2)).toBe('UNPRICED');
    expect(coverageStatus(0, 0)).toBe('UNPRICED');
  });

  it('prefers invoice subtotal for sale value', () => {
    expect(saleValueFromSubtotals(100, 90)).toBe(100);
    expect(saleValueFromSubtotals(null, 90)).toBe(90);
    expect(saleValueFromSubtotals(0, 0)).toBeNull();
  });

  it('keeps margin incomplete when cost is missing or coverage is incomplete', () => {
    expect(marginFrom(100, null)).toMatchObject({ grossMargin: null, incomplete: true });
    expect(marginFrom(200, 50)).toMatchObject({ grossMargin: 150, marginPct: 75, incomplete: false });
    expect(marginFrom(200, 100, false)).toMatchObject({ grossMargin: null, incomplete: true });
    expect(marginFrom(200, 140, true)).toMatchObject({ grossMargin: 60, marginPct: 30 });
  });

  it('shows average per unit instead of inventing per-piece cost', () => {
    expect(averagePerUnit(80, 2)).toBe(40);
    expect(averagePerUnit(80, 1)).toBe(80);
    expect(averagePerUnit(null, 2)).toBeNull();
  });

  it('variance is actual minus planned and null when either side is missing', () => {
    expect(costVariance(100, 120)).toBe(20);
    expect(costVariance(100, 80)).toBe(-20);
    expect(costVariance(null, 80)).toBeNull();
    expect(costVariance(100, null)).toBeNull();
  });

  it('rolls usage per SKU without netting unpriced issues to zero', () => {
    const rows = skuLedgerFromTransactions([
      { type: 'PRODUCTION_ISSUE', quantity: -5, unitCost: 10, inventoryItemId: 'a', sku: 'WOOD' },
      { type: 'PRODUCTION_ISSUE', quantity: -2, unitCost: null, inventoryItemId: 'a', sku: 'WOOD' },
      { type: 'PRODUCTION_RETURN', quantity: 1, unitCost: 10, inventoryItemId: 'a', sku: 'WOOD' },
    ]);
    expect(rows).toEqual([
      {
        inventoryItemId: 'a',
        sku: 'WOOD',
        issuedQty: 7,
        returnedQty: 1,
        netQty: 6,
        actualCost: 40,
        costedIssueQty: 5,
        unpricedIssueQty: 2,
      },
    ]);
  });
});
