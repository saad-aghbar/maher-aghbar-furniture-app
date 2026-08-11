/**
 * Build a short dimensions note from catalog product fields for New Order step 2.
 */
export function catalogDimensionsNote(product: {
  width?: number | string | null;
  height?: number | string | null;
  depth?: number | string | null;
  seatHeight?: number | string | null;
}): string {
  const fmt = (v: number | string | null | undefined) => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : null;
  };
  const parts: string[] = [];
  const w = fmt(product.width);
  const h = fmt(product.height);
  const d = fmt(product.depth);
  const seat = fmt(product.seatHeight);
  if (w) parts.push(`W ${w}`);
  if (h) parts.push(`H ${h}`);
  if (d) parts.push(`D ${d}`);
  if (seat) parts.push(`Seat ${seat}`);
  return parts.length ? `${parts.join(' × ')} cm` : '';
}
