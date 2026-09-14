/**
 * Commercial-basket grouping for the production hub list.
 * One board per sales order (SALES_ORDER POs); return/replacement stay singletons.
 */

export type ProductionBoardGroupRow = {
  id: string;
  salesOrderId?: string | null;
  originType?: string | null;
};

const ORPHAN_PREFIX = 'po:';

export function productionBoardGroupKey(row: ProductionBoardGroupRow): string {
  if (row.originType === 'RETURN_WORK' || row.originType === 'REPLACEMENT') {
    return `${ORPHAN_PREFIX}${row.id}`;
  }
  const so = row.salesOrderId?.trim();
  return so ? so : `${ORPHAN_PREFIX}${row.id}`;
}

export function salesOrderIdFromBoardKey(key: string): string | null {
  if (!key || key.startsWith(ORPHAN_PREFIX)) return null;
  return key;
}

export function orderedUniqueGroupKeys(rows: ProductionBoardGroupRow[]): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const row of rows) {
    const key = productionBoardGroupKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

export function countUniqueBoardKeys(rows: ProductionBoardGroupRow[]): number {
  return orderedUniqueGroupKeys(rows).length;
}

export function paginateGroupKeys(
  keys: string[],
  page: number,
  pageSize: number,
): string[] {
  const safePage = Number.isFinite(page) && page > 0 ? Math.trunc(page) : 1;
  const safeSize =
    Number.isFinite(pageSize) && pageSize > 0 ? Math.trunc(pageSize) : 20;
  const start = (safePage - 1) * safeSize;
  return keys.slice(start, start + safeSize);
}

export function splitBoardGroupKeys(keys: string[]): {
  salesOrderIds: string[];
  orphanPoIds: string[];
} {
  const salesOrderIds: string[] = [];
  const orphanPoIds: string[] = [];
  for (const key of keys) {
    if (key.startsWith(ORPHAN_PREFIX)) {
      orphanPoIds.push(key.slice(ORPHAN_PREFIX.length));
    } else {
      salesOrderIds.push(key);
    }
  }
  return { salesOrderIds, orphanPoIds };
}

export function assembleProductionBoards<T extends ProductionBoardGroupRow>(
  pageKeys: string[],
  rows: T[],
): Array<{ id: string; salesOrderId: string | null; items: T[] }> {
  const buckets = new Map<string, T[]>();
  for (const row of rows) {
    const key = productionBoardGroupKey(row);
    const list = buckets.get(key);
    if (list) list.push(row);
    else buckets.set(key, [row]);
  }
  return pageKeys
    .map((key) => ({
      id: key,
      salesOrderId: salesOrderIdFromBoardKey(key),
      items: buckets.get(key) ?? [],
    }))
    .filter((board) => board.items.length > 0);
}
