import type { CreateRequestItemInput } from '@/api/modules/requests';
import type { CreateQuotationLineInput, QuotationLine } from '@/api/modules/quotations';
import { emptyDealerFabricRow, type DealerFabricRow } from './FabricSelectionsEditor';
import {
  emptyOrderLine,
  lineToRequestItem,
  type NewOrderLine,
  type NewOrderLineOption,
} from './newOrderLine';
import { seedDimensionsFromRequestItem } from './newOrderMeasurements';
import type { RequestItem } from './types';

function asText(value: unknown): string {
  return String(value ?? '').trim();
}

function fabricsFromItem(item: {
  fabrics?: Array<{
    key?: string;
    type?: string | null;
    color?: string | null;
    role?: string | null;
    code?: string | null;
    quantity?: number | null;
    notes?: string | null;
  }> | null;
  fabricType?: string | null;
  fabric?: string | null;
  fabricColor?: string | null;
  color?: string | null;
}): DealerFabricRow[] {
  if (item.fabrics?.length) {
    return item.fabrics.map((row, i) => ({
      ...emptyDealerFabricRow(),
      key: String(row.key ?? `fab-${i}`),
      type: asText(row.type),
      color: asText(row.color),
      role: asText(row.role),
      code: asText(row.code),
      quantity: row.quantity != null ? String(row.quantity) : '',
      notes: asText(row.notes),
    }));
  }
  const type = asText(item.fabricType ?? item.fabric);
  const color = asText(item.fabricColor ?? item.color);
  if (!type && !color) return [emptyDealerFabricRow()];
  return [{ ...emptyDealerFabricRow(), type, color }];
}

function optionsFromUnknown(value: unknown): NewOrderLineOption[] {
  if (!Array.isArray(value)) return [];
  const out: NewOrderLineOption[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as Record<string, unknown>;
    const specOptionValueId = asText(rec.specOptionValueId);
    if (!specOptionValueId) continue;
    out.push({
      specOptionValueId,
      groupCode: asText(rec.groupCode) || undefined,
      code: asText(rec.code) || undefined,
      nameEn: asText(rec.nameEn) || undefined,
      nameAr: asText(rec.nameAr) || undefined,
      qty: rec.qty != null ? Number(rec.qty) : undefined,
      note: asText(rec.note) || undefined,
    });
  }
  return out;
}

export function requestItemToOrderLine(item: RequestItem, seatLabel: string): NewOrderLine {
  const dims = seedDimensionsFromRequestItem(item, seatLabel);
  return emptyOrderLine({
    id: item.id ?? '',
    productId: asText(item.productId),
    customProductName: asText(item.productName),
    variantId: asText(item.variantId),
    variantSku: asText(item.variantSku),
    variantLabel: asText(item.variantLabel),
    quantity: String(item.quantity ?? '1'),
    dimWidth: dims.width,
    dimHeight: dims.height,
    dimDepth: dims.depth,
    dimSeat: dims.seat,
    customMeasurements: dims.custom,
    fabrics: fabricsFromItem(item),
    woodType: asText(item.woodType),
    woodColor: asText(item.woodColor),
    foamDensity: asText(item.foamDensity),
    finish: asText(item.finish),
    accessories: asText(item.accessories),
    orientation: asText(item.orientation),
    options: optionsFromUnknown(item.options),
    notes: asText(item.notes),
    photoDocumentIds: (item.photoDocumentIds ?? []).filter(Boolean),
    primaryImageDocumentId: asText(item.primaryImageDocumentId),
  });
}

export function requestItemToCreateInput(item: RequestItem | undefined): CreateRequestItemInput | null {
  if (!item?.productName?.trim()) return null;
  const fabrics = (item.fabrics ?? [])
    .map((row) => ({
      key: row.key,
      type: row.type ?? null,
      color: row.color ?? null,
      role: row.role ?? null,
      code: row.code ?? null,
      quantity: row.quantity ?? null,
      unit: row.unit ?? 'm',
      notes: row.notes ?? null,
    }))
    .filter((row) => row.type || row.color || row.code || row.role);
  return {
    productName: item.productName.trim(),
    productId: item.productId ?? undefined,
    variantId: item.variantId ?? undefined,
    variantSku: item.variantSku ?? undefined,
    variantLabel: item.variantLabel ?? undefined,
    quantity: Number(item.quantity) || 1,
    unit: item.unit ?? undefined,
    notes: item.notes ?? undefined,
    width: item.width != null ? Number(item.width) : undefined,
    height: item.height != null ? Number(item.height) : undefined,
    depth: item.depth != null ? Number(item.depth) : undefined,
    fabric: (item.fabricType ?? item.fabric) ?? undefined,
    color: (item.fabricColor ?? item.color) ?? undefined,
    fabrics: fabrics.length ? fabrics : undefined,
    description: item.description ?? undefined,
    customMeasurements: item.customMeasurements ?? undefined,
    woodType: item.woodType ?? undefined,
    woodColor: item.woodColor ?? undefined,
    foamDensity: item.foamDensity ?? undefined,
    finish: item.finish ?? undefined,
    accessories: item.accessories ?? undefined,
    orientation: item.orientation ?? undefined,
    options: (item.options ?? []).map((row) => ({
      specOptionValueId: row.specOptionValueId ?? undefined,
      groupCode: row.groupCode ?? undefined,
      code: row.code ?? undefined,
      nameEn: row.nameEn ?? undefined,
      nameAr: row.nameAr ?? undefined,
      note: row.note ?? undefined,
    })),
    photoDocumentIds: item.photoDocumentIds ?? undefined,
    primaryImageDocumentId: item.primaryImageDocumentId ?? undefined,
  };
}

export function mergeDraftRequestSaveItems(
  existing: RequestItem[],
  draftLines: Array<{ key: string; productName: string; quantity: string; notes: string }>,
): CreateRequestItemInput[] {
  return draftLines
    .filter((line) => line.productName.trim())
    .map((line, index) => {
      const current = existing.find((row) => row.id === line.key) ?? existing[index];
      const base = requestItemToCreateInput(current) ?? {
        productName: line.productName.trim(),
        quantity: Number(line.quantity) || 1,
      };
      return {
        ...base,
        productName: line.productName.trim(),
        quantity: Number(line.quantity) || 0,
        notes: line.notes.trim() || undefined,
      };
    });
}

export function verifyFieldsFromLine(line: NewOrderLine, untitled: string, seatLabel: string) {
  const item = lineToRequestItem(line, untitled, seatLabel);
  return {
    productName: item.productName,
    width: item.width != null ? String(item.width) : '',
    height: item.height != null ? String(item.height) : '',
    depth: item.depth != null ? String(item.depth) : '',
    woodType: item.woodType ?? '',
    woodColor: item.woodColor ?? '',
    foamDensity: item.foamDensity ?? '',
    finish: item.finish ?? '',
    accessories: item.accessories ?? '',
    orientation: item.orientation ?? '',
    notes: item.notes ?? '',
    fabric: item.fabric ?? '',
    color: item.color ?? '',
    customMeasurements: item.customMeasurements ?? [],
    options: item.options ?? [],
    fabrics: item.fabrics ?? [],
    photoDocumentIds: item.photoDocumentIds ?? [],
    primaryImageDocumentId: item.primaryImageDocumentId ?? '',
  };
}

type QuoteLineSpec = NonNullable<CreateQuotationLineInput['lineSpec']>;

export function quotationLineToOrderLine(
  line: QuotationLine,
  seatLabel: string,
): NewOrderLine {
  const spec = (line.lineSpec ?? {}) as QuoteLineSpec;
  const dims = seedDimensionsFromRequestItem(
    {
      width: line.width,
      height: line.height,
      depth: line.depth,
      customMeasurements: line.customMeasurements ?? undefined,
    },
    seatLabel,
  );
  return emptyOrderLine({
    id: line.id,
    productId: asText(line.productId),
    customProductName: asText(line.description),
    variantId: asText(line.variantId),
    variantSku: asText(line.variantSku),
    variantLabel: asText(line.variantLabel),
    quantity: String(line.quantity ?? '1'),
    dimWidth: dims.width,
    dimHeight: dims.height,
    dimDepth: dims.depth,
    dimSeat: dims.seat,
    customMeasurements: dims.custom,
    fabrics: fabricsFromItem({
      fabrics: line.fabrics,
      fabric: line.fabric,
      color: line.color,
    }),
    woodType: asText(spec.woodType),
    woodColor: asText(spec.woodColor),
    foamDensity: asText(spec.foamDensity),
    finish: asText(spec.finish),
    accessories: asText(spec.accessories),
    orientation: asText(spec.orientation),
    options: optionsFromUnknown(spec.options),
    notes: asText(spec.notes ?? line.notes),
    photoDocumentIds: (line.photoDocumentIds ?? spec.photoDocumentIds ?? []).filter(Boolean),
    primaryImageDocumentId: asText(line.primaryImageDocumentId ?? spec.primaryImageDocumentId),
  });
}

export function quotationLinePatchFromLine(
  line: NewOrderLine,
  priced: { unitPrice: number; taxRate?: number },
  untitled: string,
  seatLabel: string,
): CreateQuotationLineInput {
  const item = lineToRequestItem(line, untitled, seatLabel);
  const lineSpec: QuoteLineSpec = {};
  if (item.woodType) lineSpec.woodType = item.woodType;
  if (item.woodColor) lineSpec.woodColor = item.woodColor;
  if (item.foamDensity) lineSpec.foamDensity = item.foamDensity;
  if (item.finish) lineSpec.finish = item.finish;
  if (item.accessories) lineSpec.accessories = item.accessories;
  if (item.orientation) lineSpec.orientation = item.orientation;
  if (item.notes) lineSpec.notes = item.notes;
  if (item.options?.length) lineSpec.options = item.options;
  if (item.photoDocumentIds?.length) lineSpec.photoDocumentIds = item.photoDocumentIds;
  if (item.primaryImageDocumentId) lineSpec.primaryImageDocumentId = item.primaryImageDocumentId;
  return {
    id: line.id || undefined,
    description: item.productName,
    quantity: item.quantity,
    unitPrice: priced.unitPrice,
    unit: item.unit,
    productId: item.productId,
    variantId: item.variantId,
    variantSku: item.variantSku,
    variantLabel: item.variantLabel,
    material: undefined,
    fabric: item.fabric,
    color: item.color,
    fabrics: item.fabrics,
    taxRate: priced.taxRate,
    width: item.width,
    height: item.height,
    depth: item.depth,
    customMeasurements: item.customMeasurements,
    lineSpec: Object.keys(lineSpec).length ? lineSpec : undefined,
    photoDocumentIds: item.photoDocumentIds,
    primaryImageDocumentId: item.primaryImageDocumentId,
  };
}

export function quotationDraftSaveLines(
  draftLines: Array<{ id: string; unitPrice: string; line: QuotationLine }>,
): CreateQuotationLineInput[] {
  return draftLines.map(({ id, unitPrice, line }) => ({
    id,
    description: line.description,
    quantity: Number(line.quantity) || 0,
    unitPrice: Number(unitPrice) || 0,
    unit: line.unit ?? undefined,
    productId: line.productId ?? undefined,
    variantId: line.variantId ?? undefined,
    variantSku: line.variantSku ?? undefined,
    variantLabel: line.variantLabel ?? undefined,
    material: line.material ?? undefined,
    fabric: line.fabric ?? undefined,
    color: line.color ?? undefined,
    fabrics: line.fabrics ?? undefined,
    taxRate: line.taxRate != null ? Number(line.taxRate) : 0.16,
    width: line.width != null ? Number(line.width) : undefined,
    height: line.height != null ? Number(line.height) : undefined,
    depth: line.depth != null ? Number(line.depth) : undefined,
    manufacturingComplexity:
      line.manufacturingComplexity === 'MODIFIED' ||
      line.manufacturingComplexity === 'CUSTOM' ||
      line.manufacturingComplexity === 'STANDARD'
        ? line.manufacturingComplexity
        : undefined,
    customMeasurements: line.customMeasurements ?? undefined,
    lineSpec: line.lineSpec ?? undefined,
    photoDocumentIds: line.photoDocumentIds ?? undefined,
    primaryImageDocumentId: line.primaryImageDocumentId ?? undefined,
  }));
}
