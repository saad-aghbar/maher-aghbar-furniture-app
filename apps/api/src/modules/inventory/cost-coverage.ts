import { positiveUnitCost } from './issue-unit-cost';

export type PricedReceipt = {
  inventoryItemId: string;
  unitCost: unknown;
};

export type CoverageItem = {
  id: string;
  sku: string;
  standardCost: unknown;
};

export function receiptPriceByItem(receipts: PricedReceipt[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of receipts) {
    const cost = positiveUnitCost(row.unitCost);
    if (cost == null) continue;
    if (!map.has(row.inventoryItemId)) map.set(row.inventoryItemId, cost);
  }
  return map;
}

export function applyReceiptPrices<T extends CoverageItem>(items: T[], prices: Map<string, number>) {
  const priced: Array<{ id: string; sku: string; standardCost: number }> = [];
  const stillUnpriced: Array<{ id: string; sku: string }> = [];
  for (const item of items) {
    const existing = positiveUnitCost(item.standardCost);
    if (existing != null) continue;
    const fromReceipt = prices.get(item.id);
    if (fromReceipt != null) {
      priced.push({ id: item.id, sku: item.sku, standardCost: fromReceipt });
    } else {
      stillUnpriced.push({ id: item.id, sku: item.sku });
    }
  }
  return { priced, stillUnpriced };
}

export function coverageSummary(totalItems: number, pricedItems: number) {
  return {
    totalItems,
    pricedItems,
    unpricedItems: Math.max(0, totalItems - pricedItems),
    coveragePct: totalItems > 0 ? Math.round((pricedItems / totalItems) * 1000) / 10 : 0,
  };
}
