/**
 * Order-line manufacturing complexity vs catalog Product template.
 * Never mutates the catalog Product — classification is order-specific only.
 *
 * STANDARD  — catalog product, no manufacturing-impacting changes
 * MODIFIED  — catalog product with order-specific manufacturing changes (Customized)
 * CUSTOM    — non-catalog / freeform line
 */

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

function hasCustomMeasurements(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as object).length > 0;
  return Boolean(str(value));
}

/**
 * Classify an order line relative to an optional catalog product snapshot.
 * Does not read or write the database Product row.
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
    Boolean(str(input.fabricType) || str(input.fabric) || str(input.fabricCode)),
    Boolean(str(input.fabricColor) || str(input.color)),
    Boolean(str(input.woodType) || str(input.woodColor)),
    Boolean(str(input.foamDensity)),
    Boolean(str(input.finish)),
    Boolean(str(input.accessories)),
    hasCustomMeasurements(input.customMeasurements),
    Boolean(str(input.material) && str(input.material) !== str(catalog?.material)),
    Boolean(str(input.notes)),
    Boolean(str(input.description)),
  ];

  if (manufacturingSignals.some(Boolean)) return 'MODIFIED';
  return 'STANDARD';
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
      type: str(input.fabricType) ?? str(input.fabric),
      code: str(input.fabricCode),
      color: str(input.fabricColor) ?? str(input.color),
    },
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
