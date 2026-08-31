/** Hide empty optional rows (same idea as empty FAX) instead of showing "—". */
export function presentableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === '—' || trimmed === '–' || trimmed === '-') return null;
  return trimmed;
}

/** Qty badge — "1" not "1.00". */
export function quotationQtyLabel(value: number | string | null | undefined): string {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (Number.isInteger(n)) return String(n);
  return String(n);
}

/**
 * Line total is unit × qty. Do not use backend `lineTotal` — that is tax-inclusive
 * quote total leftover (127.60). Tax stays on the quote summary.
 */
export function quotationLineNet(
  unitPrice: number | string | null | undefined,
  quantity: number | string | null | undefined,
): number | null {
  const unit = Number(unitPrice);
  const qty = Number(quantity);
  if (!Number.isFinite(unit) || !Number.isFinite(qty)) return null;
  return unit * qty;
}

export function quotationLineDims(line: {
  width?: number | string | null;
  height?: number | string | null;
  depth?: number | string | null;
}): string | null {
  const parts = [line.width, line.height, line.depth].filter((v) => v != null && v !== '');
  return parts.length ? parts.map(String).join('×') : null;
}

export function quotationComplexity(
  value: string | null | undefined,
): 'STANDARD' | 'MODIFIED' | 'CUSTOM' {
  if (value === 'MODIFIED' || value === 'CUSTOM') return value;
  return 'STANDARD';
}

export function sellingPriceMissing(unitPrice: number | string | null | undefined): boolean {
  const n = Number(unitPrice);
  return !Number.isFinite(n) || n <= 0;
}

/** Same fallback the draft PATCH uses when a line has no stored rate. */
export const DEFAULT_QUOTATION_TAX_RATE = 0.16;

export function quotationLineTaxRate(
  taxRate: number | string | null | undefined,
): number {
  if (taxRate == null || taxRate === '') return DEFAULT_QUOTATION_TAX_RATE;
  const n = Number(taxRate);
  return Number.isFinite(n) ? n : DEFAULT_QUOTATION_TAX_RATE;
}

/** Live quote money while unit prices are still being typed (not yet saved). */
export function quotationDraftTotals(
  lines: Array<{
    unitPrice: number | string | null | undefined;
    quantity: number | string | null | undefined;
    taxRate?: number | string | null;
  }>,
): { subtotal: number; tax: number; total: number } {
  let subtotal = 0;
  let tax = 0;
  for (const line of lines) {
    const net = sellingPriceMissing(line.unitPrice)
      ? 0
      : (quotationLineNet(line.unitPrice, line.quantity) ?? 0);
    subtotal += net;
    tax += net * quotationLineTaxRate(line.taxRate);
  }
  return { subtotal, tax, total: subtotal + tax };
}

export function quotationLineSpecs(line: {
  material?: string | null;
  fabric?: string | null;
  color?: string | null;
}): string | null {
  const parts = [line.material, line.fabric, line.color]
    .map((v) => v?.trim())
    .filter((v): v is string => Boolean(v));
  return parts.length ? parts.join(' / ') : null;
}
