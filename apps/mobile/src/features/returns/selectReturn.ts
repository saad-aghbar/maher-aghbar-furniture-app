import type { Locale } from '@maher/types';
import { localizedName } from '@maher/i18n';
import type { ReturnInventoryFate, ReturnReason, ReturnRequest } from './api';

export type ReturnCardModel = {
  id: string;
  number: string;
  productDesc: string;
  quantityLabel: string;
  reason: string;
  reasonLabelKey: string;
  description: string | null;
  approvalStatus: string;
  inventoryFate: string;
  dealerName: string;
  salesOrderId: string | null;
  salesOrderNumber: string | null;
  dealerOrderNumber: string | null;
  productImageUrl: string | null;
  reasonPhotoUrl: string | null;
  issuePhotoUrl: string | null;
  reasonPhotoUrls: string[];
  issuePhotoUrls: string[];
  isPending: boolean;
  fatePending: boolean;
  /** Approved and still in quarantine — not resolved until disposition is set. */
  beingResolved: boolean;
};

export const RETURN_FATE_OPTIONS: Exclude<ReturnInventoryFate, 'PENDING'>[] = [
  'RETURN_TO_STOCK',
  'REWORK',
  'DAMAGED',
  'SCRAP',
];

const FATE_LABEL_KEYS: Record<Exclude<ReturnInventoryFate, 'PENDING'>, string> = {
  RETURN_TO_STOCK: 'inventory.fateReturnToStock',
  REWORK: 'inventory.fateRework',
  DAMAGED: 'inventory.fateDamaged',
  SCRAP: 'inventory.fateScrap',
};

export function returnFateLabelKey(fate: string): string {
  if (fate in FATE_LABEL_KEYS) {
    return FATE_LABEL_KEYS[fate as Exclude<ReturnInventoryFate, 'PENDING'>];
  }
  return `inventory.fate${fate}`;
}

function asLocale(locale: string): Locale {
  return locale === 'ar' || locale === 'he' || locale === 'en' ? locale : 'en';
}

const KNOWN_REASONS = new Set<string>([
  'MANUFACTURING_DEFECT',
  'INCORRECT_MEASUREMENT',
  'INCORRECT_MATERIAL',
  'INCORRECT_COLOR',
  'DELIVERY_DAMAGE',
  'CUSTOMER_REQUEST',
  'OTHER',
]);

/** i18n key for a return reason — prefer catalog.returnReason.*. */
export function returnReasonLabelKey(reason: string): string {
  if (KNOWN_REASONS.has(reason)) return `catalog.returnReason.${reason}`;
  return `mobile.returns.reasons.${reason}`;
}

function photoList(
  urls: string[] | null | undefined,
  fallback: string | null | undefined,
): string[] {
  const fromArray = (urls ?? []).map((u) => u.trim()).filter(Boolean);
  if (fromArray.length) return fromArray;
  const one = fallback?.trim();
  return one ? [one] : [];
}

export function selectReturnCard(row: ReturnRequest, locale: string): ReturnCardModel {
  const typed = asLocale(locale);
  const qty = Number(row.quantity);
  const status = row.approvalStatus || 'PENDING';
  const inventoryFate = (row.inventoryFate || 'PENDING').toUpperCase();
  const fatePending = inventoryFate === 'PENDING';
  const isPending = status === 'PENDING';
  const reasonPhotoUrls = photoList(row.reasonPhotoUrls, row.reasonPhotoUrl);
  const issuePhotoUrls = photoList(row.issuePhotoUrls, row.issuePhotoUrl);
  return {
    id: row.id,
    number: row.number,
    productDesc: row.productDesc?.trim() || '—',
    quantityLabel: Number.isFinite(qty) ? String(qty) : String(row.quantity ?? '—'),
    reason: row.reason,
    reasonLabelKey: returnReasonLabelKey(row.reason),
    description: row.description?.trim() || null,
    approvalStatus: status,
    inventoryFate,
    dealerName: localizedName(
      typed,
      {
        name: row.customer?.name,
        nameEn: row.customer?.nameEn,
        nameAr: row.customer?.nameAr,
        nameHe: row.customer?.nameHe,
      },
      '—',
    ),
    salesOrderId: row.salesOrder?.id ?? null,
    salesOrderNumber: row.salesOrder?.number?.trim() || null,
    dealerOrderNumber: row.salesOrder?.externalOrderNumber?.trim() || null,
    productImageUrl: row.productImageUrl ?? null,
    reasonPhotoUrl: reasonPhotoUrls[0] ?? null,
    issuePhotoUrl: issuePhotoUrls[0] ?? null,
    reasonPhotoUrls,
    issuePhotoUrls,
    isPending,
    fatePending,
    beingResolved: status === 'APPROVED' && fatePending,
  };
}

export type { ReturnReason };
