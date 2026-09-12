import { localizedName } from '@maher/i18n';
import type { DealerDeliveryDto } from '@/api/modules/scheduling';

export type DealerReceiptKind = 'awaiting' | 'received';
export type DealerReceiptTileKey = DealerReceiptKind;

export type DealerReceiptStampCounts = Record<DealerReceiptTileKey, number>;

export function receiptKindFromStatus(
  status: string | null | undefined,
): DealerReceiptKind | null {
  const s = String(status ?? '').toUpperCase();
  if (s === 'OUT_FOR_DELIVERY' || s === 'SHIPPED') return 'awaiting';
  if (s === 'DELIVERED') return 'received';
  return null;
}

/** Left the factory — shipped or received. Ready stays on Orders / Schedule. */
export function isLeftFactory(status: string | null | undefined): boolean {
  return receiptKindFromStatus(status) != null;
}

export function matchesDealerReceiptTile(
  status: string | null | undefined,
  tile: DealerReceiptTileKey | null,
): boolean {
  const kind = receiptKindFromStatus(status);
  if (!kind) return false;
  if (!tile) return true;
  return kind === tile;
}

export function countDealerReceiptStamps(rows: DealerDeliveryDto[]): DealerReceiptStampCounts {
  const counts: DealerReceiptStampCounts = { awaiting: 0, received: 0 };
  for (const row of uniqueReceiptRows(rows)) {
    const kind = receiptKindFromStatus(row.customerStatus);
    if (kind) counts[kind] += 1;
  }
  return counts;
}

export function uniqueReceiptRows(rows: DealerDeliveryDto[]): DealerDeliveryDto[] {
  const map = new Map<string, DealerDeliveryDto>();
  for (const row of rows) {
    if (!isLeftFactory(row.customerStatus)) continue;
    const prev = map.get(row.salesOrderId);
    if (!prev) {
      map.set(row.salesOrderId, row);
      continue;
    }
    const nextKind = receiptKindFromStatus(row.customerStatus);
    const prevKind = receiptKindFromStatus(prev.customerStatus);
    if (nextKind === 'awaiting' && prevKind !== 'awaiting') {
      map.set(row.salesOrderId, row);
    }
  }
  return [...map.values()];
}

export function filterDealerReceipts(
  rows: DealerDeliveryDto[],
  tile: DealerReceiptTileKey | null,
  search: string,
): DealerDeliveryDto[] {
  const q = search.trim().toLowerCase();
  const left = uniqueReceiptRows(rows).filter((row) =>
    matchesDealerReceiptTile(row.customerStatus, tile),
  );
  const matched = q
    ? left.filter((row) => receiptSearchText(row).includes(q))
    : left;
  return matched.sort(sortReceipts);
}

function receiptSearchText(row: DealerDeliveryDto): string {
  const names = [
    row.salesOrderNumber,
    row.productName?.name,
    row.productName?.nameEn,
    row.productName?.nameAr,
    row.productName?.nameHe,
    row.deliveryAddress,
  ];
  return names.filter(Boolean).join(' ').toLowerCase();
}

function sortReceipts(a: DealerDeliveryDto, b: DealerDeliveryDto): number {
  const ak = receiptKindFromStatus(a.customerStatus) === 'awaiting' ? 0 : 1;
  const bk = receiptKindFromStatus(b.customerStatus) === 'awaiting' ? 0 : 1;
  if (ak !== bk) return ak - bk;
  const ad = receiptDay(a) ?? '';
  const bd = receiptDay(b) ?? '';
  return bd.localeCompare(ad);
}

export function receiptProductLabel(row: DealerDeliveryDto, locale: string): string {
  return localizedName(
    locale,
    row.productName,
    row.productName?.name || row.salesOrderNumber,
  );
}

export function receiptDay(row: DealerDeliveryDto): string | null {
  const kind = receiptKindFromStatus(row.customerStatus);
  const raw =
    kind === 'received'
      ? row.actualDeliveryDate ?? row.calendarDate
      : row.calendarDate ?? row.committedDeliveryDate ?? row.plannedDeliveryDate;
  return toReceiptYmd(raw);
}

export function promisedDay(row: DealerDeliveryDto): string | null {
  return toReceiptYmd(
    row.committedDeliveryDate ?? row.requestedDeliveryDate ?? row.calendarDate,
  );
}

export function selectReceiptStub(row: DealerDeliveryDto): {
  kind: DealerReceiptKind;
  ymd: string | null;
} {
  return {
    kind: receiptKindFromStatus(row.customerStatus) ?? 'awaiting',
    ymd: receiptDay(row),
  };
}

export const RECEIPT_STUB_CAPTION_KEY: Record<DealerReceiptKind, string> = {
  awaiting: 'mobile.dealerReceipts.stubAwaiting',
  received: 'mobile.dealerReceipts.stubReceived',
};

export function toReceiptYmd(value: string | null | undefined): string | null {
  if (!value) return null;
  const sliced = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(sliced) ? sliced : null;
}
