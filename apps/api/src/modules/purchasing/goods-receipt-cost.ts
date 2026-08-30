/**
 * Piece 6 — pure helpers for goods-receipt acceptance / over-receipt math.
 * GRN posting lives in PurchasingController; these keep qty/cost rules testable.
 */

export function acceptedReceiptQty(receivedQty: number, rejectedQty = 0): number {
  const received = Number(receivedQty) || 0;
  const rejected = Number(rejectedQty) || 0;
  return Math.max(0, received - rejected);
}

export function remainingOrderedQty(orderedQty: number, priorAcceptedQty: number): number {
  return Math.max(0, (Number(orderedQty) || 0) - (Number(priorAcceptedQty) || 0));
}

/** True when this receipt's accepted qty would exceed remaining ordered. */
export function isOverReceipt(acceptedQty: number, remainingQty: number, eps = 1e-6): boolean {
  return acceptedQty > remainingQty + eps;
}

export function receiptLineExtendedCost(
  unitCost: number | null | undefined,
  acceptedQty: number,
): number | null {
  if (unitCost == null || !(Number(unitCost) > 0) || !(acceptedQty > 0)) return null;
  return Number(unitCost) * acceptedQty;
}
