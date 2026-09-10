import type { QualityChecklistItem } from './api';

export type PieceInspectionResult = 'PASS' | 'FAIL' | 'PENDING';

export function pieceInspectionResult(
  item: QualityChecklistItem,
  localPass: Record<string, boolean>,
): PieceInspectionResult {
  const stored = String(item.result ?? '').toUpperCase();
  if (stored === 'FAIL') return 'FAIL';
  if (stored === 'PASS' || localPass[item.checklistCode]) return 'PASS';
  return 'PENDING';
}

export function allInspectionPiecesPassed(
  items: QualityChecklistItem[],
  localPass: Record<string, boolean>,
): boolean {
  if (!items.length) return false;
  return items.every((item) => pieceInspectionResult(item, localPass) === 'PASS');
}

export function buildPassChecklistResults(items: QualityChecklistItem[]) {
  return items.map((item) => ({
    checklistCode: item.checklistCode,
    result: 'PASS',
  }));
}

export function buildPartialFailChecklistResults(opts: {
  items: QualityChecklistItem[];
  localPass: Record<string, boolean>;
  failedCode: string;
  defectDescription: string;
  reentryStageInstanceIds: string[];
  voiceDocumentId?: string;
  photoDocumentIds?: string[];
}) {
  return opts.items.map((item) => {
    if (item.checklistCode === opts.failedCode) {
      return {
        checklistCode: item.checklistCode,
        result: 'FAIL',
        note: opts.defectDescription,
        defectDescription: opts.defectDescription,
        reentryStageInstanceIds: opts.reentryStageInstanceIds,
        voiceDocumentId: opts.voiceDocumentId,
        photoDocumentIds: opts.photoDocumentIds,
      };
    }
    const result = pieceInspectionResult(item, opts.localPass);
    if (result === 'PENDING') return null;
    return {
      checklistCode: item.checklistCode,
      result,
    };
  }).filter((row): row is NonNullable<typeof row> => row != null);
}

export function formatSpecRecord(
  value: Record<string, unknown> | null | undefined,
): string | null {
  if (!value) return null;
  const width = value.width ?? value.W ?? value.w;
  const depth = value.depth ?? value.D ?? value.d;
  const height = value.height ?? value.H ?? value.h;
  if (width != null || depth != null || height != null) {
    return [width, depth, height]
      .filter((part) => part != null && String(part).trim())
      .join(' × ');
  }
  const parts = Object.entries(value)
    .filter(([, v]) => v != null && String(v).trim() !== '')
    .map(([k, v]) => `${k}: ${String(v)}`);
  return parts.length ? parts.join(' · ') : null;
}

export type LocalizedNames = {
  nameEn?: string | null;
  nameAr?: string | null;
  nameHe?: string | null;
};

export function localizedName(locale: string, names: LocalizedNames): string | null {
  const en = names.nameEn?.trim() || '';
  const ar = names.nameAr?.trim() || '';
  const he = names.nameHe?.trim() || '';
  if (locale === 'ar') return ar || en || he || null;
  if (locale === 'he') return he || en || ar || null;
  return en || ar || he || null;
}

const DIM_FIELDS = ['width', 'height', 'depth', 'seatHeight'] as const;
const DIM_ALIASES: Record<(typeof DIM_FIELDS)[number], string[]> = {
  width: ['width', 'W', 'w'],
  height: ['height', 'H', 'h'],
  depth: ['depth', 'D', 'd'],
  seatHeight: ['seatHeight', 'seat', 'Seat', 'seat_height'],
};

function dimValue(
  rec: Record<string, unknown> | null | undefined,
  field: (typeof DIM_FIELDS)[number],
): string | null {
  if (!rec) return null;
  for (const key of DIM_ALIASES[field]) {
    const v = rec[key];
    if (v != null && String(v).trim() !== '') return String(v);
  }
  return null;
}

function formatLineSpec(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return formatSpecRecord(value as Record<string, unknown>);
  }
  const text = String(value).trim();
  return text || null;
}

function asMeasurementRows(
  value: unknown,
): Array<{ key: string; label: string; value: string; unit?: string | null }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((row, index) => {
      if (!row || typeof row !== 'object') return null;
      const rec = row as Record<string, unknown>;
      const label = String(rec.label ?? rec.nameEn ?? rec.key ?? '').trim();
      const raw = rec.value;
      if (!label && (raw == null || String(raw).trim() === '')) return null;
      return {
        key: String(rec.key ?? rec.id ?? `m${index}`),
        label: label || `m${index}`,
        value: raw == null ? '' : String(raw),
        unit: rec.unit == null ? null : String(rec.unit),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);
}

export type InspectionSpecRow = {
  key: string;
  /** i18n key under `mobile.quality.*` unless `label` is set. */
  labelKey?: string;
  /** Absolute i18n key such as `mobile.productionSetup.dims.width`. */
  absLabelKey?: string;
  label?: string;
  value: string;
  numeric?: boolean;
};

export type InspectionOrderIdentity = {
  productName?: string | null;
  productNameAr?: string | null;
  productNameHe?: string | null;
  productionOrderNumber?: string | null;
  salesOrderNumber?: string | null;
  dealerName?: string | null;
  dealerNameAr?: string | null;
  dealerNameHe?: string | null;
  quantity?: number | null;
  composition?: string | null;
};

export function buildInspectionSpecRows(input: {
  spec: import('./api').ManufacturingSpec | null;
  identity?: InspectionOrderIdentity | null;
  locale: string;
}): InspectionSpecRow[] {
  const { spec, identity, locale } = input;
  const rows: InspectionSpecRow[] = [];
  const product = localizedName(locale, {
    nameEn: identity?.productName,
    nameAr: identity?.productNameAr,
    nameHe: identity?.productNameHe,
  });
  if (product) rows.push({ key: 'product', labelKey: 'specProduct', value: product });
  if (identity?.productionOrderNumber) {
    rows.push({
      key: 'po',
      labelKey: 'specPo',
      value: identity.productionOrderNumber,
      numeric: true,
    });
  }
  if (identity?.salesOrderNumber) {
    rows.push({
      key: 'so',
      labelKey: 'specSo',
      value: identity.salesOrderNumber,
      numeric: true,
    });
  }
  const dealer = localizedName(locale, {
    nameEn: identity?.dealerName,
    nameAr: identity?.dealerNameAr,
    nameHe: identity?.dealerNameHe,
  });
  if (dealer) rows.push({ key: 'dealer', labelKey: 'specDealer', value: dealer });
  if (identity?.quantity != null) {
    rows.push({
      key: 'qty',
      labelKey: 'specQty',
      value: String(identity.quantity),
      numeric: true,
    });
  }
  if (!spec) return rows;

  if (spec.manufacturingName && spec.manufacturingName !== product) {
    rows.push({ key: 'mfg', labelKey: 'specManufacturingName', value: spec.manufacturingName });
  }
  const complexity = String(spec.complexity ?? '').toLowerCase();
  if (complexity === 'standard' || complexity === 'modified' || complexity === 'custom') {
    rows.push({
      key: 'complexity',
      labelKey: 'specComplexity',
      value: complexity,
    });
  } else if (spec.complexity) {
    rows.push({ key: 'complexity', labelKey: 'specComplexity', value: spec.complexity });
  }

  for (const field of DIM_FIELDS) {
    const orderVal = dimValue(spec.orderDimensions ?? null, field);
    const catalogVal = dimValue(spec.catalogDimensions ?? null, field);
    if (!orderVal && !catalogVal) continue;
    rows.push({
      key: field,
      absLabelKey: `mobile.productionSetup.dims.${field}`,
      value:
        orderVal && catalogVal && orderVal !== catalogVal
          ? `${orderVal}|||${catalogVal}`
          : (orderVal || catalogVal)!,
      numeric: true,
    });
  }

  const fabricName = localizedName(locale, {
    nameEn: spec.fabric?.nameEn,
    nameAr: spec.fabric?.nameAr,
    nameHe: spec.fabric?.nameHe,
  });
  if (fabricName) rows.push({ key: 'fabric', labelKey: 'specFabricName', value: fabricName });
  if (spec.fabric?.sku) {
    rows.push({ key: 'fabricSku', labelKey: 'specFabricSku', value: spec.fabric.sku, numeric: true });
  }
  if (
    spec.requestedFabricLabel &&
    spec.requestedFabricLabel !== fabricName &&
    spec.requestedFabricLabel !== spec.fabric?.nameEn
  ) {
    rows.push({
      key: 'requestedFabric',
      labelKey: 'specRequestedFabric',
      value: spec.requestedFabricLabel,
    });
  }
  const color = spec.color || spec.fabric?.color;
  if (color) rows.push({ key: 'color', labelKey: 'specColor', value: color });

  const woodName = localizedName(locale, {
    nameEn: spec.wood?.nameEn,
    nameAr: spec.wood?.nameAr,
    nameHe: spec.wood?.nameHe,
  });
  if (woodName) {
    const wood = [woodName, spec.wood?.sku].filter(Boolean).join(' · ');
    rows.push({ key: 'wood', labelKey: 'specWoodName', value: wood });
  }

  for (const m of asMeasurementRows(spec.measurements)) {
    const value = m.unit ? `${m.value} ${m.unit}` : m.value;
    rows.push({ key: `measure:${m.key}`, label: m.label, value });
  }

  const line = formatLineSpec(spec.lineSpec);
  if (line) rows.push({ key: 'line', labelKey: 'specLine', value: line });
  if (spec.factoryNotes) {
    rows.push({ key: 'notes', labelKey: 'specFactoryNotes', value: spec.factoryNotes });
  }
  return rows;
}

/** Split `order|||catalog` dim encoding used by buildInspectionSpecRows. */
export function splitCatalogHint(value: string): { value: string; catalog?: string } {
  const idx = value.indexOf('|||');
  if (idx < 0) return { value };
  return { value: value.slice(0, idx), catalog: value.slice(idx + 3) };
}

export function groupChecklistByKit<T extends { kitId?: string | null; kitLabel?: string | null }>(
  items: T[],
): Array<{ kitId: string | null; kitLabel: string | null; items: T[] }> {
  const groups: Array<{ kitId: string | null; kitLabel: string | null; items: T[] }> = [];
  const index = new Map<string, number>();
  for (const item of items) {
    const key = item.kitId || item.kitLabel || '';
    let at = index.get(key);
    if (at == null) {
      at = groups.length;
      index.set(key, at);
      groups.push({ kitId: item.kitId ?? null, kitLabel: item.kitLabel ?? null, items: [] });
    }
    groups[at]!.items.push(item);
  }
  return groups;
}

export function dealerDetailRows(details: {
  projectName?: string | null;
  quantity?: string | null;
  width?: string | null;
  height?: string | null;
  depth?: string | null;
  seatHeight?: string | null;
  fabricType?: string | null;
  fabricColor?: string | null;
  fabricCode?: string | null;
  fabrics?: Array<{ type?: string | null; color?: string | null; code?: string | null; role?: string | null }>;
  foamDensity?: string | null;
  woodType?: string | null;
  woodColor?: string | null;
  material?: string | null;
  finish?: string | null;
  accessories?: string | null;
  description?: string | null;
  lineNotes?: string | null;
  dealerNotes?: string | null;
}): InspectionSpecRow[] {
  const rows: InspectionSpecRow[] = [];
  const push = (key: string, labelKey: string, value?: string | null, numeric?: boolean) => {
    const text = value?.trim();
    if (!text) return;
    rows.push({ key, labelKey, value: text, numeric });
  };
  push('project', 'specProject', details.projectName);
  push('qty', 'specQty', details.quantity, true);
  push('width', 'specWidth', details.width, true);
  push('depth', 'specDepth', details.depth, true);
  push('height', 'specHeight', details.height, true);
  push('seat', 'specSeatHeight', details.seatHeight, true);
  const fabricBits = [details.fabricType, details.fabricColor, details.fabricCode]
    .map((part) => part?.trim())
    .filter(Boolean);
  push('fabric', 'specFabricName', fabricBits.join(' · ') || null);
  for (const [i, fabric] of (details.fabrics ?? []).entries()) {
    if (i === 0 && fabricBits.length) continue;
    const value = [fabric.role, fabric.type, fabric.color, fabric.code]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' · ');
    push(`fabric-${i}`, 'specFabricName', value);
  }
  push('foam', 'specFoam', details.foamDensity);
  const wood = [details.woodType, details.woodColor].filter((part) => part?.trim()).join(' · ');
  push('wood', 'specWoodName', wood || null);
  push('material', 'specMaterial', details.material);
  push('finish', 'specFinish', details.finish);
  push('accessories', 'specAccessories', details.accessories);
  return rows;
}

export function paperCustomNotes(input: {
  factoryNotes?: string | null;
  lineNotes?: string | null;
  dealerNotes?: string | null;
  description?: string | null;
  lineSpec?: string | null;
}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [
    input.factoryNotes,
    input.lineNotes,
    input.dealerNotes,
    input.description,
    input.lineSpec,
  ]) {
    const text = raw?.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}
