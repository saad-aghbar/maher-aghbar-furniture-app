export const RFQ_WORKSPACE_STAGES = ['request', 'quotation', 'order'] as const;

export type RfqWorkspaceStage = (typeof RFQ_WORKSPACE_STAGES)[number];

/** Factory path chrome — longer than the three workspace tabs. */
export const RFQ_PATH_STEPS = [
  'request',
  'quotation',
  'accepted',
  'preparing',
] as const;

export type RfqPathStep = (typeof RFQ_PATH_STEPS)[number];

export type RfqPathTone = 'done' | 'current' | 'upcoming';

export type RfqIncompleteGap =
  | 'attachments'
  | 'customLines'
  | 'deliveryAddress'
  | 'endCustomer';

export function parseRfqWorkspaceStage(
  value: string | string[] | undefined | null,
): RfqWorkspaceStage | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'request' || raw === 'quotation' || raw === 'order') return raw;
  return undefined;
}

/**
 * Needs information / Submitted stay on Request — do not invent a quote.
 * Quoted / existing quotation → Quotation. Sales order exists → Order.
 */
export function rfqStageFromData(args: {
  hasQuote: boolean;
  hasOrder: boolean;
  status?: string | null;
}): RfqWorkspaceStage {
  if (args.hasOrder) return 'order';
  if (args.hasQuote || args.status === 'QUOTED') return 'quotation';
  return 'request';
}

/**
 * Farthest factory-path index the record has actually reached.
 * Accepted / Preparing stay upcoming until a sales order exists.
 * Visiting a tab must not advance this.
 */
export function rfqPathReachedIndex(args: {
  hasQuote: boolean;
  hasOrder: boolean;
}): number {
  if (args.hasOrder) return 2;
  if (args.hasQuote) return 1;
  return 0;
}

export function rfqPathTone(
  step: RfqPathStep,
  reachedIndex: number,
): RfqPathTone {
  const i = RFQ_PATH_STEPS.indexOf(step);
  if (i < 0) return 'upcoming';
  if (i < reachedIndex) return 'done';
  if (i === reachedIndex) return 'current';
  return 'upcoming';
}

export function rfqSegmentFilled(
  step: RfqPathStep,
  reachedIndex: number,
): boolean {
  const i = RFQ_PATH_STEPS.indexOf(step);
  return i >= 0 && i <= reachedIndex;
}

export function rfqHasCustomOrModifiedLines(
  items?: Array<{
    productId?: string | null;
    customMeasurements?: unknown[] | null;
  }> | null,
): boolean {
  return (items ?? []).some(
    (item) => Boolean(item.customMeasurements?.length) || !item.productId,
  );
}

export function rfqIncompleteGaps(detail: {
  documents?: Array<unknown> | null;
  deliveryAddress?: string | null;
  endCustomerName?: string | null;
  items?: Array<{
    productId?: string | null;
    customMeasurements?: unknown[] | null;
  }> | null;
}): RfqIncompleteGap[] {
  const gaps: RfqIncompleteGap[] = [];
  if (!(detail.documents?.length)) gaps.push('attachments');
  if (rfqHasCustomOrModifiedLines(detail.items)) gaps.push('customLines');
  if (!detail.deliveryAddress?.trim()) gaps.push('deliveryAddress');
  if (!detail.endCustomerName?.trim()) gaps.push('endCustomer');
  return gaps;
}

/** SUBMITTED is still waiting — do not label it as Under review (a later phase). */
export function isRfqWaitingForReview(status?: string | null): boolean {
  return status === 'SUBMITTED';
}
