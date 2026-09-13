import type { QuotationLineDto } from './dto/quotation.dto';

export type QuotationLineIdentity = {
  id: string;
  productId?: string | null;
  variantId?: string | null;
  variantSku?: string | null;
  variantLabel?: string | null;
  description?: string | null;
  quantity?: unknown;
  unit?: string | null;
  material?: string | null;
  fabric?: string | null;
  color?: string | null;
  fabrics?: unknown;
  width?: unknown;
  height?: unknown;
  depth?: unknown;
  discountType?: string | null;
  discountValue?: unknown;
  taxRate?: unknown;
  manufacturingComplexity?: string | null;
  customMeasurements?: unknown;
  lineSpec?: unknown;
  photoDocumentIds?: unknown;
  primaryImageDocumentId?: string | null;
};

function asNum(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function asStr(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s.length ? s : undefined;
}

function asPhotos(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((id) => String(id ?? '').trim()).filter(Boolean);
}

function pick<T>(incoming: T | undefined, existing: T | undefined): T | undefined {
  return incoming !== undefined ? incoming : existing;
}

function matchExisting(
  incoming: QuotationLineDto,
  existing: QuotationLineIdentity[],
  index: number,
  used: Set<string>,
): QuotationLineIdentity | undefined {
  if (incoming.id) {
    const byId = existing.find((row) => row.id === incoming.id);
    if (byId && !used.has(byId.id)) return byId;
  }
  const atIndex = existing[index];
  if (atIndex && !used.has(atIndex.id)) return atIndex;
  return existing.find((row) => !used.has(row.id));
}

function mergeOne(
  incoming: QuotationLineDto,
  existing: QuotationLineIdentity | undefined,
): QuotationLineDto {
  if (!existing) return incoming;
  const photos = pick(incoming.photoDocumentIds, asPhotos(existing.photoDocumentIds));
  const lineSpec =
    incoming.lineSpec !== undefined
      ? incoming.lineSpec
      : existing.lineSpec && typeof existing.lineSpec === 'object' && !Array.isArray(existing.lineSpec)
        ? (existing.lineSpec as Record<string, unknown>)
        : incoming.lineSpec;
  const fabrics = pick(
    incoming.fabrics,
    Array.isArray(existing.fabrics) ? (existing.fabrics as QuotationLineDto['fabrics']) : undefined,
  );
  const customMeasurements = pick(
    incoming.customMeasurements,
    Array.isArray(existing.customMeasurements) ? existing.customMeasurements : undefined,
  );
  return {
    ...incoming,
    productId: incoming.productId ?? existing.productId ?? undefined,
    variantId: incoming.variantId ?? existing.variantId ?? undefined,
    variantSku: incoming.variantSku ?? asStr(existing.variantSku),
    variantLabel: incoming.variantLabel ?? asStr(existing.variantLabel),
    description: incoming.description || asStr(existing.description) || 'Item',
    quantity: incoming.quantity ?? asNum(existing.quantity) ?? 1,
    unit: incoming.unit ?? existing.unit ?? undefined,
    material: incoming.material ?? asStr(existing.material),
    fabric: incoming.fabric ?? asStr(existing.fabric),
    color: incoming.color ?? asStr(existing.color),
    fabrics,
    width: incoming.width ?? asNum(existing.width),
    height: incoming.height ?? asNum(existing.height),
    depth: incoming.depth ?? asNum(existing.depth),
    discountType: incoming.discountType ?? (existing.discountType as QuotationLineDto['discountType']),
    discountValue: incoming.discountValue ?? asNum(existing.discountValue),
    taxRate: incoming.taxRate ?? asNum(existing.taxRate),
    manufacturingComplexity:
      incoming.manufacturingComplexity ??
      (existing.manufacturingComplexity as QuotationLineDto['manufacturingComplexity']),
    customMeasurements,
    lineSpec,
    photoDocumentIds: photos,
    primaryImageDocumentId:
      incoming.primaryImageDocumentId ?? existing.primaryImageDocumentId ?? undefined,
  };
}

/** Keep quote-line identity when a price-only PATCH omits photos / lineSpec / fabrics. */
export function mergeQuotationDraftLines(
  existing: QuotationLineIdentity[],
  incoming: QuotationLineDto[],
): QuotationLineDto[] {
  const used = new Set<string>();
  return incoming.map((line, index) => {
    const match = matchExisting(line, existing, index, used);
    if (match) used.add(match.id);
    return mergeOne(line, match);
  });
}
