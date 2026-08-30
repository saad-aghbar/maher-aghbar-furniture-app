export const RFQ_WORKSPACE_STAGES = ['request', 'quotation', 'order'] as const;

export type RfqWorkspaceStage = (typeof RFQ_WORKSPACE_STAGES)[number];

export type RfqPathTone = 'done' | 'current' | 'upcoming';

export function parseRfqWorkspaceStage(
  value: string | string[] | undefined | null,
): RfqWorkspaceStage | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'request' || raw === 'quotation' || raw === 'order') return raw;
  return undefined;
}

/**
 * Workspace tab that matches backend facts — not a leftover default of Request.
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
 * Farthest workspace index the record has actually reached.
 * Visiting a tab must not advance this — honest to quotations / sales order.
 */
export function rfqReachedIndex(args: {
  hasQuote: boolean;
  hasOrder: boolean;
}): number {
  if (args.hasOrder) return 2;
  if (args.hasQuote) return 1;
  return 0;
}

export function rfqPathTone(
  stage: RfqWorkspaceStage,
  reachedIndex: number,
): RfqPathTone {
  const i = RFQ_WORKSPACE_STAGES.indexOf(stage);
  if (i < 0) return 'upcoming';
  if (i < reachedIndex) return 'done';
  if (i === reachedIndex) return 'current';
  return 'upcoming';
}

export function rfqSegmentFilled(
  stage: RfqWorkspaceStage,
  reachedIndex: number,
): boolean {
  const i = RFQ_WORKSPACE_STAGES.indexOf(stage);
  return i >= 0 && i <= reachedIndex;
}
