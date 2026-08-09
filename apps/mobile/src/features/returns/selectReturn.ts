import type { Locale } from '@maher/types';
import { localizedName } from '@maher/i18n';
import type { ReturnReason, ReturnRequest } from './api';

export type ReturnCardModel = {
  id: string;
  number: string;
  productDesc: string;
  quantityLabel: string;
  reason: string;
  reasonLabelKey: string;
  description: string | null;
  approvalStatus: string;
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
};

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
    isPending: status === 'PENDING',
  };
}

export type { ReturnReason };
