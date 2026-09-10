import { PurchaseOrderStatus } from '@maher/database';

export type PurchaseRunPhase =
  | 'DRAFT'
  | 'APPROVED'
  | 'SENT'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED';

export function classifyPurchaseRun(
  statuses: Array<string | PurchaseOrderStatus | null | undefined>,
): PurchaseRunPhase {
  const list = statuses.map((s) => String(s ?? '').toUpperCase()).filter(Boolean);
  if (!list.length) return 'DRAFT';
  if (list.every((s) => s === 'CANCELLED')) return 'CANCELLED';
  if (list.some((s) => s === 'DRAFT')) return 'DRAFT';
  if (list.some((s) => s === 'APPROVED')) return 'APPROVED';
  if (list.some((s) => s === 'PARTIALLY_RECEIVED')) return 'PARTIALLY_RECEIVED';
  if (list.every((s) => s === 'RECEIVED' || s === 'CLOSED' || s === 'CANCELLED')) {
    return 'RECEIVED';
  }
  if (list.some((s) => s === 'SENT' || s === 'PARTIALLY_RECEIVED')) return 'SENT';
  return 'APPROVED';
}

export function attachPurchaseRunMeta<
  T extends {
    purchaseRun?: {
      id: string;
      number: string;
      _count?: { orders?: number };
      orders?: unknown[];
    } | null;
  },
>(po: T): T & {
  runId: string | null;
  runNumber: string | null;
  runSupplierCount: number | null;
} {
  const run = po.purchaseRun;
  const count = run?._count?.orders ?? run?.orders?.length ?? null;
  return {
    ...po,
    runId: run?.id ?? null,
    runNumber: run?.number ?? null,
    runSupplierCount: count,
  };
}

export const PURCHASE_RUN_INCLUDE = {
  id: true,
  number: true,
  origin: true,
  notes: true,
  expectedDeliveryDate: true,
  createdAt: true,
  _count: { select: { orders: true } },
} as const;
