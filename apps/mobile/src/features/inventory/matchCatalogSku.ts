/** Exact catalog SKU. A contains-match must not open a different product. */
export function matchCatalogSku(
  code: string,
  rows: Array<{ id: string; sku: string }>,
): { id: string } | null {
  const wanted = code.trim().toLowerCase();
  if (!wanted) return null;
  const hit = rows.find((row) => row.sku.trim().toLowerCase() === wanted);
  return hit?.id ? { id: hit.id } : null;
}
