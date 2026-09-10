export type ProductOrderHistory = {
  productId: string;
  actualCost: number | null;
  workerEffortMinutes: number;
};

export function deriveProductStats(rows: ProductOrderHistory[]) {
  const byProduct = new Map<
    string,
    { costs: number[]; minutes: number[]; orderCount: number }
  >();
  for (const row of rows) {
    const current = byProduct.get(row.productId) ?? { costs: [], minutes: [], orderCount: 0 };
    current.orderCount += 1;
    if (row.actualCost != null) current.costs.push(row.actualCost);
    if (row.workerEffortMinutes > 0) current.minutes.push(row.workerEffortMinutes);
    byProduct.set(row.productId, current);
  }

  return [...byProduct.entries()].map(([productId, stats]) => {
    const avg = (values: number[]) =>
      values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : null;
    return {
      productId,
      orderCount: stats.orderCount,
      averageActualCost: avg(stats.costs),
      lowestActualCost: stats.costs.length ? Math.min(...stats.costs) : null,
      highestActualCost: stats.costs.length ? Math.max(...stats.costs) : null,
      averageEffortMinutes: avg(stats.minutes),
    };
  });
}
