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

/** Inclusive valid-until calendar day (UTC). */
export function isQuotationCommerciallyExpired(
  expirationDate: Date | string | null | undefined,
  now = new Date(),
): boolean {
  if (!expirationDate) return false;
  const end = expirationDate instanceof Date ? expirationDate : new Date(expirationDate);
  if (Number.isNaN(end.getTime())) return false;
  const until = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 23, 59, 59, 999),
  );
  return now.getTime() > until.getTime();
}

/** Dealer Accept / Reject / Request revision — published and not expired. */
export function dealerCanDecideQuotation(
  status: string,
  expirationDate?: Date | string | null,
): boolean {
  if (status !== 'SENT' && status !== 'VIEWED') return false;
  return !isQuotationCommerciallyExpired(expirationDate);
}

export const SAME_RFQ_ACCEPTED_ERROR =
  'This request already has an accepted quotation. Only one commercial quotation can proceed.';
