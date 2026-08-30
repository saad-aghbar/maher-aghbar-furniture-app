import type { QuotationStatus } from '@maher/database';

/** Statuses a dealer may list/get. Unsent quotes stay internal. */
export const DEALER_VISIBLE_QUOTATION_STATUSES = [
  'SENT',
  'VIEWED',
  'ACCEPTED',
  'REJECTED',
  'REVISION_REQUESTED',
  'EXPIRED',
] as const satisfies readonly QuotationStatus[];

export type DealerVisibleQuotationStatus = (typeof DEALER_VISIBLE_QUOTATION_STATUSES)[number];

export function isDealerVisibleQuotationStatus(status: string): boolean {
  return (DEALER_VISIBLE_QUOTATION_STATUSES as readonly string[]).includes(status);
}

/** Dealer Accept / Reject / Request revision — published quote only. */
export function dealerCanDecideQuotation(status: string): boolean {
  return status === 'SENT';
}

export const SAME_RFQ_ACCEPTED_ERROR =
  'This request already has an accepted quotation. Only one commercial quotation can proceed.';
