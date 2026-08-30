/**
 * Piece 6 — purchase-order presentation classifier.
 * UI must use phase/label keys — never raw PurchaseOrderStatus enums.
 */

export type PurchaseOrderPhase =
  | 'DRAFT'
  | 'ORDERED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CLOSED'
  | 'CANCELLED';

export type PurchaseOrderTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export type PurchaseOrderPresentation = {
  phase: PurchaseOrderPhase;
  /** i18n key under purchasing.* */
  labelKey: string;
  tone: PurchaseOrderTone;
  /** 0–1 progress toward fully received (draft/ordered = 0). */
  progress: number;
  attentionReason: string | null;
  primaryAction: 'EDIT' | 'PLACE' | 'RECEIVE' | 'VIEW' | null;
};

const ORDERED = new Set(['APPROVED', 'SENT']);

export function classifyPurchaseOrder(args: {
  status: string;
  expectedDeliveryDate?: Date | string | null;
  orderedQty?: number;
  receivedAcceptedQty?: number;
}): PurchaseOrderPresentation {
  const status = String(args.status ?? '').toUpperCase();
  const ordered = Number(args.orderedQty) || 0;
  const received = Number(args.receivedAcceptedQty) || 0;
  const progress =
    ordered > 0 ? Math.min(1, Math.max(0, received / ordered)) : status === 'RECEIVED' ? 1 : 0;

  let phase: PurchaseOrderPhase;
  if (status === 'DRAFT') phase = 'DRAFT';
  else if (status === 'PARTIALLY_RECEIVED') phase = 'PARTIALLY_RECEIVED';
  else if (status === 'RECEIVED') phase = 'RECEIVED';
  else if (status === 'CLOSED') phase = 'CLOSED';
  else if (status === 'CANCELLED') phase = 'CANCELLED';
  else if (ORDERED.has(status)) phase = 'ORDERED';
  else phase = 'ORDERED';

  const labelKey =
    phase === 'DRAFT'
      ? 'purchasing.phaseDraft'
      : phase === 'ORDERED'
        ? 'purchasing.phaseOrdered'
        : phase === 'PARTIALLY_RECEIVED'
          ? 'purchasing.phasePartial'
          : phase === 'RECEIVED'
            ? 'purchasing.phaseReceived'
            : phase === 'CLOSED'
              ? 'purchasing.phaseClosed'
              : 'purchasing.phaseCancelled';

  const tone: PurchaseOrderTone =
    phase === 'DRAFT'
      ? 'neutral'
      : phase === 'ORDERED'
        ? 'info'
        : phase === 'PARTIALLY_RECEIVED'
          ? 'warning'
          : phase === 'RECEIVED'
            ? 'success'
            : phase === 'CANCELLED'
              ? 'danger'
              : 'neutral';

  let attentionReason: string | null = null;
  if (
    (phase === 'ORDERED' || phase === 'PARTIALLY_RECEIVED') &&
    args.expectedDeliveryDate
  ) {
    const eta = new Date(args.expectedDeliveryDate);
    if (!Number.isNaN(eta.getTime()) && eta.getTime() < Date.now() && received < ordered) {
      attentionReason = 'OVERDUE_ETA';
    }
  }

  const primaryAction =
    phase === 'DRAFT'
      ? 'EDIT'
      : phase === 'ORDERED' || phase === 'PARTIALLY_RECEIVED'
        ? 'RECEIVE'
        : phase === 'RECEIVED' || phase === 'CLOSED'
          ? 'VIEW'
          : null;

  return { phase, labelKey, tone, progress, attentionReason, primaryAction };
}

export function purchaseVariance(args: {
  expectedTotal: number;
  actualReceivedValue: number;
}): { expectedTotal: number; actualReceivedValue: number; variance: number } {
  const expectedTotal = Number(args.expectedTotal) || 0;
  const actualReceivedValue = Number(args.actualReceivedValue) || 0;
  return {
    expectedTotal,
    actualReceivedValue,
    variance: actualReceivedValue - expectedTotal,
  };
}
