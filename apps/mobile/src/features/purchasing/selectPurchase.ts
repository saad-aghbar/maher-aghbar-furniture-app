import type { Locale } from '@maher/types';
import { formatDate, formatNumber } from '@/i18n/format';
import type {
  NamedRef,
  PurchaseOrder,
  PurchaseOrderPresentation,
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
  phaseLabelKey: string | null;
  progress: number;
  attentionReason: string | null;
  primaryAction: string | null;
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

const PHASE_FALLBACKS: Record<string, string> = {
  DRAFT: 'purchasing.phaseDraft',
  ORDERED: 'purchasing.phaseOrdered',
  PARTIALLY_RECEIVED: 'purchasing.phasePartial',
  RECEIVED: 'purchasing.phaseReceived',
  CLOSED: 'purchasing.phaseClosed',
  CANCELLED: 'purchasing.phaseCancelled',
};

export function resolvePhaseLabel(
  t: (key: string, vars?: Record<string, string | number>) => string,
  presentation?: PurchaseOrderPresentation | null,
): string | null {
  if (!presentation) return null;
  const key = presentation.labelKey || PHASE_FALLBACKS[presentation.phase];
  if (!key) return presentation.phase || null;
  const translated = t(key);
  if (translated !== key) return translated;
  const fallbackKey = PHASE_FALLBACKS[presentation.phase];
  if (fallbackKey) {
    const fb = t(fallbackKey);
    if (fb !== fallbackKey) return fb;
  }
  return presentation.phase;
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
  const presentation = po.presentation;
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
    phaseLabelKey: presentation?.labelKey ?? null,
    progress: Number(presentation?.progress) || 0,
    attentionReason: presentation?.attentionReason ?? null,
    primaryAction: presentation?.primaryAction ?? null,
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

/** Merge draft lines by inventoryItemId, summing quantities. Keeps first line's cost/meta. */
export function mergeDraftLinesByItem(
  existing: DraftMaterialLine[],
  incoming: DraftMaterialLine[],
): DraftMaterialLine[] {
  const byId = new Map<string, DraftMaterialLine>();
  for (const line of [...existing, ...incoming]) {
    const prev = byId.get(line.inventoryItemId);
    if (!prev) {
      byId.set(line.inventoryItemId, { ...line });
      continue;
    }
    const qty = Number(prev.quantity) + Number(line.quantity);
    byId.set(line.inventoryItemId, {
      ...prev,
      quantity: String(Number.isFinite(qty) ? qty : prev.quantity),
    });
  }
  return [...byId.values()];
}

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
