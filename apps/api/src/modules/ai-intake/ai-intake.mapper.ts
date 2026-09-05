import type { ExtractedLineItem } from '@maher/integrations';
import { Prisma } from '@maher/database';
import { mapRequestItemCreate } from '../requests/request-line-classify';
import type { RequestItemDto } from '../requests/dto/request.dto';

const ITEMS_FIELD = '__items';

export function parseDim(value?: string | null): number | undefined {
  if (!value?.trim()) return undefined;
  const n = Number(value.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

export function fieldMapFromJobFields(
  fields: Array<{ fieldName: string; fieldValue?: string | null; reviewedValue?: string | null }>,
  overrides?: Record<string, string>,
): Record<string, string | undefined> {
  const map: Record<string, string | undefined> = Object.fromEntries(
    fields
      .filter((f) => f.fieldName !== ITEMS_FIELD)
      .map((f) => [f.fieldName, f.reviewedValue ?? f.fieldValue ?? undefined]),
  );
  Object.assign(map, overrides ?? {});
  return map;
}

export function parseItemsFromFields(
  fields: Array<{ fieldName: string; fieldValue?: string | null; reviewedValue?: string | null }>,
): ExtractedLineItem[] {
  const raw = fields.find((f) => f.fieldName === ITEMS_FIELD);
  const json = raw?.reviewedValue ?? raw?.fieldValue;
  if (!json?.trim()) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row): row is Record<string, unknown> => row != null && typeof row === 'object')
      .map((row) => ({
        productName: String(row.productName ?? row.product ?? 'Custom furniture'),
        quantity: row.quantity != null ? String(row.quantity) : '1',
        width: row.width != null ? String(row.width) : null,
        height: row.height != null ? String(row.height) : null,
        depth: row.depth != null ? String(row.depth) : null,
        fabricType: row.fabricType != null ? String(row.fabricType) : row.fabric != null ? String(row.fabric) : null,
        material: row.material != null ? String(row.material) : null,
        category: row.category != null ? String(row.category) : null,
        notes: row.notes != null ? String(row.notes) : null,
      }));
  } catch {
    return [];
  }
}

function dimsNote(fieldMap: Record<string, string | undefined>): string | undefined {
  const parts: string[] = [];
  if (fieldMap.width) parts.push(`W=${fieldMap.width}`);
  if (fieldMap.height) parts.push(`H=${fieldMap.height}`);
  if (fieldMap.depth) parts.push(`D=${fieldMap.depth}`);
  return parts.length ? `Dimensions (from AI, review required): ${parts.join(' ')}` : undefined;
}

function singleItemFromFieldMap(fieldMap: Record<string, string | undefined>): ExtractedLineItem {
  const dimNote = dimsNote(fieldMap);
  return {
    productName: fieldMap.product ?? 'Custom furniture',
    quantity: fieldMap.quantity ?? '1',
    width: fieldMap.width ?? null,
    height: fieldMap.height ?? null,
    depth: fieldMap.depth ?? null,
    fabricType: fieldMap.fabric ?? null,
    material: fieldMap.material ?? null,
    category: fieldMap.category ?? null,
    notes: [
      dimNote,
      fieldMap.fabric ? `Fabric: ${fieldMap.fabric}` : undefined,
      fieldMap.deliveryDate ? `Delivery: ${fieldMap.deliveryDate}` : undefined,
    ]
      .filter(Boolean)
      .join('\n') || null,
  };
}

export function resolveLineItems(
  fields: Array<{ fieldName: string; fieldValue?: string | null; reviewedValue?: string | null }>,
  overrides?: Record<string, string>,
): ExtractedLineItem[] {
  const parsed = parseItemsFromFields(fields);
  if (parsed.length) return parsed;
  return [singleItemFromFieldMap(fieldMapFromJobFields(fields, overrides))];
}

export function lineItemsToRequestCreate(
  items: ExtractedLineItem[],
  headerNote?: string,
): Prisma.RequestItemUncheckedCreateWithoutRequestInput[] {
  return items.map((item, index) => {
    const dimNote = dimsNote({
      width: item.width ?? undefined,
      height: item.height ?? undefined,
      depth: item.depth ?? undefined,
    });
    const notes = [
      index === 0 ? headerNote : undefined,
      dimNote,
      item.notes,
    ]
      .filter(Boolean)
      .join('\n');

    const dto: RequestItemDto = {
      productName: item.productName,
      quantity: Number(item.quantity ?? 1) || 1,
      category: item.category ?? undefined,
      material: item.material ?? undefined,
      fabric: item.fabricType ?? undefined,
      width: parseDim(item.width),
      height: parseDim(item.height),
      depth: parseDim(item.depth),
      notes: notes || undefined,
    };
    return mapRequestItemCreate(dto, index, null);
  });
}

export function itemsFieldFromExtraction(items: ExtractedLineItem[] | undefined) {
  if (!items?.length) return null;
  return {
    fieldName: ITEMS_FIELD,
    fieldValue: JSON.stringify(items),
    confidence: 0.9,
    isMissing: false,
  };
}

export { ITEMS_FIELD };
