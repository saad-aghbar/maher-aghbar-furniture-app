import { emptyDealerFabricRow } from './FabricSelectionsEditor';
import { emptyOrderLine, type NewOrderLine } from './newOrderLine';
import type { AiExtractPreviewItem } from '@/api/modules/ai-intake';

export const SCAN_REVIEW_FIELDS = [
  'productName',
  'quantity',
  'width',
  'height',
  'depth',
  'fabricType',
  'woodColor',
  'foamDensity',
  'woodType',
  'finish',
  'orientation',
  'notes',
] as const;

export type ScanReviewFieldKey = (typeof SCAN_REVIEW_FIELDS)[number];

export type ScanReviewLine = {
  id: string;
  productId: string;
  productName: string;
  quantity: string;
  width: string;
  height: string;
  depth: string;
  foamDensity: string;
  woodType: string;
  woodColor: string;
  finish: string;
  orientation: 'NONE' | 'LEFT' | 'RIGHT' | '';
  fabricType: string;
  notes: string;
  variantLabel: string;
  material: string;
  optionCodes: string[];
  unrecognizedOptions: string[];
  confidence: number;
  lowConfidenceFields: string[];
  confirmedFields: string[];
  unrecognizedNoted: boolean;
};

export type CatalogNameHit = {
  id: string;
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
};

function norm(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase();
}

export function matchCatalogProduct(
  name: string,
  products: CatalogNameHit[],
): CatalogNameHit | null {
  const n = norm(name);
  if (!n) return null;
  return (
    products.find((row) => [row.nameAr, row.nameEn, row.nameHe].some((label) => norm(label) === n)) ??
    products.find((row) =>
      [row.nameAr, row.nameEn, row.nameHe].some((label) => {
        const labelN = norm(label);
        return labelN.includes(n) || n.includes(labelN);
      }),
    ) ??
    null
  );
}

function remapLowConfidenceFields(fields: string[]): string[] {
  const mapped = fields.map((field) => {
    if (field === 'fabric') return 'fabricType';
    if (field === 'colour' || field === 'color') return 'woodColor';
    return field;
  });
  return [...new Set(mapped)];
}

export function previewItemsToScanLines(
  items: AiExtractPreviewItem[],
  products: CatalogNameHit[] = [],
): ScanReviewLine[] {
  return items.map((item, index) => {
    const hit = matchCatalogProduct(item.productName ?? '', products);
    const low = remapLowConfidenceFields([...(item.lowConfidenceFields ?? [])]);
    if ((item.confidence ?? 1) < 0.7 && !low.includes('productName')) low.push('productName');
    return {
      id: `scan-${index}`,
      productId: hit?.id ?? '',
      productName: item.productName?.trim() || '',
      quantity: item.quantity?.trim() || '1',
      width: item.width ?? '',
      height: item.height ?? '',
      depth: item.depth ?? '',
      foamDensity: item.foamDensity ?? '',
      woodType: item.woodType ?? '',
      woodColor: item.woodColor ?? '',
      finish: item.finish ?? '',
      orientation:
        item.orientation === 'LEFT' || item.orientation === 'RIGHT' || item.orientation === 'NONE'
          ? item.orientation
          : '',
      fabricType: item.fabric?.trim() || item.fabricType?.trim() || '',
      notes: item.notes?.trim() || '',
      variantLabel: item.variantLabel?.trim() || '',
      material: item.material?.trim() || '',
      optionCodes: item.optionCodes?.map((code) => String(code).trim()).filter(Boolean) ?? [],
      unrecognizedOptions: item.unrecognizedOptions ?? [],
      confidence: item.confidence ?? 0.8,
      lowConfidenceFields: low,
      confirmedFields: [],
      unrecognizedNoted: !item.unrecognizedOptions?.length,
    };
  });
}

export function touchScanField(line: ScanReviewLine, field: string): ScanReviewLine {
  if (line.confirmedFields.includes(field)) return line;
  return { ...line, confirmedFields: [...line.confirmedFields, field] };
}

export function patchScanLine(
  line: ScanReviewLine,
  patch: Partial<ScanReviewLine>,
  field?: string,
): ScanReviewLine {
  const next = { ...line, ...patch, id: line.id };
  return field ? touchScanField(next, field) : next;
}

export function scanLineNeedsConfirm(line: ScanReviewLine): boolean {
  const pending = line.lowConfidenceFields.filter((field) => !line.confirmedFields.includes(field));
  return pending.length > 0 || (!line.unrecognizedNoted && line.unrecognizedOptions.length > 0);
}

export function scanReviewCanConfirm(lines: ScanReviewLine[]): boolean {
  return lines.length > 0 && lines.every((line) => !scanLineNeedsConfirm(line));
}

function applyOptionCodes(line: NewOrderLine, codes: string[]): NewOrderLine {
  if (!codes.length) return line;
  const next = { ...line };
  for (const code of codes) {
    const upper = code.toUpperCase();
    if (!next.foamDensity && /^D\d+/i.test(upper)) next.foamDensity = code;
    else if (!next.woodType && /BEECH|OAK|WALNUT|PINE|MDF/i.test(upper)) next.woodType = code;
    else if (!next.woodColor && /GOLD|WALNUT|WHITE|BLACK|NATURAL/i.test(upper)) next.woodColor = code;
    else if (!next.finish) next.finish = next.finish || code;
  }
  return next;
}

export function composeScanLineNotes(line: {
  notes: string;
  material: string;
  optionCodes: string[];
}): string {
  const parts: string[] = [];
  const notes = line.notes.trim();
  const material = line.material.trim();
  if (notes) parts.push(notes);
  if (material && !notes.toLowerCase().includes(material.toLowerCase())) {
    parts.push(`Material: ${material}`);
  }
  if (line.optionCodes.length) {
    const joined = line.optionCodes.join(', ');
    if (!notes.toLowerCase().includes(joined.toLowerCase())) {
      parts.push(`Options: ${joined}`);
    }
  }
  return parts.join('\n');
}

export function scanLinesToBasket(lines: ScanReviewLine[]): NewOrderLine[] {
  return lines.map((line) => {
    const notes = composeScanLineNotes(line);
    const seeded = emptyOrderLine({
      productId: line.productId,
      customProductName: line.productName,
      quantity: line.quantity || '1',
      dimWidth: line.width,
      dimHeight: line.height,
      dimDepth: line.depth,
      foamDensity: line.foamDensity,
      woodType: line.woodType,
      woodColor: line.woodColor,
      finish: line.finish,
      orientation: line.orientation,
      variantLabel: line.variantLabel,
      notes,
      fabrics: line.fabricType
        ? [{ ...emptyDealerFabricRow(), type: line.fabricType }]
        : [emptyDealerFabricRow()],
    });
    return applyOptionCodes(seeded, line.optionCodes);
  });
}

export function previewHasLowConfidence(items: AiExtractPreviewItem[]): boolean {
  return items.some(
    (item) =>
      (item.lowConfidenceFields?.length ?? 0) > 0 ||
      (item.unrecognizedOptions?.length ?? 0) > 0 ||
      (item.confidence ?? 1) < 0.7,
  );
}
