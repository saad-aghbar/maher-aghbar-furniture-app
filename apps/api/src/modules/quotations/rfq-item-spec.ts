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
  notes?: string | null;
  photoDocumentIds?: unknown;
  primaryImageDocumentId?: string | null;
  lineSpec?: unknown;
};

export type QuoteLineSpec = {
  woodType?: string | null;
  woodColor?: string | null;
  foamDensity?: string | null;
  finish?: string | null;
  accessories?: string | null;
  orientation?: string | null;
  options?: unknown;
  notes?: string | null;
  seatHeight?: number | null;
  photoDocumentIds?: string[];
  primaryImageDocumentId?: string | null;
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

function str(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function photoIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((id) => String(id ?? '').trim()).filter(Boolean))];
}

export function parseQuoteLineSpec(raw: unknown): QuoteLineSpec {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const row = raw as Record<string, unknown>;
  const seat = row.seatHeight == null || row.seatHeight === '' ? null : Number(row.seatHeight);
  return {
    woodType: str(row.woodType),
    woodColor: str(row.woodColor),
    foamDensity: str(row.foamDensity),
    finish: str(row.finish),
    accessories: str(row.accessories),
    orientation: str(row.orientation),
    options: row.options,
    notes: str(row.notes),
    seatHeight: seat != null && Number.isFinite(seat) ? seat : null,
    photoDocumentIds: photoIds(row.photoDocumentIds),
    primaryImageDocumentId: str(row.primaryImageDocumentId),
  };
}

export function mergeLineSpec(
  line: {
    lineSpec?: unknown;
    photoDocumentIds?: unknown;
    primaryImageDocumentId?: string | null;
  },
  rfqItem?: RfqSpecItem | null,
): QuoteLineSpec {
  const fromQuote = parseQuoteLineSpec(line.lineSpec);
  const fromRfq = parseQuoteLineSpec({
    woodType: rfqItem?.woodType,
    woodColor: rfqItem?.woodColor,
    foamDensity: rfqItem?.foamDensity,
    finish: rfqItem?.finish,
    accessories: rfqItem?.accessories,
    orientation: rfqItem?.orientation,
    options: rfqItem?.options,
    notes: rfqItem?.notes,
    photoDocumentIds: rfqItem?.photoDocumentIds,
    primaryImageDocumentId: rfqItem?.primaryImageDocumentId,
  });
  const photos = photoIds(line.photoDocumentIds).length
    ? photoIds(line.photoDocumentIds)
    : fromQuote.photoDocumentIds?.length
      ? fromQuote.photoDocumentIds
      : fromRfq.photoDocumentIds ?? [];
  return {
    woodType: fromQuote.woodType ?? fromRfq.woodType,
    woodColor: fromQuote.woodColor ?? fromRfq.woodColor,
    foamDensity: fromQuote.foamDensity ?? fromRfq.foamDensity,
    finish: fromQuote.finish ?? fromRfq.finish,
    accessories: fromQuote.accessories ?? fromRfq.accessories,
    orientation: fromQuote.orientation ?? fromRfq.orientation,
    options: fromQuote.options ?? fromRfq.options,
    notes: fromQuote.notes ?? fromRfq.notes,
    seatHeight: fromQuote.seatHeight ?? fromRfq.seatHeight,
    photoDocumentIds: photos,
    primaryImageDocumentId:
      str(line.primaryImageDocumentId) ??
      fromQuote.primaryImageDocumentId ??
      fromRfq.primaryImageDocumentId ??
      photos[0] ??
      null,
  };
}
