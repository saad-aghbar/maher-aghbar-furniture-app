export type RfqSpecItem = {
  productId?: string | null;
  woodType?: string | null;
  woodColor?: string | null;
  foamDensity?: string | null;
  finish?: string | null;
  accessories?: string | null;
  orientation?: string | null;
  options?: unknown;
  fabrics?: unknown;
  fabricType?: string | null;
  fabricColor?: string | null;
};

export type SnapshotOption = {
  specOptionValueId?: string | null;
  qty?: number | null;
  note?: string | null;
};

export function pickRfqItemForLine<T extends { productId?: string | null }>(
  items: T[] | undefined,
  line: { productId?: string | null },
  index: number,
): T | null {
  if (!items?.length) return null;
  return items[index] ?? items.find((row) => row.productId && row.productId === line.productId) ?? null;
}

export function dealerOrCatalogOptions(
  rfqItem: { options?: unknown } | null | undefined,
  catalog: SnapshotOption[] | undefined,
): SnapshotOption[] {
  const dealer = Array.isArray(rfqItem?.options)
    ? (rfqItem.options as SnapshotOption[]).filter((row) => row?.specOptionValueId)
    : [];
  if (dealer.length) return dealer;
  return (catalog ?? []).filter((row) => row.specOptionValueId);
}
