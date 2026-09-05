/**
 * Order-line manufacturing complexity vs catalog Product template.
 * Never mutates the catalog Product — classification is order-specific only.
 *
 * STANDARD  — catalog product, no manufacturing-impacting changes
 * MODIFIED  — catalog product with order-specific manufacturing changes (Customized)
 * CUSTOM    — non-catalog / freeform line
 */

import {
  normalizeOrderFabrics,
  primaryFabric,
  type OrderFabricSelection,
} from './fabric-selection';

export type ManufacturingComplexityCode = 'STANDARD' | 'MODIFIED' | 'CUSTOM';

/** Extensible order-line measurement row (Piece 4). */
export type OrderMeasurement = {
  key: string;
  label: string;
  value: number | string | null;
  unit?: string | null;
  catalogValue?: number | string | null;
};

export type CatalogDiffRow = {
  field: string;
  label: string;
  from: unknown;
  to: unknown;
  delta?: number | null;
};

export type CatalogDimRef = {
  width?: number | null;
  height?: number | null;
  depth?: number | null;
  seatHeight?: number | null;
  material?: string | null;
  /** Catalog Product.customMeasurements JSON — compared, never presence-only. */
  customMeasurements?: unknown;
};

export type OrderLineClassifyInput = {
  productId?: string | null;
  width?: number | null;
  height?: number | null;
  depth?: number | null;
  seatHeight?: number | null;
  material?: string | null;
  fabricType?: string | null;
  fabricCode?: string | null;
  fabricColor?: string | null;
  /** Quotation-line fabric field */
  fabric?: string | null;
  color?: string | null;
  woodType?: string | null;
  woodColor?: string | null;
  foamDensity?: string | null;
  finish?: string | null;
  accessories?: string | null;
  notes?: string | null;
  description?: string | null;
  customMeasurements?: unknown;
  catalog?: CatalogDimRef | null;
};

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function dimDiffers(
  ordered: number | null | undefined,
  catalog: number | null | undefined,
): boolean {
  const a = num(ordered);
  const b = num(catalog);
  if (a == null) return false;
  if (b == null) return true;
  return Math.abs(a - b) > 0.001;
}

function normalizeMeasurementToken(value: unknown): string | null {
  const raw = str(value);
  if (!raw) return null;
  return raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[_\-/.,'"`׳״]/g, ' ')
    .replace(/\b(cm|سم|סמ)\b/g, ' ')
    .replace(/\s+/g, '');
}

const SEAT_HEIGHT_TOKENS = new Set([
  'seat',
  'seatheight',
  'seatheightcm',
  'dimseat',
  'ارتفاعالمقعد',
  'גובהמושב',
]);

function isSeatHeightToken(token: string): boolean {
  if (SEAT_HEIGHT_TOKENS.has(token)) return true;
  return token.includes('seatheight') || token.endsWith('seat');
}

type MeasurementCompareRow = {
  tokens: Set<string>;
  value: number | string | null;
  catalogValue: number | string | null;
};

function measurementValue(raw: unknown): number | string | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const asNum = num(raw);
  if (asNum != null) return asNum;
  return str(raw);
}

function valuesDiffer(ordered: number | string | null, catalog: number | string | null): boolean {
  if (ordered == null) return false;
  if (catalog == null) return true;
  if (typeof ordered === 'number' && typeof catalog === 'number') {
    return Math.abs(ordered - catalog) > 0.001;
  }
  return String(ordered).trim().toLowerCase() !== String(catalog).trim().toLowerCase();
}

function measurementTokensFromRecord(row: Record<string, unknown>): Set<string> {
  const tokens = new Set<string>();
  for (const key of ['key', 'id', 'nameEn', 'name', 'label', 'nameAr', 'nameHe'] as const) {
    const token = normalizeMeasurementToken(row[key]);
    if (token) tokens.add(token);
  }
  return tokens;
}

function measurementRowsFromUnknown(value: unknown): MeasurementCompareRow[] {
  if (value == null) return [];
  const list = Array.isArray(value) ? value : [value];
  const rows: MeasurementCompareRow[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const tokens = measurementTokensFromRecord(r);
    if (tokens.size === 0) continue;
    rows.push({
      tokens,
      value: measurementValue(r.value ?? r.val),
      catalogValue: measurementValue(r.catalogValue ?? r.catalog),
    });
  }
  return rows;
}

function tokensOverlap(a: Set<string>, b: Set<string>): boolean {
  for (const token of a) {
    if (b.has(token)) return true;
  }
  return false;
}

/**
 * True when order measurements change manufacturing spec vs catalog.
 * Catalog-seeded rows (same label + same value) are not a signal.
 * An added row with no catalog counterpart is a signal.
 * A row whose value equals its own catalogValue is not a signal.
 */
function customMeasurementsDiffer(
  ordered: unknown,
  catalog: CatalogDimRef | null,
): boolean {
  const orderRows = measurementRowsFromUnknown(ordered);
  if (!orderRows.length) return false;
  const catalogRows = measurementRowsFromUnknown(catalog?.customMeasurements);
  const catalogSeat = num(catalog?.seatHeight);

  for (const row of orderRows) {
    if (row.value == null) continue;
    if (row.catalogValue != null && !valuesDiffer(row.value, row.catalogValue)) continue;

    const matched = catalogRows.find((candidate) => tokensOverlap(row.tokens, candidate.tokens));
    if (matched) {
      if (valuesDiffer(row.value, matched.value)) return true;
      continue;
    }

    const seatRow = [...row.tokens].some(isSeatHeightToken);
    if (seatRow) {
      if (valuesDiffer(row.value, catalogSeat)) return true;
      continue;
    }

    return true;
  }
  return false;
}

/**
 * Classify an order line relative to an optional catalog product snapshot.
 * Does not read or write the database Product row.
 *
 * Fabric, fabric colour, notes, and description are commercial options — not
 * manufacturing signals. Custom measurements are compared to catalog, not
 * treated as modified merely because they were seeded from the product.
 */
export function classifyManufacturingComplexity(
  input: OrderLineClassifyInput,
): ManufacturingComplexityCode {
  if (!input.productId) return 'CUSTOM';

  const catalog = input.catalog ?? null;
  const manufacturingSignals: boolean[] = [
    dimDiffers(input.width, catalog?.width),
    dimDiffers(input.height, catalog?.height),
    dimDiffers(input.depth, catalog?.depth),
    dimDiffers(input.seatHeight, catalog?.seatHeight),
    Boolean(str(input.woodType) || str(input.woodColor)),
    Boolean(str(input.foamDensity)),
    Boolean(str(input.finish)),
    Boolean(str(input.accessories)),
    customMeasurementsDiffer(input.customMeasurements, catalog),
    Boolean(str(input.material) && str(input.material) !== str(catalog?.material)),
  ];

  if (manufacturingSignals.some(Boolean)) return 'MODIFIED';
  return 'STANDARD';
}

export function parseManufacturingComplexity(
  value: string | null | undefined,
): ManufacturingComplexityCode | null {
  const c = String(value ?? '').toUpperCase();
  if (c === 'STANDARD' || c === 'MODIFIED' || c === 'CUSTOM') return c;
  return null;
}

export type OrderTypeLineInput =
  | string
  | null
  | undefined
  | {
      manufacturingComplexity?: string | null;
      productId?: string | null;
    };

/**
 * Worst-line-wins rollup: CUSTOM > MODIFIED > STANDARD.
 * Null complexity with a productId counts as STANDARD; null without productId
 * counts as CUSTOM. Empty input is STANDARD.
 */
export function rollupOrderType(lines: OrderTypeLineInput[]): ManufacturingComplexityCode {
  let worst: ManufacturingComplexityCode = 'STANDARD';
  for (const raw of lines) {
    const line =
      raw != null && typeof raw === 'object'
        ? raw
        : { manufacturingComplexity: raw, productId: null as string | null };
    const code = parseManufacturingComplexity(line.manufacturingComplexity);
    if (code === 'CUSTOM') return 'CUSTOM';
    if (code === 'MODIFIED') {
      worst = 'MODIFIED';
      continue;
    }
    if (code === 'STANDARD') continue;
    if (!str(line.productId)) return 'CUSTOM';
  }
  return worst;
}

export type OrderTypeSlug = 'standard' | 'modified' | 'custom';

export type OrderTypeCounts = {
  standard: number;
  modified: number;
  custom: number;
};

export function emptyOrderTypeCounts(): OrderTypeCounts {
  return { standard: 0, modified: 0, custom: 0 };
}

export function manufacturingComplexityToTypeSlug(
  code: ManufacturingComplexityCode,
): OrderTypeSlug {
  if (code === 'CUSTOM') return 'custom';
  if (code === 'MODIFIED') return 'modified';
  return 'standard';
}

/** Facet tally of already-rolled order types. Does not re-classify lines. */
export function tallyOrderTypeCounts(
  types: ManufacturingComplexityCode[],
): OrderTypeCounts {
  const counts = emptyOrderTypeCounts();
  for (const type of types) {
    counts[manufacturingComplexityToTypeSlug(type)] += 1;
  }
  return counts;
}

/** Dealer/admin display key (i18n): standard | customized | custom */
export function manufacturingComplexityDisplayKey(
  code: ManufacturingComplexityCode | string | null | undefined,
): 'standard' | 'customized' | 'custom' {
  switch ((code ?? '').toUpperCase()) {
    case 'STANDARD':
      return 'standard';
    case 'MODIFIED':
      return 'customized';
    case 'CUSTOM':
      return 'custom';
    default:
      return 'custom';
  }
}

export type OrderLineSpecSnapshot = {
  productId: string | null;
  productName: string;
  productImageRef?: string | null;
  quantity: number;
  catalogDimensions?: {
    width?: number | null;
    height?: number | null;
    depth?: number | null;
    seatHeight?: number | null;
  } | null;
  requestedDimensions?: {
    width?: number | null;
    height?: number | null;
    depth?: number | null;
    seatHeight?: number | null;
  } | null;
  fabric?: {
    type?: string | null;
    code?: string | null;
    color?: string | null;
  } | null;
  /** Canonical multi-fabric list. Singular `fabric` remains for back-compat. */
  fabrics?: OrderFabricSelection[];
  material?: string | null;
  notes?: string | null;
  modifications?: string | null;
  manufacturingComplexity: ManufacturingComplexityCode;
  /** Extensible named measurements from RFQ / setup (Piece 4). */
  customMeasurements?: OrderMeasurement[] | null;
  attachmentIds?: string[];
  dealerReference?: string | null;
  requiredDeliveryDate?: string | null;
};

export function buildOrderLineSpecSnapshot(input: {
  productId?: string | null;
  productName: string;
  productImageRef?: string | null;
  quantity: number;
  catalog?: CatalogDimRef | null;
  width?: number | null;
  height?: number | null;
  depth?: number | null;
  seatHeight?: number | null;
  fabricType?: string | null;
  fabricCode?: string | null;
  fabricColor?: string | null;
  fabric?: string | null;
  color?: string | null;
  fabrics?: unknown;
  material?: string | null;
  notes?: string | null;
  description?: string | null;
  customMeasurements?: unknown;
  manufacturingComplexity?: ManufacturingComplexityCode | null;
  attachmentIds?: string[];
  dealerReference?: string | null;
  requiredDeliveryDate?: string | Date | null;
}): OrderLineSpecSnapshot {
  const complexity =
    input.manufacturingComplexity ??
    classifyManufacturingComplexity({
      productId: input.productId,
      width: input.width,
      height: input.height,
      depth: input.depth,
      seatHeight: input.seatHeight,
      material: input.material,
      fabricType: input.fabricType ?? input.fabric,
      fabricCode: input.fabricCode,
      fabricColor: input.fabricColor ?? input.color,
      notes: input.notes,
      description: input.description,
      customMeasurements: input.customMeasurements,
      catalog: input.catalog,
    });

  const delivery =
    input.requiredDeliveryDate == null
      ? null
      : typeof input.requiredDeliveryDate === 'string'
        ? input.requiredDeliveryDate
        : input.requiredDeliveryDate.toISOString();

  const fabrics = normalizeOrderFabrics(input.fabrics, {
    type: input.fabricType ?? input.fabric,
    code: input.fabricCode,
    color: input.fabricColor ?? input.color,
  });
  const primary = primaryFabric(fabrics);

  return {
    productId: input.productId ?? null,
    productName: input.productName,
    productImageRef: input.productImageRef ?? null,
    quantity: Number(input.quantity),
    catalogDimensions: input.catalog
      ? {
          width: num(input.catalog.width),
          height: num(input.catalog.height),
          depth: num(input.catalog.depth),
          seatHeight: num(input.catalog.seatHeight),
        }
      : null,
    requestedDimensions: {
      width: num(input.width),
      height: num(input.height),
      depth: num(input.depth),
      seatHeight: num(input.seatHeight),
    },
    fabric: {
      type: primary?.type ?? str(input.fabricType) ?? str(input.fabric),
      code: primary?.code ?? str(input.fabricCode),
      color: primary?.color ?? str(input.fabricColor) ?? str(input.color),
    },
    fabrics,
    material: str(input.material),
    notes: str(input.notes),
    modifications: str(input.description),
    manufacturingComplexity: complexity,
    customMeasurements: normalizeOrderMeasurements(input.customMeasurements),
    attachmentIds: input.attachmentIds ?? [],
    dealerReference: str(input.dealerReference),
    requiredDeliveryDate: delivery,
  };
}

/** Normalize unknown RFQ/setup measurement payloads into OrderMeasurement[]. */
export function normalizeOrderMeasurements(value: unknown): OrderMeasurement[] | null {
  if (value == null) return null;
  if (!Array.isArray(value)) return null;
  const rows: OrderMeasurement[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const key = str(r.key) ?? str(r.id) ?? str(r.nameEn) ?? str(r.name);
    if (!key) continue;
    const label =
      str(r.label) ??
      str(r.nameEn) ??
      str(r.name) ??
      key;
    const valueRaw = r.value ?? r.val ?? null;
    const catalogValue = r.catalogValue ?? r.catalog ?? null;
    rows.push({
      key,
      label,
      value:
        valueRaw == null || valueRaw === ''
          ? null
          : typeof valueRaw === 'number'
            ? valueRaw
            : Number.isFinite(Number(valueRaw))
              ? Number(valueRaw)
              : String(valueRaw),
      unit: str(r.unit),
      catalogValue:
        catalogValue == null || catalogValue === ''
          ? null
          : typeof catalogValue === 'number'
            ? catalogValue
            : Number.isFinite(Number(catalogValue))
              ? Number(catalogValue)
              : String(catalogValue),
    });
  }
  return rows.length ? rows : null;
}

const DIM_LABELS: Record<string, string> = {
  width: 'Width',
  height: 'Height',
  depth: 'Depth',
  seatHeight: 'Seat height',
};

/**
 * Human-readable catalog vs order differences for Production Setup (Piece 4).
 * Does not mutate catalog. Empty when STANDARD or CUSTOM (no fake compare).
 */
export function buildCatalogDiff(input: {
  complexity: ManufacturingComplexityCode | string | null | undefined;
  catalogDimensions?: CatalogDimRef | null;
  orderDimensions?: CatalogDimRef | null;
  catalogFabricLabel?: string | null;
  orderFabricLabel?: string | null;
  measurements?: OrderMeasurement[] | null;
  /** When true, always emit empty (CUSTOM / no product). */
  skipCompare?: boolean;
}): CatalogDiffRow[] {
  const complexity = String(input.complexity ?? '').toUpperCase();
  if (input.skipCompare || complexity === 'CUSTOM' || complexity === 'STANDARD') {
    // STANDARD: no manufacturing-relevant delta expected; still surface explicit measurement diffs if present
    if (complexity === 'STANDARD') {
      return measurementDiffRows(input.measurements).length
        ? measurementDiffRows(input.measurements)
        : [];
    }
    return [];
  }
  if (complexity !== 'MODIFIED') return [];

  const rows: CatalogDiffRow[] = [];
  const catalog = input.catalogDimensions ?? null;
  const order = input.orderDimensions ?? null;
  for (const field of ['width', 'height', 'depth', 'seatHeight'] as const) {
    const from = num(catalog?.[field]);
    const to = num(order?.[field]);
    if (from == null && to == null) continue;
    if (from == null || to == null || Math.abs(from - to) > 0.001) {
      rows.push({
        field,
        label: DIM_LABELS[field] ?? field,
        from,
        to,
        delta: from != null && to != null ? to - from : null,
      });
    }
  }

  const catalogFabric = str(input.catalogFabricLabel);
  const orderFabric = str(input.orderFabricLabel);
  if (orderFabric && orderFabric !== catalogFabric) {
    rows.push({
      field: 'fabric',
      label: 'Fabric',
      from: catalogFabric,
      to: orderFabric,
      delta: null,
    });
  }

  rows.push(...measurementDiffRows(input.measurements));
  return rows;
}

function measurementDiffRows(
  measurements: OrderMeasurement[] | null | undefined,
): CatalogDiffRow[] {
  const rows: CatalogDiffRow[] = [];
  for (const m of measurements ?? []) {
    const from =
      m.catalogValue == null || m.catalogValue === ''
        ? null
        : typeof m.catalogValue === 'number'
          ? m.catalogValue
          : Number.isFinite(Number(m.catalogValue))
            ? Number(m.catalogValue)
            : String(m.catalogValue);
    const to =
      m.value == null || m.value === ''
        ? null
        : typeof m.value === 'number'
          ? m.value
          : Number.isFinite(Number(m.value))
            ? Number(m.value)
            : String(m.value);
    if (from == null && to == null) continue;
    const bothNum = typeof from === 'number' && typeof to === 'number';
    if (bothNum && Math.abs(from - to) <= 0.001) continue;
    if (!bothNum && from === to) continue;
    rows.push({
      field: `measurement:${m.key}`,
      label: m.label || m.key,
      from,
      to,
      delta: bothNum ? to - from : null,
    });
  }
  return rows;
}
