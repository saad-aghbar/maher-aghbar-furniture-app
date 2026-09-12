import type { ExtractedField, ExtractedLineItem, ExtractionResult, SpecExtractionContext } from './types';

const LOW = 0.7;

function norm(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

function mergeField(a: ExtractedField, b: ExtractedField | undefined): ExtractedField {
  if (!b) return { ...a, confidence: Math.min(a.confidence, LOW) };
  if (norm(a.fieldValue) === norm(b.fieldValue) && a.fieldValue) {
    return {
      ...a,
      confidence: Math.min(1, Math.max(a.confidence, b.confidence) + 0.05),
    };
  }
  return {
    ...a,
    confidence: Math.min(a.confidence, b.confidence, 0.45),
    isMissing: a.isMissing || b.isMissing,
  };
}

function mergeItem(a: ExtractedLineItem, b: ExtractedLineItem | undefined): ExtractedLineItem {
  if (!b) {
    return { ...a, confidence: Math.min(a.confidence ?? 0.5, 0.45), lowConfidenceFields: ['productName'] };
  }
  const keys: Array<keyof ExtractedLineItem> = [
    'productName',
    'quantity',
    'width',
    'height',
    'depth',
    'foamDensity',
    'woodType',
    'finish',
    'orientation',
  ];
  const low: string[] = [...(a.lowConfidenceFields ?? []), ...(b.lowConfidenceFields ?? [])];
  for (const key of keys) {
    const left = String(a[key] ?? '');
    const right = String(b[key] ?? '');
    if (left && right && norm(left) !== norm(right)) low.push(key);
  }
  const unique = [...new Set(low)];
  return {
    ...a,
    confidence: unique.length ? Math.min(a.confidence ?? 0.6, 0.45) : Math.max(a.confidence ?? 0.8, b.confidence ?? 0.8),
    lowConfidenceFields: unique,
    unrecognizedOptions: [...new Set([...(a.unrecognizedOptions ?? []), ...(b.unrecognizedOptions ?? [])])],
  };
}

export function mergeExtractionConsensus(
  primary: ExtractionResult,
  verify: ExtractionResult,
  ctx?: SpecExtractionContext,
): ExtractionResult {
  const fields = primary.fields.map((field) =>
    mergeField(field, verify.fields.find((row) => row.fieldName === field.fieldName)),
  );
  const items = (primary.items ?? [])
    .map((item, index) => mergeItem(item, verify.items?.[index]))
    .map((item) => constrainItemToLibrary(item, ctx));
  return {
    ...primary,
    fields,
    items,
    provider: `${primary.provider}+${verify.provider}`,
  };
}

export function constrainItemToLibrary(
  item: ExtractedLineItem,
  ctx?: SpecExtractionContext,
): ExtractedLineItem {
  if (!ctx?.optionGroups?.length) return item;
  const next = { ...item };
  const unrecognized: string[] = [...(item.unrecognizedOptions ?? [])];
  const apply = (groupCode: string, raw: string | null | undefined): string | null => {
    if (!raw?.trim()) return null;
    const group = ctx.optionGroups?.find((g) => g.code === groupCode);
    if (!group) return raw;
    const hit = group.values.find(
      (v) =>
        norm(v.code) === norm(raw) ||
        norm(v.nameEn) === norm(raw) ||
        norm(v.nameAr) === norm(raw),
    );
    if (hit) return hit.code;
    unrecognized.push(`${groupCode}:${raw}`);
    return null;
  };
  next.foamDensity = apply('FOAM_DENSITY', item.foamDensity);
  next.woodType = apply('WOOD_TYPE', item.woodType);
  next.woodColor = apply('WOOD_COLOR', item.woodColor);
  next.finish = apply('PAINT_COLOR', item.finish) ?? apply('FABRIC_FINISH', item.finish);
  next.unrecognizedOptions = unrecognized.length ? unrecognized : null;
  if (unrecognized.length) {
    next.lowConfidenceFields = [...new Set([...(next.lowConfidenceFields ?? []), 'options'])];
  }
  return next;
}

export const LOW_CONFIDENCE_THRESHOLD = LOW;
