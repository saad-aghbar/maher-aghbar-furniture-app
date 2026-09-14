export type ProductOrderHistory = {
  productId: string;
  variantId?: string | null;
  optionKey?: string | null;
  actualCost: number | null;
  saleValue?: number | null;
  quantity?: number;
  workerEffortMinutes: number;
  hasReturn?: boolean;
  hasRework?: boolean;
  materials?: number | null;
  fabric?: number | null;
  labor?: number | null;
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
  const byKey = new Map<
    string,
    {
      costs: number[];
      sales: number[];
      qtys: number[];
      minutes: number[];
      materials: number[];
      fabric: number[];
      labor: number[];
      orderCount: number;
      returnCount: number;
      reworkCount: number;
    }
  >();
  for (const row of rows) {
    const current = byKey.get(row.key) ?? {
      costs: [],
      sales: [],
      qtys: [],
      minutes: [],
      materials: [],
      fabric: [],
      labor: [],
      orderCount: 0,
      returnCount: 0,
      reworkCount: 0,
    };
    current.orderCount += 1;
    if (row.actualCost != null) current.costs.push(row.actualCost);
    if (row.saleValue != null) current.sales.push(row.saleValue);
    if (row.quantity != null) current.qtys.push(row.quantity);
    if (row.workerEffortMinutes > 0) current.minutes.push(row.workerEffortMinutes);
    if (row.materials != null) current.materials.push(row.materials);
    if (row.fabric != null) current.fabric.push(row.fabric);
    if (row.labor != null) current.labor.push(row.labor);
    if (row.hasReturn) current.returnCount += 1;
    if (row.hasRework) current.reworkCount += 1;
    byKey.set(row.key, current);
  }

  return [...byKey.entries()].map(([key, stats]) => {
    const avg = (values: number[]) =>
      values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : null;
    const averageActualCost = avg(stats.costs);
    const averageSaleValue = avg(stats.sales);
    const averageMargin =
      averageSaleValue != null && averageActualCost != null
        ? averageSaleValue - averageActualCost
        : null;
    return {
      ...extra(key),
      orderCount: stats.orderCount,
      unitsProduced: stats.qtys.reduce((sum, n) => sum + n, 0),
      averageActualCost,
      lowestActualCost: stats.costs.length ? Math.min(...stats.costs) : null,
      highestActualCost: stats.costs.length ? Math.max(...stats.costs) : null,
      averageSaleValue,
      averageMargin,
      averageMaterial: avg(stats.materials),
      averageFabric: avg(stats.fabric),
      averageLabor: avg(stats.labor),
      averageEffortMinutes: avg(stats.minutes),
      returnRate: stats.orderCount ? Number((stats.returnCount / stats.orderCount).toFixed(3)) : null,
      reworkRate: stats.orderCount ? Number((stats.reworkCount / stats.orderCount).toFixed(3)) : null,
    };
  });
}

export function sortProductStats<
  T extends {
    orderCount: number;
    averageActualCost: number | null;
    averageMargin: number | null;
    unitsProduced: number;
    returnRate: number | null;
    lowestActualCost: number | null;
    highestActualCost: number | null;
  },
>(rows: T[], sort?: string): T[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (sort === 'highestCost') return (b.averageActualCost ?? -Infinity) - (a.averageActualCost ?? -Infinity);
    if (sort === 'lowestMargin') return (a.averageMargin ?? Infinity) - (b.averageMargin ?? Infinity);
    if (sort === 'mostProduced') return (b.unitsProduced ?? 0) - (a.unitsProduced ?? 0);
    if (sort === 'mostReturned') return (b.returnRate ?? -1) - (a.returnRate ?? -1);
    if (sort === 'largestVariance') {
      const va = (a.highestActualCost ?? 0) - (a.lowestActualCost ?? 0);
      const vb = (b.highestActualCost ?? 0) - (b.lowestActualCost ?? 0);
      return vb - va;
    }
    return (b.orderCount ?? 0) - (a.orderCount ?? 0);
  });
  return copy;
}
