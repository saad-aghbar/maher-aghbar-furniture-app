import { pickPluralKey } from '@maher/i18n';
import type { Locale } from '@maher/types';
import { formatDate, formatNumber } from '@/i18n/format';
import { translatePlural } from '@/i18n/translate';
import type {
  NamedRef,
  PurchaseOrder,
  PurchaseRequest,
  SupplierInvoice,
} from './api';

export type PurchaseCardModel = {
  id: string;
  number: string;
  supplierName: string;
  status: string;
  totalLabel: string;
  expectedLabel: string | null;
  lineCount: number;
  warehouseLabel: string | null;
};

export type PurchaseRequestCardModel = {
  id: string;
  number: string;
  status: string;
  reason: string;
  supplierName: string;
  offerCount: number;
  linkedPoNumber: string | null;
  warehouseLabel: string | null;
};

export type SupplierInvoiceCardModel = {
  id: string;
  number: string;
  status: string;
  supplierName: string;
  linkedPoNumber: string | null;
  outstanding: number;
  outstandingLabel: string;
  totalLabel: string;
  paidLabel: string;
  dueDateLabel: string | null;
  hasBalance: boolean;
};

function asLocale(locale: string): Locale {
  return locale === 'ar' || locale === 'he' || locale === 'en' ? locale : 'en';
}

function toNum(v: number | string | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function moneyLabel(locale: string, value: number): string {
  return formatNumber(asLocale(locale), value, { maximumFractionDigits: 2 });
}

/** Field label: Warehouse when there is one (or none), Warehouses when several. */
export function warehouseFieldCount(warehouse: NamedRef | null | undefined): number {
  return warehouse ? 1 : 0;
}

function qtyDisplay(quantity: number | string | null | undefined): string {
  if (quantity == null || quantity === '') return '—';
  const raw = typeof quantity === 'string' ? quantity.trim() : String(quantity);
  const n = Number(raw);
  if (Number.isFinite(n) && Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
  return raw;
}

function resolvedPlural(
  locale: Locale,
  baseKey: string,
  count: number,
  qtyText: string,
): string | null {
  const label = translatePlural(locale, baseKey, count, { n: qtyText });
  if (label === baseKey || label === pickPluralKey(baseKey, count)) return null;
  return label;
}

/**
 * Qty + unit copy. `block` always pluralizes (24 blocks). Unknown units stay
 * honest to the backend code, e.g. `24 m`.
 */
export function purchaseLineQtyLabel(
  locale: string,
  quantity: number | string | null | undefined,
  unit?: string | null,
): string {
  const qtyText = qtyDisplay(quantity);
  const unitKey = unit?.trim() || 'pcs';
  const n = Number(quantity);
  const count = Number.isFinite(n) ? n : 0;
  const typed = asLocale(locale);
  const catalogUnit = unitKey.toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (catalogUnit === 'block') {
    return (
      resolvedPlural(typed, 'mobile.purchasing.qtyBlock', count, qtyText) ??
      resolvedPlural(typed, 'catalog.qtyWithUnit.block', count, qtyText) ??
      (count === 1 ? `${qtyText} block` : `${qtyText} blocks`)
    );
  }
  if (!catalogUnit) return `${qtyText} ${unitKey}`;
  return (
    resolvedPlural(typed, `catalog.qtyWithUnit.${catalogUnit}`, count, qtyText) ??
    `${qtyText} ${unitKey}`
  );
}

export function localizedNamed(
  locale: string,
  row: NamedRef | null | undefined,
  fallback = '—',
): string {
  if (!row) return fallback;
  if (locale === 'ar') return row.nameAr || row.nameEn || row.name || row.code || fallback;
  if (locale === 'he') {
    return row.nameHe || row.nameEn || row.name || row.nameAr || row.code || fallback;
  }
  return row.nameEn || row.name || row.nameAr || row.code || fallback;
}

/** Resolve PR supplier: selected offer → linked PO → preferred → first offer. */
export function resolvePurchaseRequestSupplier(
  pr: PurchaseRequest,
  locale: string,
): string {
  const selected = pr.offers?.find((o) => o.isSelected);
  if (selected?.supplier) return localizedNamed(locale, selected.supplier);
  if (pr.purchaseOrder?.supplier) return localizedNamed(locale, pr.purchaseOrder.supplier);
  if (pr.preferredSupplier) return localizedNamed(locale, pr.preferredSupplier);
  const first = pr.offers?.[0]?.supplier;
  if (first) return localizedNamed(locale, first);
  return '—';
}

export function selectPurchaseCard(
  po: PurchaseOrder,
  locale: string,
  warehouseName?: string | null,
): PurchaseCardModel {
  const typed = asLocale(locale);
  const total = toNum(po.total);
  return {
    id: po.id,
    number: po.number,
    supplierName: localizedNamed(locale, po.supplier),
    status: po.status,
    totalLabel: moneyLabel(locale, total),
    expectedLabel: po.expectedDeliveryDate
      ? formatDate(typed, po.expectedDeliveryDate)
      : null,
    lineCount: po.lines?.length ?? 0,
    warehouseLabel: warehouseName?.trim() || null,
  };
}

export function selectPurchaseRequestCard(
  pr: PurchaseRequest,
  locale: string,
): PurchaseRequestCardModel {
  return {
    id: pr.id,
    number: pr.number,
    status: pr.status,
    reason: pr.reason?.trim() || '—',
    supplierName: resolvePurchaseRequestSupplier(pr, locale),
    offerCount: pr.offers?.length ?? 0,
    linkedPoNumber: pr.purchaseOrder?.number?.trim() || null,
    warehouseLabel: pr.warehouse
      ? localizedNamed(locale, pr.warehouse)
      : null,
  };
}

export function selectSupplierInvoiceCard(
  inv: SupplierInvoice,
  locale: string,
): SupplierInvoiceCardModel {
  const typed = asLocale(locale);
  const outstanding = toNum(inv.outstandingAmount);
  const total = toNum(inv.total);
  const paid = toNum(inv.paidAmount ?? Math.max(0, total - outstanding));
  return {
    id: inv.id,
    number: inv.number,
    status: inv.status,
    supplierName: localizedNamed(locale, inv.supplier),
    linkedPoNumber: inv.purchaseOrder?.number?.trim() || null,
    outstanding,
    outstandingLabel: moneyLabel(locale, outstanding),
    totalLabel: moneyLabel(locale, total),
    paidLabel: moneyLabel(locale, paid),
    dueDateLabel: inv.dueDate ? formatDate(typed, inv.dueDate) : null,
    hasBalance: outstanding > 0,
  };
}

export type DraftMaterialLine = {
  key: string;
  inventoryItemId: string;
  description: string;
  unit: string;
  quantity: string;
  unitCost: string;
};

export function lineTotal(qty: string, unitCost: string): number {
  const q = Number(qty);
  const c = Number(unitCost);
  if (!Number.isFinite(q) || !Number.isFinite(c)) return 0;
  return q * c;
}

export function grandTotal(lines: DraftMaterialLine[]): {
  subtotal: number;
  tax: number;
  total: number;
} {
  const subtotal = lines.reduce((s, l) => s + lineTotal(l.quantity, l.unitCost), 0);
  const tax = subtotal * 0.16;
  return { subtotal, tax, total: subtotal + tax };
}

export type PurchaseDetailLineModel = {
  key: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  receivedQty: number;
  remainingQty: number;
};

export type PurchaseDetailReceiptModel = {
  id: string;
  number: string;
  date: string | null;
};

export type PurchaseDetailModel = {
  id: string;
  number: string;
  status: string;
  supplierName: string;
  notes: string | null;
  expectedDeliveryDate: string | null;
  /** Backend `total` — tax-inclusive. */
  grandTotalInclTax: number;
  /** Backend `subtotal` when present, else qty × unit (net, no tax). */
  expectedNet: number;
  /** Received qty × unit price (net). */
  actualReceivedNet: number;
  /** actualReceivedNet − expectedNet (same net family). */
  varianceNet: number;
  orderedQty: number;
  receivedQty: number;
  remainingQty: number;
  receivedPercent: number;
  lines: PurchaseDetailLineModel[];
  receipts: PurchaseDetailReceiptModel[];
};

function hasMoney(v: number | string | null | undefined): boolean {
  return v != null && v !== '';
}

/** Accepted qty posted on goods receipts, keyed by inventory item. */
function acceptedByItem(po: PurchaseOrder): Map<string, number> {
  const map = new Map<string, number>();
  for (const grn of po.goodsReceipts ?? []) {
    for (const line of grn.lines ?? []) {
      if (!line.inventoryItemId) continue;
      const accepted = Math.max(0, toNum(line.receivedQty) - toNum(line.rejectedQty));
      map.set(line.inventoryItemId, (map.get(line.inventoryItemId) ?? 0) + accepted);
    }
  }
  return map;
}

/**
 * Detail numbers honest to the PO payload: grand stays tax-inclusive `total`,
 * variance stays net (qty × unit). Does not invent a tax row to close the gap.
 */
export function selectPurchaseDetail(po: PurchaseOrder, locale: string): PurchaseDetailModel {
  const acceptedPool = acceptedByItem(po);
  const lines: PurchaseDetailLineModel[] = [];
  let lineNet = 0;
  let orderedQty = 0;
  let receivedQty = 0;
  let remainingQty = 0;
  let actualReceivedNet = 0;

  for (const [idx, line] of (po.lines ?? []).entries()) {
    const quantity = toNum(line.quantity);
    const unitPrice = toNum(line.unitPrice);
    lineNet += quantity * unitPrice;
    orderedQty += quantity;

    let received = 0;
    if (line.inventoryItemId) {
      const pool = acceptedPool.get(line.inventoryItemId) ?? 0;
      received = Math.min(quantity, Math.max(0, pool));
      acceptedPool.set(line.inventoryItemId, pool - received);
    }
    const remaining = Math.max(0, quantity - received);
    receivedQty += received;
    remainingQty += remaining;
    actualReceivedNet += received * unitPrice;

    lines.push({
      key: line.id ?? String(idx),
      description: line.description,
      quantity,
      unit: line.unit || line.inventoryItem?.unit || 'pcs',
      unitPrice,
      receivedQty: received,
      remainingQty: remaining,
    });
  }

  const sub = hasMoney(po.subtotal) ? toNum(po.subtotal) : NaN;
  const expectedNet =
    Number.isFinite(sub) && !(sub === 0 && lineNet > 0) ? sub : lineNet;
  const grand = hasMoney(po.total) ? toNum(po.total) : NaN;
  const grandTotalInclTax = Number.isFinite(grand) ? grand : lineNet;
  const receivedPercent =
    orderedQty > 0 ? Math.round((receivedQty / orderedQty) * 100) : 0;

  const receipts: PurchaseDetailReceiptModel[] = (po.goodsReceipts ?? []).map((grn) => ({
    id: grn.id,
    number: grn.number?.trim() || grn.id,
    date: grn.receiptDate || grn.createdAt || null,
  }));

  return {
    id: po.id,
    number: po.number,
    status: po.status,
    supplierName: localizedNamed(locale, po.supplier),
    notes: po.notes?.trim() || null,
    expectedDeliveryDate: po.expectedDeliveryDate ?? null,
    grandTotalInclTax,
    expectedNet,
    actualReceivedNet,
    varianceNet: actualReceivedNet - expectedNet,
    orderedQty,
    receivedQty,
    remainingQty,
    receivedPercent,
    lines,
    receipts,
  };
}
