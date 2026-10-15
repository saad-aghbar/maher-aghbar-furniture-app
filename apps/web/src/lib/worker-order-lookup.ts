export const WORKER_ORDER_SEGMENTS = ['open', 'today', 'active'] as const;
export type WorkerOrderSegment = (typeof WORKER_ORDER_SEGMENTS)[number];

export function parseWorkerOrderSegment(raw: string | null | undefined): WorkerOrderSegment {
  if (raw === 'today' || raw === 'active') return raw;
  return 'open';
}

/** Preferred scope first, then the other My orders scopes. */
export function workerOrderSegmentOrder(preferred: WorkerOrderSegment): WorkerOrderSegment[] {
  return [preferred, ...WORKER_ORDER_SEGMENTS.filter((segment) => segment !== preferred)];
}

export function findWorkerSalesOrder<T extends { salesOrderId: string | null }>(
  groups: T[] | undefined,
  salesOrderId: string,
): T | null {
  if (!salesOrderId) return null;
  return groups?.find((group) => group.salesOrderId === salesOrderId) ?? null;
}
