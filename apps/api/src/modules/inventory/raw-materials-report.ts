/**
 * Pure raw-materials report math — no Prisma, no Nest.
 *
 * Quantity identity:
 *   opening + inbound − outbound ± signed adjustments = closing
 * Residual must be 0 when the ledger is complete.
 *
 * Money is never invented: missing unitCost stays null, never 0.
 */

export const RAW_MATERIALS_COST_BASIS_ID = 'standardCost+latestPurchaseReceipt' as const;
export const RAW_LEDGER_ROW_CAP = 400;

export type ReportPeriodPreset = 'today' | 'week' | 'month' | 'custom';

export type RawMovementBucket =
  | 'purchaseReceipt'
  | 'productionIssue'
  | 'productionReturn'
  | 'transferIn'
  | 'transferOut'
  | 'adjustment'
  | 'countCorrection'
  | 'damage'
  | 'scrap'
  | 'openingBalance'
  | 'otherInbound'
  | 'otherOutbound';

export type ItemQtyBuckets = Record<RawMovementBucket, number>;

export class ReportRangeError extends Error {
  readonly code = 'VALIDATION_ERROR' as const;
  constructor(message: string) {
    super(message);
    this.name = 'ReportRangeError';
  }
}

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseReportYmd(value: string): { y: number; m: number; d: number } | null {
  const match = YMD_RE.exec(String(value ?? '').trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return { y, m, d };
}

export function formatReportYmd(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function addDaysYmd(ymd: string, days: number): string {
  const parsed = parseReportYmd(ymd);
  if (!parsed) throw new ReportRangeError('Invalid date.');
  const dt = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatReportYmd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** Sunday-start week, matching mobile reportsPeriodRange / factory calendar. */
export function weekStartSundayYmd(ymd: string): string {
  const parsed = parseReportYmd(ymd);
  if (!parsed) throw new ReportRangeError('Invalid date.');
  const dt = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  dt.setUTCDate(dt.getUTCDate() - dt.getUTCDay());
  return formatReportYmd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function monthStartYmd(ymd: string): string {
  const parsed = parseReportYmd(ymd);
  if (!parsed) throw new ReportRangeError('Invalid date.');
  return formatReportYmd(parsed.y, parsed.m, 1);
}

export function normalizeReportPreset(raw: string | undefined | null): ReportPeriodPreset {
  const v = String(raw ?? 'month').trim().toLowerCase();
  if (v === 'today' || v === 'week' || v === 'month' || v === 'custom') return v;
  throw new ReportRangeError('Invalid report period.');
}

export function resolveReportPeriod(args: {
  preset?: string | null;
  from?: string | null;
  to?: string | null;
  todayYmd: string;
}): { preset: ReportPeriodPreset; fromYmd: string; toYmd: string } {
  const today = parseReportYmd(args.todayYmd);
  if (!today) throw new ReportRangeError('Invalid factory date.');
  const preset = normalizeReportPreset(args.preset);
  if (preset === 'today') {
    return { preset, fromYmd: args.todayYmd, toYmd: args.todayYmd };
  }
  if (preset === 'week') {
    return { preset, fromYmd: weekStartSundayYmd(args.todayYmd), toYmd: args.todayYmd };
  }
  if (preset === 'month') {
    return { preset, fromYmd: monthStartYmd(args.todayYmd), toYmd: args.todayYmd };
  }
  const fromYmd = String(args.from ?? '').trim();
  const toYmd = String(args.to ?? '').trim();
  if (!parseReportYmd(fromYmd) || !parseReportYmd(toYmd)) {
    throw new ReportRangeError('Custom range requires valid from and to dates.');
  }
  if (fromYmd > toYmd) {
    throw new ReportRangeError('From date must be on or before to date.');
  }
  return { preset, fromYmd, toYmd };
}

export function emptyQtyBuckets(): ItemQtyBuckets {
  return {
    purchaseReceipt: 0,
    productionIssue: 0,
    productionReturn: 0,
    transferIn: 0,
    transferOut: 0,
    adjustment: 0,
    countCorrection: 0,
    damage: 0,
    scrap: 0,
    openingBalance: 0,
    otherInbound: 0,
    otherOutbound: 0,
  };
}

/**
 * Map a ledger row to a report bucket.
 * WAREHOUSE_TRANSFER splits by signed quantity.
 * INVENTORY_ADJUSTMENT splits by InventoryCount reference.
 */
export function bucketForMovement(args: {
  type: string;
  quantity: number;
  referenceType?: string | null;
}): RawMovementBucket {
  const type = String(args.type ?? '').toUpperCase();
  const qty = Number(args.quantity) || 0;
  const ref = String(args.referenceType ?? '');
  switch (type) {
    case 'PURCHASE_RECEIPT':
      return 'purchaseReceipt';
    case 'PRODUCTION_ISSUE':
      return 'productionIssue';
    case 'PRODUCTION_RETURN':
      return 'productionReturn';
    case 'WAREHOUSE_TRANSFER':
      return qty < 0 ? 'transferOut' : 'transferIn';
    case 'INVENTORY_ADJUSTMENT':
      return ref === 'InventoryCount' ? 'countCorrection' : 'adjustment';
    case 'DAMAGE':
      return 'damage';
    case 'SCRAP':
      return 'scrap';
    case 'OPENING_BALANCE':
      return 'openingBalance';
    default:
      return qty < 0 ? 'otherOutbound' : 'otherInbound';
  }
}

export function addToBucket(buckets: ItemQtyBuckets, bucket: RawMovementBucket, signedQty: number) {
  const qty = Number(signedQty) || 0;
  if (
    bucket === 'adjustment' ||
    bucket === 'countCorrection' ||
    bucket === 'openingBalance' ||
    bucket === 'otherInbound' ||
    bucket === 'purchaseReceipt' ||
    bucket === 'productionReturn' ||
    bucket === 'transferIn'
  ) {
    buckets[bucket] += qty;
    return;
  }
  // Outbound buckets store absolute quantities (positive).
  buckets[bucket] += Math.abs(qty);
}

export function periodNetFromBuckets(buckets: ItemQtyBuckets): number {
  return (
    buckets.purchaseReceipt +
    buckets.productionReturn +
    buckets.transferIn +
    buckets.openingBalance +
    buckets.otherInbound +
    buckets.adjustment +
    buckets.countCorrection -
    buckets.productionIssue -
    buckets.transferOut -
    buckets.damage -
    buckets.scrap -
    buckets.otherOutbound
  );
}

/**
 * closing = currentOnHand − postPeriodNet
 * opening = closing − periodNet
 */
export function backComputeQuantities(args: {
  currentOnHand: number;
  postPeriodNet: number;
  periodNet: number;
}): { openingQty: number; closingQty: number } {
  const closingQty = roundQty(args.currentOnHand - args.postPeriodNet);
  const openingQty = roundQty(closingQty - args.periodNet);
  return { openingQty, closingQty };
}

export function reconcileItem(args: {
  openingQty: number;
  buckets: ItemQtyBuckets;
  closingQty: number;
}): { expectedClosing: number; residual: number } {
  const expectedClosing = roundQty(args.openingQty + periodNetFromBuckets(args.buckets));
  const residual = roundQty(args.closingQty - expectedClosing);
  return { expectedClosing, residual };
}

export function roundQty(value: number): number {
  return Number(Number(value).toFixed(3));
}

export function moneyOrNull(unitCost: number | null | undefined, qty: number): number | null {
  if (unitCost == null) return null;
  const n = Number(unitCost);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Number((Math.abs(qty) * n).toFixed(3));
}

export function categoryGroupFromInventoryCategory(
  category: string | null | undefined,
): 'fabric' | 'foam' | 'wood' | 'accessories' {
  const c = String(category ?? '').toUpperCase();
  if (c === 'FABRIC') return 'fabric';
  if (c === 'FOAM') return 'foam';
  if (c === 'WOOD') return 'wood';
  return 'accessories';
}

export type CostLookup = Map<string, number>;

/** Current-cost restatement. Missing/zero cost → null (never invent 0). */
export function valueAtCurrentCost(
  qty: number,
  sku: string,
  costs: CostLookup,
): number | null {
  if (!Number.isFinite(qty) || qty === 0) return 0;
  const unit = costs.get(sku);
  if (unit == null || !Number.isFinite(unit) || unit <= 0) return null;
  return Number((qty * unit).toFixed(3));
}

export type StockAttention = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'INACTIVE';

export function classifyRawStockStatus(args: {
  isActive: boolean;
  onHand: number;
  minStock: number;
}): StockAttention {
  if (!args.isActive) return 'INACTIVE';
  if (args.onHand <= 0) return 'OUT_OF_STOCK';
  if (args.onHand <= args.minStock) return 'LOW_STOCK';
  return 'IN_STOCK';
}

export const HUMAN_SCRAP_REASON: Record<string, { en: string; ar: string; he: string }> = {
  CUTTING_WASTE: { en: 'Cutting waste', ar: 'هدر قص', he: 'פסולת חיתוך' },
  DAMAGED: { en: 'Damaged', ar: 'تالف', he: 'פגום' },
  DEFECTIVE_MATERIAL: { en: 'Defective material', ar: 'مادة معيبة', he: 'חומר פגום' },
  MACHINE_DAMAGE: { en: 'Machine damage', ar: 'ضرر آلة', he: 'נזק ממכונה' },
  MEASUREMENT_ERROR: { en: 'Measurement error', ar: 'خطأ قياس', he: 'שגיאת מדידה' },
  REWORK: { en: 'Rework', ar: 'إعادة عمل', he: 'עבודה מחדש' },
  OTHER: { en: 'Other', ar: 'أخرى', he: 'אחר' },
};

export function humanScrapReason(
  code: string | null | undefined,
  locale: string,
): string | null {
  if (!code) return null;
  const row = HUMAN_SCRAP_REASON[code];
  if (!row) return null;
  if (locale === 'ar') return row.ar;
  if (locale === 'he') return row.he;
  return row.en;
}

export function humanTxType(type: string, locale: string): string {
  const key = String(type ?? '').toUpperCase();
  const map: Record<string, { en: string; ar: string; he: string }> = {
    PURCHASE_RECEIPT: { en: 'Purchase receipt', ar: 'استلام مشتريات', he: 'קבלת רכש' },
    PRODUCTION_ISSUE: { en: 'Issued to production', ar: 'صرف للإنتاج', he: 'ניפוק לייצור' },
    PRODUCTION_RETURN: { en: 'Returned from production', ar: 'مرتجع من الإنتاج', he: 'החזרה מייצור' },
    WAREHOUSE_TRANSFER: { en: 'Warehouse transfer', ar: 'تحويل مستودع', he: 'העברת מחסן' },
    INVENTORY_ADJUSTMENT: { en: 'Inventory adjustment', ar: 'تسوية مخزون', he: 'התאמת מלאי' },
    DAMAGE: { en: 'Damage', ar: 'تلف', he: 'נזק' },
    SCRAP: { en: 'Scrap', ar: 'هدر', he: 'גרוטאות' },
    OPENING_BALANCE: { en: 'Opening balance', ar: 'رصيد افتتاحي', he: 'יתרת פתיחה' },
  };
  const row = map[key];
  if (!row) return key;
  if (locale === 'ar') return row.ar;
  if (locale === 'he') return row.he;
  return row.en;
}

export type CategoryGroupKey = 'fabric' | 'foam' | 'wood' | 'accessories';

export type MoneyQty = { qty: number; value: number | null; uncostedRows: number };

export type RawMaterialsReportPayload = {
  generatedAt: string;
  generatedBy: string;
  locale: 'en' | 'ar' | 'he';
  timezone: string;
  currency: string;
  costBasisId: typeof RAW_MATERIALS_COST_BASIS_ID;
  costBasisLabel: string;
  period: { preset: ReportPeriodPreset; fromYmd: string; toYmd: string };
  summary: {
    skuCount: number;
    lowStockCount: number;
    outOfStockCount: number;
    receiptLineCount: number;
    issueLineCount: number;
    correctionCount: number;
    countDocumentCount: number;
    purchasesValue: number | null;
    consumptionValue: number | null;
    returnValue: number | null;
    openingValueAtCurrentCost: number | null;
    closingValueAtCurrentCost: number | null;
    incompleteValuationSkuCount: number;
    incompleteValuationMovementCount: number;
  };
  categories: Array<{
    group: CategoryGroupKey;
    skuCount: number;
    lowStockCount: number;
    openingValue: number | null;
    purchasesValue: number | null;
    consumptionValue: number | null;
    closingValue: number | null;
    primaryUnit: string | null;
  }>;
  warehouses: Array<{
    warehouseId: string;
    code: string;
    name: string;
    openingQtyKnown: boolean;
    /** Set when every SKU in the warehouse shares one unit; otherwise mixed. */
    primaryUnit: string | null;
    inboundQty: number;
    outboundQty: number;
    closingOnHand: number;
    reserved: number;
    free: number;
    openingValue: number | null;
    inboundValue: number | null;
    outboundValue: number | null;
    closingValue: number | null;
  }>;
  purchases: Array<{
    date: string;
    grnNumber: string | null;
    poNumber: string | null;
    supplierName: string | null;
    sku: string;
    material: string;
    category: CategoryGroupKey;
    warehouseCode: string;
    qty: number;
    unit: string;
    unitCost: number | null;
    value: number | null;
  }>;
  suppliers: Array<{ name: string; receipts: number; value: number | null; materials: string[] }>;
  consumption: Array<{
    date: string;
    sku: string;
    material: string;
    qty: number;
    unit: string;
    salesOrderNumber: string | null;
    productionOrderNumber: string | null;
    stage: string | null;
    taskNumber: string | null;
    worker: string | null;
    value: number | null;
  }>;
  returns: Array<{
    date: string;
    sku: string;
    material: string;
    qty: number;
    unit: string;
    productionOrderNumber: string | null;
    taskNumber: string | null;
    warehouseCode: string;
    value: number | null;
  }>;
  scrap: Array<{
    date: string | null;
    sku: string;
    material: string;
    qty: number;
    unit: string;
    reason: string | null;
    productionOrderNumber: string | null;
    taskNumber: string | null;
    recordedBy: string | null;
    value: number | null;
  }>;
  adjustments: Array<{
    date: string;
    sku: string;
    material: string;
    qty: number;
    unit: string;
    kind: 'countCorrection' | 'adjustment';
    notes: string | null;
    warehouseCode: string;
    userName: string | null;
  }>;
  counts: Array<{
    number: string;
    date: string | null;
    warehouseCode: string;
    warehouseName: string;
    itemsCounted: number;
    matched: number;
    differences: number;
    positiveVarianceQty: number;
    negativeVarianceQty: number;
    netValueVariance: number | null;
    completedBy: string | null;
    lines: Array<{
      sku: string;
      material: string;
      systemQty: number;
      countedQty: number | null;
      varianceQty: number | null;
      valueDiff: number | null;
    }>;
  }>;
  transfers: Array<{
    date: string;
    transferNumber: string | null;
    sku: string;
    material: string;
    qty: number;
    fromWarehouse: string;
    toWarehouse: string;
  }>;
  variance: Array<{
    sku: string;
    material: string;
    unit: string;
    planned: number;
    actual: number;
    difference: number;
    differencePct: number | null;
  }>;
  topConsumed: Array<{
    sku: string;
    material: string;
    category: CategoryGroupKey;
    qty: number;
    unit: string;
    value: number | null;
  }>;
  topPurchased: Array<{
    sku: string;
    material: string;
    supplier: string | null;
    qty: number;
    value: number | null;
  }>;
  byProductionOrder: Array<{
    productionOrderNumber: string;
    salesOrderNumber: string | null;
    productName: string | null;
    lines: Array<{ category: CategoryGroupKey; qty: number; unit: string; value: number | null }>;
    totalValue: number | null;
  }>;
  lowStock: Array<{
    sku: string;
    material: string;
    category: CategoryGroupKey;
    onHand: number;
    reserved: number;
    free: number;
    minStock: number;
    unit: string;
  }>;
  outOfStock: Array<{
    sku: string;
    material: string;
    category: CategoryGroupKey;
    reserved: number;
    minStock: number;
    unit: string;
  }>;
  demand: Array<{
    sku: string;
    material: string;
    requiredQty: number;
    freeQty: number;
    incomingQty: number;
    status: string;
    orders: string[];
  }>;
  incompleteValuation: Array<{ sku: string; material: string; reason: string }>;
  attention: Array<{ kind: string; title: string; why: string }>;
  items: Array<{
    sku: string;
    material: string;
    category: CategoryGroupKey;
    unit: string;
    openingQty: number;
    received: number;
    issued: number;
    returned: number;
    scrap: number;
    adjustments: number;
    transfersIn: number;
    transfersOut: number;
    closingQty: number;
    reserved: number;
    free: number;
    unitCost: number | null;
    closingValue: number | null;
    residual: number;
    stockStatus: StockAttention;
  }>;
  ledger: {
    shown: number;
    total: number;
    rows: Array<{
      date: string;
      type: string;
      typeLabel: string;
      reference: string | null;
      sku: string;
      material: string;
      warehouseCode: string;
      qty: number;
      unit: string;
      value: number | null;
      userName: string | null;
    }>;
  };
};
