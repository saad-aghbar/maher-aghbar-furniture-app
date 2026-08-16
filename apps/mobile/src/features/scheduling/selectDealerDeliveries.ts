import { localizedName } from '@maher/i18n';
import type { DealerDeliveryDto } from '@/api/modules/scheduling';
import type { DayMeta } from '@/components/calendar';

export type DealerDeliveryFilter = 'all' | 'upcoming' | 'attention' | 'delivered';
export type DealerDeliveryGroupKey = 'attention' | 'upcoming' | 'later' | 'delivered';
export type DealerSummaryTileKey = 'upcoming' | 'week' | 'awaiting' | 'delayed';
export type DealerDeliveryTone = 'brand' | 'warning' | 'info' | 'success' | 'muted';

export function filterFromSummaryKey(key: DealerSummaryTileKey): DealerDeliveryFilter {
  if (key === 'awaiting' || key === 'delayed') return 'attention';
  return 'upcoming';
}

export function deliveryCardTone(status: string | null | undefined): DealerDeliveryTone {
  switch (status) {
    case 'MAY_BE_DELAYED':
    case 'DELAYED':
      return 'warning';
    case 'READY_FOR_DELIVERY':
    case 'OUT_FOR_DELIVERY':
      return 'info';
    case 'DELIVERED':
      return 'success';
    case 'CANCELLED':
      return 'muted';
    default:
      return 'brand';
  }
}

export function toYmdSlice(value: string | null | undefined): string | null {
  if (!value) return null;
  const sliced = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(sliced) ? sliced : null;
}

export function addDaysYmd(ymd: string, days: number): string {
  const parts = ymd.split('-').map(Number);
  const year = parts[0] ?? 1970;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const dt = new Date(Date.UTC(year, month - 1, day));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function startOfWeekSunday(ymd: string): string {
  const parts = ymd.split('-').map(Number);
  const year = parts[0] ?? 1970;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const dt = new Date(Date.UTC(year, month - 1, day));
  dt.setUTCDate(dt.getUTCDate() - dt.getUTCDay());
  return dt.toISOString().slice(0, 10);
}

/** Same rules as API `summarizeDealerDeliveries` — one tile, those orders. */
export function filterBySummaryTile(
  rows: DealerDeliveryDto[],
  tile: DealerSummaryTileKey,
  todayYmd: string,
): DealerDeliveryDto[] {
  const weekStart = startOfWeekSunday(todayYmd);
  const weekEnd = addDaysYmd(weekStart, 6);
  return rows.filter((row) => {
    if (row.customerStatus === 'CANCELLED' || row.customerStatus === 'DELIVERED') return false;
    if (tile === 'upcoming') return Boolean(row.calendarDate && row.calendarDate >= todayYmd);
    if (tile === 'week') {
      return Boolean(
        row.calendarDate && row.calendarDate >= weekStart && row.calendarDate <= weekEnd,
      );
    }
    if (tile === 'awaiting') return row.customerStatus === 'AWAITING_CONFIRMATION';
    return row.customerStatus === 'MAY_BE_DELAYED' || row.customerStatus === 'DELAYED';
  });
}

export function productLabel(row: DealerDeliveryDto, locale: string): string {
  return localizedName(locale, row.productName, row.productName.name || row.salesOrderNumber);
}

export function filterDealerDeliveries(
  rows: DealerDeliveryDto[],
  filter: DealerDeliveryFilter,
  todayYmd: string,
): DealerDeliveryDto[] {
  return rows.filter((row) => {
    if (row.customerStatus === 'CANCELLED') return filter === 'all';
    if (filter === 'all') return true;
    if (filter === 'attention') return row.requiresDealerAttention;
    if (filter === 'delivered') return row.customerStatus === 'DELIVERED';
    if (filter === 'upcoming') {
      const date = row.calendarDate;
      return Boolean(date && date >= todayYmd && row.customerStatus !== 'DELIVERED');
    }
    return true;
  });
}

export function groupDealerDeliveries(
  rows: DealerDeliveryDto[],
  todayYmd: string,
  laterAfterDays = 14,
): Record<DealerDeliveryGroupKey, DealerDeliveryDto[]> {
  const laterCutoff = addDaysYmd(todayYmd, laterAfterDays);
  const groups: Record<DealerDeliveryGroupKey, DealerDeliveryDto[]> = {
    attention: [],
    upcoming: [],
    later: [],
    delivered: [],
  };
  for (const row of rows) {
    if (row.customerStatus === 'CANCELLED') continue;
    if (row.customerStatus === 'DELIVERED') {
      groups.delivered.push(row);
      continue;
    }
    if (row.requiresDealerAttention) {
      groups.attention.push(row);
      continue;
    }
    const date = row.calendarDate;
    if (date && date >= todayYmd && date <= laterCutoff) {
      groups.upcoming.push(row);
    } else {
      groups.later.push(row);
    }
  }
  return groups;
}

export function selectDealerCalendarDayMeta(
  rows: DealerDeliveryDto[],
): Record<string, DayMeta> {
  const byDay = new Map<string, DealerDeliveryDto[]>();
  for (const row of rows) {
    if (!row.calendarDate || row.customerStatus === 'CANCELLED') continue;
    const list = byDay.get(row.calendarDate) ?? [];
    list.push(row);
    byDay.set(row.calendarDate, list);
  }
  const meta: Record<string, DayMeta> = {};
  for (const [ymd, list] of byDay) {
    const markers: DayMeta['markers'] = [];
    const hasAttention = list.some(
      (r) =>
        r.requiresDealerAttention ||
        r.customerStatus === 'MAY_BE_DELAYED' ||
        r.customerStatus === 'DELAYED',
    );
    const hasProposed = list.some((r) => r.customerStatus === 'AWAITING_CONFIRMATION');
    const hasConfirmed = list.some(
      (r) =>
        r.customerStatus === 'CONFIRMED_ON_TRACK' ||
        r.customerStatus === 'IN_PRODUCTION' ||
        r.customerStatus === 'READY_FOR_DELIVERY' ||
        r.customerStatus === 'OUT_FOR_DELIVERY' ||
        r.customerStatus === 'DELIVERED',
    );
    if (hasConfirmed) markers.push('confirmed');
    if (hasProposed) markers.push('proposed');
    if (hasAttention) markers.push('attention');
    meta[ymd] = {
      tone: hasAttention ? 'busy' : hasProposed ? 'light' : 'available',
      markers,
      count: list.length,
      density: Math.min(list.length, 3),
    };
  }
  return meta;
}

export function ordersOnCalendarDay(
  rows: DealerDeliveryDto[],
  ymd: string,
): DealerDeliveryDto[] {
  return rows.filter((row) => row.calendarDate === ymd && row.customerStatus !== 'CANCELLED');
}

export function selectCompactCardLine(row: DealerDeliveryDto): {
  compact: boolean;
  dateYmd: string | null;
} {
  return {
    compact: Boolean(row.compactDates && row.calendarDate),
    dateYmd: row.calendarDate,
  };
}

export function matchDealerDeliverySearch(
  row: DealerDeliveryDto,
  query: string,
  locale: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    row.salesOrderNumber,
    row.productionOrderNumber,
    productLabel(row, locale),
    row.productName.nameEn,
    row.productName.nameAr,
    row.productName.nameHe,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

export function selectDeliveryTimeline(row: {
  customerStatus?: string | null;
  committedDeliveryDate?: string | null;
}): Array<{ key: string; done: boolean; current: boolean }> {
  const status = row.customerStatus ?? '';
  const confirmed = Boolean(row.committedDeliveryDate) ||
    ['CONFIRMED_ON_TRACK', 'IN_PRODUCTION', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'MAY_BE_DELAYED', 'DELAYED', 'DELIVERED'].includes(status);
  const inProd = ['IN_PRODUCTION', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'MAY_BE_DELAYED', 'DELAYED', 'DELIVERED'].includes(status);
  const ready = ['READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(status);
  const out = ['OUT_FOR_DELIVERY', 'DELIVERED'].includes(status);
  const delivered = status === 'DELIVERED';
  const currentKey = delivered
    ? 'delivered'
    : out
      ? 'out'
      : ready
        ? 'ready'
        : inProd
          ? 'production'
          : confirmed
            ? 'confirmed'
            : 'received';
  return [
    { key: 'received', done: true, current: currentKey === 'received' },
    { key: 'confirmed', done: confirmed, current: currentKey === 'confirmed' },
    { key: 'production', done: inProd, current: currentKey === 'production' },
    { key: 'ready', done: ready, current: currentKey === 'ready' },
    { key: 'out', done: out, current: currentKey === 'out' },
    { key: 'delivered', done: delivered, current: currentKey === 'delivered' },
  ];
}
