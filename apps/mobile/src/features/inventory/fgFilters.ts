import type { FinishedLot } from '@/api/modules/inventory';

export type FgFilter =
  | 'all'
  | 'waitingForTruck'
  | 'pickupPlanned'
  | 'leavingToday'
  | 'overdue';

export const FG_FILTERS: FgFilter[] = [
  'all',
  'waitingForTruck',
  'pickupPlanned',
  'leavingToday',
  'overdue',
];

/** Shipped / delivered lots must not appear as physically in Finished Goods. */
export function isFgLotPhysicallyPresent(
  lot: Pick<FinishedLot, 'deliveryStatus'>,
): boolean {
  const s = lot.deliveryStatus?.toUpperCase() ?? null;
  return s !== 'OUT_FOR_DELIVERY' && s !== 'DELIVERED';
}

export function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export function fgFilterLabel(filter: FgFilter, t: (key: string) => string): string {
  switch (filter) {
    case 'all':
      return t('lifecycle.tabs.all');
    case 'waitingForTruck':
      return t('lifecycle.waitingForTruck');
    case 'pickupPlanned':
      return t('lifecycle.pickupPlanned');
    case 'leavingToday':
      return t('lifecycle.leavingToday');
    case 'overdue':
      return t('lifecycle.overduePickup');
  }
}

export function matchesFgFilter(
  lot: Pick<FinishedLot, 'deliveryStatus' | 'deliveryDate'>,
  filter: FgFilter,
  today = todayYmd(),
): boolean {
  if (!isFgLotPhysicallyPresent(lot)) return false;

  switch (filter) {
    case 'all':
      return true;
    case 'waitingForTruck':
      return !lot.deliveryStatus;
    case 'pickupPlanned':
      return lot.deliveryStatus === 'PLANNED' || lot.deliveryStatus === 'READY';
    case 'leavingToday':
      return Boolean(lot.deliveryDate && lot.deliveryDate.slice(0, 10) === today);
    case 'overdue': {
      const planned = lot.deliveryDate?.slice(0, 10);
      if (!planned || planned >= today) return false;
      const s = lot.deliveryStatus?.toUpperCase();
      return !s || s === 'PLANNED' || s === 'READY';
    }
  }
}

export function matchesFgSearch(
  lot: FinishedLot,
  query: string,
  locale: string,
): boolean {
  if (!query.trim()) return true;
  const needle = query.trim().toLowerCase();
  const productName =
    locale === 'ar'
      ? lot.productNameAr ?? lot.productNameEn ?? lot.inventoryItem.nameAr
      : lot.productNameEn ?? lot.productNameAr ?? lot.inventoryItem.nameEn;
  const dealerName =
    locale === 'ar'
      ? lot.dealerNameAr ?? lot.dealerNameEn
      : lot.dealerNameEn ?? lot.dealerNameAr;
  const haystack = [
    lot.salesOrderNumber,
    lot.productionOrderNumber ?? lot.productionOrder?.number,
    productName,
    dealerName,
    lot.deliveryNumber,
    lot.projectName,
    lot.inventoryItem.sku,
    lot.inventoryItem.nameEn,
    lot.inventoryItem.nameAr,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export function fgDeliveryStatusLabel(
  lot: Pick<FinishedLot, 'deliveryStatus'>,
  t: (key: string) => string,
): string | null {
  if (!lot.deliveryStatus) return t('lifecycle.waitingForTruck');
  const s = lot.deliveryStatus.toUpperCase();
  if (s === 'PLANNED' || s === 'READY') return t('lifecycle.pickupPlanned');
  return lot.deliveryStatus;
}

export type FgLeaveUrgency =
  | 'overdue'
  | 'leavingToday'
  | 'pickupPlanned'
  | 'waitingForTruck';

/** Operational leave urgency for sort + card leave-by copy. */
export function fgLeaveUrgency(
  lot: Pick<FinishedLot, 'deliveryStatus' | 'deliveryDate'>,
  now = Date.now(),
): FgLeaveUrgency {
  const today = new Date(now).toISOString().slice(0, 10);
  const planned = lot.deliveryDate?.slice(0, 10);
  const s = lot.deliveryStatus?.toUpperCase() ?? null;

  if (planned && planned < today && (!s || s === 'PLANNED' || s === 'READY')) {
    return 'overdue';
  }
  if (planned && planned === today) return 'leavingToday';
  if (s === 'PLANNED' || s === 'READY' || planned) return 'pickupPlanned';
  return 'waitingForTruck';
}

export function fgLeaveByLabel(
  lot: Pick<FinishedLot, 'deliveryStatus' | 'deliveryDate'>,
  t: (key: string, values?: Record<string, string | number>) => string,
  now = Date.now(),
): string {
  const urgency = fgLeaveUrgency(lot, now);
  if (urgency === 'waitingForTruck') return t('lifecycle.waitingForTruck');
  if (urgency === 'leavingToday') return t('lifecycle.leavingToday');
  if (urgency === 'pickupPlanned') return t('lifecycle.pickupPlanned');
  const planned = lot.deliveryDate?.slice(0, 10);
  if (!planned) return t('lifecycle.overduePickup');
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const leave = new Date(`${planned}T00:00:00`);
  const days = Math.max(1, Math.round((today.getTime() - leave.getTime()) / 86_400_000));
  return t('lifecycle.overdueByDays', { days });
}
