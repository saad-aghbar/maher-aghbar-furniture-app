/** Structured cancel reasons (Piece 11). Stored with optional note in cancellationReason. */
export const CANCEL_REASON_CODES = [
  'Dealer requested',
  'Duplicate',
  'Spec error',
  'Unable to manufacture',
  'Material unavailable',
  'Commercial agreement',
  'Administrative error',
  'Other',
] as const;

export type CancelReasonCode = (typeof CANCEL_REASON_CODES)[number];

/** Admin / client SCREAMING_SNAKE aliases → canonical labels. */
const CANCEL_REASON_ALIASES: Record<string, CancelReasonCode> = {
  DEALER_REQUESTED: 'Dealer requested',
  DUPLICATE: 'Duplicate',
  SPEC_ERROR: 'Spec error',
  UNABLE_TO_MANUFACTURE: 'Unable to manufacture',
  MATERIAL_UNAVAILABLE: 'Material unavailable',
  COMMERCIAL_AGREEMENT: 'Commercial agreement',
  ADMINISTRATIVE_ERROR: 'Administrative error',
  OTHER: 'Other',
  'Dealer requested': 'Dealer requested',
  Duplicate: 'Duplicate',
  'Spec error': 'Spec error',
  'Unable to manufacture': 'Unable to manufacture',
  'Material unavailable': 'Material unavailable',
  'Commercial agreement': 'Commercial agreement',
  'Administrative error': 'Administrative error',
  Other: 'Other',
};

export type CancelPhase = 1 | 2 | 3 | 4 | 5;

export function isCancelReasonCode(value: string): value is CancelReasonCode {
  return (CANCEL_REASON_CODES as readonly string[]).includes(value);
}

/** Normalize SCREAMING_SNAKE or human label to canonical reason code. */
export function normalizeCancelReasonCode(value: string): CancelReasonCode | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (CANCEL_REASON_ALIASES[trimmed]) return CANCEL_REASON_ALIASES[trimmed]!;
  if (isCancelReasonCode(trimmed)) return trimmed;
  return null;
}

export function formatCancellationReason(reasonCode: string, reason?: string | null): string {
  const note = reason?.trim();
  if (!note) return reasonCode;
  return `${reasonCode}: ${note}`;
}

/**
 * Phase-aware cancel bands (Piece 11).
 * 1 — draft / waiting / hold
 * 2 — confirmed / ready-for-production (setup / pre-release)
 * 3 — in production
 * 4 — ready for delivery (FIN present)
 * 5 — out for delivery / delivered / completed → use Return, not cancel
 */
export function resolveSalesOrderCancelPhase(params: {
  status: string;
  deliveryStatuses: string[];
}): CancelPhase {
  const { status, deliveryStatuses } = params;
  const shippedOrDelivered = deliveryStatuses.some(
    (s) => s === 'OUT_FOR_DELIVERY' || s === 'DELIVERED',
  );
  if (
    shippedOrDelivered ||
    status === 'DELIVERED' ||
    status === 'COMPLETED'
  ) {
    return 5;
  }
  if (
    status === 'DRAFT' ||
    status === 'ON_HOLD' ||
    status === 'WAITING_FOR_PAYMENT' ||
    status === 'WAITING_FOR_MATERIALS'
  ) {
    return 1;
  }
  if (status === 'CONFIRMED' || status === 'READY_FOR_PRODUCTION') {
    return 2;
  }
  if (status === 'IN_PRODUCTION') {
    return 3;
  }
  if (status === 'READY_FOR_DELIVERY') {
    return 4;
  }
  // CANCELLED / unknown — treat as non-cancellable for safety
  return 5;
}

export function cancelPhaseCurrentState(phase: CancelPhase, status: string): string {
  switch (phase) {
    case 1:
      return `Early / waiting (${status})`;
    case 2:
      return `Setup / pre-release (${status})`;
    case 3:
      return `In production (${status})`;
    case 4:
      return `Finished goods ready (${status})`;
    case 5:
      return `Shipped or delivered (${status}) — use Return`;
    default:
      return status;
  }
}

/** Task statuses cancelled on SO cancel (preserve COMPLETED). */
export const CANCEL_TASK_STATUSES = [
  'NOT_STARTED',
  'READY',
  'IN_PROGRESS',
  'PAUSED',
  'BLOCKED',
  'READY_FOR_INSPECTION',
] as const;

export const OPEN_TASK_STATUSES = [
  'NOT_STARTED',
  'READY',
  'PAUSED',
  'BLOCKED',
  'READY_FOR_INSPECTION',
] as const;
