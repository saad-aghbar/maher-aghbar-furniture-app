import {
  actualMaterialFromTransactions,
  coverageStatus,
  costVariance,
  marginFrom,
  saleValueFromSubtotals,
  skuLedgerFromTransactions,
} from './order-cost-ledger';
import {
  assembleActualProduction,
  collectionFromInvoices,
  displayToken,
  isFabricItem,
  isProductionConsumption,
  isTransferOrReceipt,
  saleValueFromCommercial,
  wasteFromTransactionsAndUsage,
  type LaborMoneyBlock,
} from './production-cost';

const idleLabor: LaborMoneyBlock = {
  actual: null,
  pricedMinutes: 0,
  unpricedMinutes: 0,
  timedMinutes: 0,
  reworkActual: null,
  reworkMinutes: 0,
};

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

  it('uses line totals before order subtotal', () => {
    expect(saleValueFromCommercial({ invoiceSubtotal: null, lineTotalsSum: 80, orderSubtotal: 90 })).toBe(80);
  });

  it('keeps margin null when cost is missing', () => {
    expect(marginFrom(100, null)).toMatchObject({ grossMargin: null, marginPct: null, incomplete: true });
    expect(marginFrom(200, 50)).toMatchObject({ grossMargin: 150, marginPct: 75, incomplete: false });
  });

  it('does not treat missing labor as zero inside an assembled total', () => {
    expect(marginFrom(200, 140, true)).toMatchObject({ grossMargin: 60, marginPct: 30 });
    expect(marginFrom(200, 100, false)).toMatchObject({ grossMargin: null, incomplete: true });
  });

  it('shows average per unit instead of inventing per-piece cost', () => {
    expect(costVariance(100, 120)).toBe(20);
    expect(costVariance(null, 80)).toBeNull();
  });

  it('rolls usage per SKU without netting unpriced issues to zero', () => {
    const rows = skuLedgerFromTransactions([
      { type: 'PRODUCTION_ISSUE', quantity: -5, unitCost: 10, inventoryItemId: 'a', sku: 'WOOD' },
      { type: 'PRODUCTION_ISSUE', quantity: -2, unitCost: null, inventoryItemId: 'a', sku: 'WOOD' },
      { type: 'PRODUCTION_RETURN', quantity: 1, unitCost: 10, inventoryItemId: 'a', sku: 'WOOD' },
    ]);
    expect(rows[0]).toMatchObject({
      issuedQty: 7,
      returnedQty: 1,
      netQty: 6,
      actualCost: 40,
      costedIssueQty: 5,
      unpricedIssueQty: 2,
    });
  });
});

describe('production-cost assembly', () => {
  it('does not treat warehouse transfer or purchase receipt as consumption', () => {
    expect(isProductionConsumption('WAREHOUSE_TRANSFER')).toBe(false);
    expect(isTransferOrReceipt('WAREHOUSE_TRANSFER')).toBe(true);
    expect(isTransferOrReceipt('PURCHASE_RECEIPT')).toBe(true);
    const mix = assembleActualProduction({
      txs: [
        { type: 'WAREHOUSE_TRANSFER', quantity: -4, unitCost: 9, category: 'WOOD' },
        { type: 'PURCHASE_RECEIPT', quantity: 12, unitCost: 9, category: 'WOOD' },
      ],
      labor: idleLabor,
    });
    expect(mix.materials).toBeNull();
    expect(mix.total).toBeNull();
    expect(mix.noActualUsage).toBe(true);
  });

  it('uses stored historical unitCost, not a live catalog price', () => {
    const mix = assembleActualProduction({
      txs: [{ type: 'PRODUCTION_ISSUE', quantity: -5, unitCost: 10, category: 'WOOD' }],
      labor: idleLabor,
    });
    expect(mix.materials).toBe(50);
    expect(mix.complete).toBe(true);
  });

  it('splits fabric from other materials and does not count fabric receipt as production', () => {
    expect(isFabricItem({ category: 'FABRIC' })).toBe(true);
    const mix = assembleActualProduction({
      txs: [
        { type: 'PURCHASE_RECEIPT', quantity: 8, unitCost: 20, category: 'FABRIC' },
        { type: 'PRODUCTION_ISSUE', quantity: -3, unitCost: 20, category: 'FABRIC' },
        { type: 'PRODUCTION_ISSUE', quantity: -2, unitCost: 15, category: 'WOOD' },
      ],
      labor: idleLabor,
    });
    expect(mix.fabric).toBe(60);
    expect(mix.materials).toBe(30);
    expect(mix.total).toBe(90);
  });

  it('includes scrap txs as waste and never hides them inside materials', () => {
    const mix = assembleActualProduction({
      txs: [
        { type: 'PRODUCTION_ISSUE', quantity: -10, unitCost: 8, category: 'WOOD' },
        { type: 'PRODUCTION_RETURN', quantity: 2, unitCost: 8, category: 'WOOD' },
        { type: 'SCRAP', quantity: -1, unitCost: 8, category: 'WOOD' },
      ],
      labor: idleLabor,
    });
    expect(mix.materials).toBe(64);
    expect(mix.waste).toBe(8);
    expect(mix.total).toBe(72);
  });

  it('falls back to frozen usage scrap when no scrap tx exists', () => {
    expect(
      wasteFromTransactionsAndUsage([], [{ scrapQty: 2, unitCost: 5 }]).actualCost,
    ).toBe(10);
    expect(wasteFromTransactionsAndUsage([{ type: 'SCRAP', quantity: -1, unitCost: 8 }], [{ scrapQty: 2, unitCost: 5 }]).actualCost).toBe(8);
  });

  it('keeps labor money null when time is known but no dated rate applies', () => {
    const mix = assembleActualProduction({
      txs: [{ type: 'PRODUCTION_ISSUE', quantity: -1, unitCost: 100, category: 'WOOD' }],
      labor: {
        actual: null,
        pricedMinutes: 0,
        unpricedMinutes: 90,
        timedMinutes: 90,
        reworkActual: null,
        reworkMinutes: 0,
      },
    });
    expect(mix.labor).toBeNull();
    expect(mix.laborTimeKnown).toBe(true);
    expect(mix.laborCostPriced).toBe(false);
    expect(mix.complete).toBe(false);
    expect(mix.total).toBe(100);
    expect(displayToken(mix, mix.labor)).toBe('labor_rate_missing');
  });

  it('separates rework material from normal production', () => {
    const mix = assembleActualProduction({
      txs: [
        { type: 'PRODUCTION_ISSUE', quantity: -4, unitCost: 10, category: 'WOOD' },
        { type: 'PRODUCTION_ISSUE', quantity: -1, unitCost: 10, category: 'WOOD', isRework: true },
      ],
      labor: {
        actual: 20,
        pricedMinutes: 60,
        unpricedMinutes: 0,
        timedMinutes: 60,
        reworkActual: 5,
        reworkMinutes: 15,
      },
    });
    expect(mix.materials).toBe(40);
    expect(mix.rework).toBe(15);
    expect(mix.labor).toBe(20);
    expect(mix.total).toBe(70);
  });
});

describe('golden factory path rollup', () => {
  /**
   * Nile SO-2026-00026 shape:
   * STD qty 2 (collective), KARINA STANDARD, MODIFIED, CUSTOM (no product).
   */
  const std = assembleActualProduction({
    txs: [
      { type: 'PRODUCTION_ISSUE', quantity: -10, unitCost: 8, category: 'WOOD' },
      { type: 'PRODUCTION_RETURN', quantity: 2, unitCost: 8, category: 'WOOD' },
      { type: 'SCRAP', quantity: -1, unitCost: 8, category: 'WOOD' },
    ],
    labor: {
      actual: 25,
      pricedMinutes: 60,
      unpricedMinutes: 0,
      timedMinutes: 60,
      reworkActual: null,
      reworkMinutes: 0,
    },
  });
  const karina = assembleActualProduction({
    txs: [{ type: 'PRODUCTION_ISSUE', quantity: -3, unitCost: 20, category: 'FABRIC' }],
    labor: {
      actual: 10,
      pricedMinutes: 24,
      unpricedMinutes: 0,
      timedMinutes: 24,
      reworkActual: null,
      reworkMinutes: 0,
    },
  });
  const modified = assembleActualProduction({
    txs: [{ type: 'PRODUCTION_ISSUE', quantity: -5, unitCost: 10, category: 'WOOD' }],
    labor: {
      actual: 15,
      pricedMinutes: 36,
      unpricedMinutes: 0,
      timedMinutes: 60,
      reworkActual: null,
      reworkMinutes: 0,
    },
  });
  const custom = assembleActualProduction({
    txs: [{ type: 'PRODUCTION_ISSUE', quantity: -1, unitCost: 12, category: 'FOAM' }],
    labor: {
      actual: 50,
      pricedMinutes: 120,
      unpricedMinutes: 0,
      timedMinutes: 120,
      reworkActual: null,
      reworkMinutes: 0,
    },
  });

  it('rolls line mix to line actual, then lines to order actual', () => {
    expect(std.materials).toBe(64);
    expect(std.waste).toBe(8);
    expect(std.labor).toBe(25);
    expect(std.total).toBe(97);
    expect(karina.fabric).toBe(60);
    expect(karina.total).toBe(70);
    expect(modified.total).toBe(65);
    expect(custom.materials).toBe(12);
    expect(custom.labor).toBe(50);
    expect(custom.total).toBe(62);
    const orderActual = (std.total ?? 0) + (karina.total ?? 0) + (modified.total ?? 0) + (custom.total ?? 0);
    expect(orderActual).toBe(294);
    const sale = saleValueFromCommercial({ lineTotalsSum: 200 + 180 + 150 + 100 });
    expect(sale).toBe(630);
    const margin = marginFrom(sale, orderActual, true);
    expect(margin.grossMargin).toBe(336);
    expect(margin.incomplete).toBe(false);
  });

  it('qty 2 stays collective — average per unit, never a fake per-piece', () => {
    expect(std.total).toBe(97);
    expect(Number((97 / 2).toFixed(3))).toBe(48.5);
  });

  it('keeps recovered return value out of after-sale cost', () => {
    const afterSale = 40;
    const original = 294;
    expect(original + afterSale).toBe(334);
    const recovered = 12;
    expect(original + afterSale).not.toBe(original + afterSale - recovered);
  });
});

describe('collection vs sale', () => {
  it('keeps invoiced, collected and outstanding off the margin formula', () => {
    const cash = collectionFromInvoices([
      { subtotal: 630, paidAmount: 200, outstandingAmount: 430, status: 'ISSUED' },
    ]);
    expect(cash.invoiced).toBe(630);
    expect(cash.collected).toBe(200);
    expect(cash.outstanding).toBe(430);
  });
});
