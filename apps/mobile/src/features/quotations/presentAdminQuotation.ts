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
