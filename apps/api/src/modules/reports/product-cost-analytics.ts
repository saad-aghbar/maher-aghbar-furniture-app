export type ProductOrderHistory = {
  productId: string;
  variantId?: string | null;
  optionKey?: string | null;
  actualCost: number | null;
  workerEffortMinutes: number;
};

export function deriveProductStats(rows: ProductOrderHistory[]) {
  return deriveKeyedStats(
    rows.map((row) => ({ ...row, key: row.productId })),
    (key) => ({ productId: key }),
  );
}

export function deriveKeyedStats<TExtra extends Record<string, unknown>>(
  rows: Array<ProductOrderHistory & { key: string }>,
  extra: (key: string) => TExtra,
) {
  const byKey = new Map<string, { costs: number[]; minutes: number[]; orderCount: number }>();
  for (const row of rows) {
    const current = byKey.get(row.key) ?? { costs: [], minutes: [], orderCount: 0 };
    current.orderCount += 1;
    if (row.actualCost != null) current.costs.push(row.actualCost);
    if (row.workerEffortMinutes > 0) current.minutes.push(row.workerEffortMinutes);
    byKey.set(row.key, current);
  }

  return [...byKey.entries()].map(([key, stats]) => {
    const avg = (values: number[]) =>
      values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : null;
    return {
      ...extra(key),
      orderCount: stats.orderCount,
      averageActualCost: avg(stats.costs),
      lowestActualCost: stats.costs.length ? Math.min(...stats.costs) : null,
      highestActualCost: stats.costs.length ? Math.max(...stats.costs) : null,
      averageEffortMinutes: avg(stats.minutes),
    };
  });
}
