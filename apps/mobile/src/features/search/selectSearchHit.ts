/**
 * Global search dumps invoice meta as `STATUS · total` (API enum + Decimal string).
 * Parse only — no payment / filter logic.
 */
export type InvoiceSearchMeta = {
  status: string;
  amount: number;
};

const STATUS_AMOUNT = /^([A-Z][A-Z0-9_]*)\s*[·•]\s*(.+)$/;

export function parseInvoiceSearchSubtitle(
  subtitle?: string | null,
): InvoiceSearchMeta | null {
  if (!subtitle) return null;
  const match = subtitle.trim().match(STATUS_AMOUNT);
  if (!match?.[1] || match[2] == null) return null;
  const amount = Number(String(match[2]).replace(/,/g, '').trim());
  if (!Number.isFinite(amount)) return null;
  return { status: match[1], amount };
}
