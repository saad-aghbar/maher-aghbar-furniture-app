/**
 * Map RFQ items onto CreateQuotation DTO lines (shared logic with mobile
 * `features/requests/quotationLinesFromRequest.ts`). Carries product/variant
 * identity, dims, fabrics, options and spec so pricing gets cost hints and the
 * sales order keeps the catalog link. Must not send unknown keys — the API
 * uses forbidNonWhitelisted.
 */
export interface RfqItemForQuote {
  productId?: string | null;
  variantId?: string | null;
  variantSku?: string | null;
  variantLabel?: string | null;
  productName?: string | null;
  description?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  material?: string | null;
  fabric?: string | null;
  fabricType?: string | null;
  color?: string | null;
  fabricColor?: string | null;
  fabrics?: unknown[] | null;
  width?: number | string | null;
  height?: number | string | null;
  depth?: number | string | null;
  customMeasurements?: unknown[] | null;
  woodType?: string | null;
  woodColor?: string | null;
  foamDensity?: string | null;
  finish?: string | null;
  accessories?: string | null;
  orientation?: string | null;
  notes?: string | null;
  options?: unknown[] | null;
  photoDocumentIds?: string[] | null;
  primaryImageDocumentId?: string | null;
  manufacturingComplexity?: string | null;
}

export interface CreateQuotationLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
  unit?: string;
  taxRate?: number;
  manufacturingComplexity?: 'STANDARD' | 'MODIFIED' | 'CUSTOM';
  productId?: string;
  variantId?: string;
  variantSku?: string;
  variantLabel?: string;
  material?: string;
  fabric?: string;
  color?: string;
  fabrics?: unknown[];
  width?: number;
  height?: number;
  depth?: number;
  customMeasurements?: unknown[];
  photoDocumentIds?: string[];
  primaryImageDocumentId?: string;
  lineSpec?: Record<string, unknown>;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function positiveNumber(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Map RFQ items onto CreateQuotation DTO lines.
 * Must not send unknown keys (`notes`) — API uses forbidNonWhitelisted.
 */
export function quotationLinesFromRequestItems(
  items: RfqItemForQuote[],
): CreateQuotationLineInput[] {
  return items.map((item) => {
    const quantity = positiveNumber(item.quantity) ?? 1;
    const description = (item.productName || item.description || 'Item').trim();
    const complexity =
      item.manufacturingComplexity === 'MODIFIED' || item.manufacturingComplexity === 'CUSTOM'
        ? item.manufacturingComplexity
        : item.manufacturingComplexity === 'STANDARD'
          ? 'STANDARD'
          : undefined;
    const line: CreateQuotationLineInput = {
      description,
      quantity,
      unitPrice: 0,
      unit: item.unit?.trim() || 'pcs',
      taxRate: 0.16,
    };
    if (complexity) line.manufacturingComplexity = complexity;
    if (item.productId && UUID_RE.test(item.productId)) {
      line.productId = item.productId;
    }
    if (item.variantId && UUID_RE.test(item.variantId)) {
      line.variantId = item.variantId;
    }
    if (item.variantSku?.trim()) line.variantSku = item.variantSku.trim();
    if (item.variantLabel?.trim()) line.variantLabel = item.variantLabel.trim();
    if (item.material?.trim()) line.material = item.material.trim();
    const fabric = (item.fabricType ?? item.fabric)?.trim();
    if (fabric) line.fabric = fabric;
    const color = (item.fabricColor ?? item.color)?.trim();
    if (color) line.color = color;
    if (item.fabrics && Array.isArray(item.fabrics) && item.fabrics.length) {
      line.fabrics = item.fabrics;
    }
    const width = positiveNumber(item.width);
    const height = positiveNumber(item.height);
    const depth = positiveNumber(item.depth);
    if (width != null) line.width = width;
    if (height != null) line.height = height;
    if (depth != null) line.depth = depth;
    if (item.customMeasurements?.length) {
      line.customMeasurements = item.customMeasurements;
    }
    const lineSpec: NonNullable<CreateQuotationLineInput['lineSpec']> = {};
    if (item.woodType?.trim()) lineSpec.woodType = item.woodType.trim();
    if (item.woodColor?.trim()) lineSpec.woodColor = item.woodColor.trim();
    if (item.foamDensity?.trim()) lineSpec.foamDensity = item.foamDensity.trim();
    if (item.finish?.trim()) lineSpec.finish = item.finish.trim();
    if (item.accessories?.trim()) lineSpec.accessories = item.accessories.trim();
    if (item.orientation?.trim()) lineSpec.orientation = item.orientation.trim();
    if (item.notes?.trim()) lineSpec.notes = item.notes.trim();
    if (item.options?.length) lineSpec.options = item.options;
    if (item.photoDocumentIds?.length) {
      line.photoDocumentIds = item.photoDocumentIds.filter(Boolean);
      lineSpec.photoDocumentIds = line.photoDocumentIds;
    }
    if (item.primaryImageDocumentId?.trim()) {
      line.primaryImageDocumentId = item.primaryImageDocumentId.trim();
      lineSpec.primaryImageDocumentId = item.primaryImageDocumentId.trim();
    }
    if (Object.keys(lineSpec).length) line.lineSpec = lineSpec;
    return line;
  });
}
