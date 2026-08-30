/** Canonical SKU photo. Empty / whitespace is null — never a broken URL. */
export function canonicalInventoryImageUrl(
  item: { imageUrl?: string | null } | null | undefined,
): string | null {
  const value = item?.imageUrl?.trim();
  return value ? value : null;
}
