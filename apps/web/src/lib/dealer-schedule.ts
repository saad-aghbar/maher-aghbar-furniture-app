export type DealerDeliveryDto = {
  id?: string;
  salesOrderId: string;
  salesOrderNumber: string;
  productionOrderId: string | null;
  productName?: {
    name?: string;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
  };
  imageUrl?: string | null;
  quantity?: number | null;
  requestedDeliveryDate: string | null;
  suggestedDeliveryDate: string | null;
  committedDeliveryDate: string | null;
  projectedDeliveryDate: string | null;
  plannedDeliveryDate?: string | null;
  actualDeliveryDate: string | null;
  calendarDate: string | null;
  customerStatus: string;
  requiresDealerAttention: boolean;
  actionRequired?: { code: string; labelKey: string } | null;
  customerSafeReason: string | null;
  compactDates: boolean;
  delayDays: number | null;
  scheduleUpdating?: boolean;
};

export type OwnDeliveriesResponse = {
  summary: {
    upcoming: number;
    thisWeek: number;
    awaitingConfirmation: number;
    mayBeDelayed: number;
  };
  data: DealerDeliveryDto[];
  todayYmd?: string;
};

export type CalendarCursor = { y: number; m: number };
export type UpcomingGroupKey = 'today' | 'thisWeek' | 'later';
export type DayMarker = 'confirmed' | 'proposed' | 'attention';
export type DayMeta = { markers: DayMarker[]; count: number };

export function toYmd(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function todayYmd(now = new Date()): string {
  return toYmd(now.getFullYear(), now.getMonth(), now.getDate());
}

export function toYmdSlice(value: string | null | undefined): string | null {
  if (!value) return null;
  const sliced = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(sliced) ? sliced : null;
}

export function addDaysYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function startOfWeekSunday(ymd: string): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  dt.setUTCDate(dt.getUTCDate() - dt.getUTCDay());
  return dt.toISOString().slice(0, 10);
}

export function monthRangeYmd(cursor: CalendarCursor): { from: string; to: string } {
  const from = toYmd(cursor.y, cursor.m, 1);
  const last = new Date(cursor.y, cursor.m + 1, 0).getDate();
  return { from, to: toYmd(cursor.y, cursor.m, last) };
}

export function shiftMonth(cursor: CalendarCursor, delta: number): CalendarCursor {
  const next = new Date(cursor.y, cursor.m + delta, 1);
  return { y: next.getFullYear(), m: next.getMonth() };
}

export function buildMonthCells(year: number, monthIndex: number): Array<number | null> {
  const first = new Date(year, monthIndex, 1);
  const startPad = (first.getDay() + 6) % 7;
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function ordersOnCalendarDay(rows: DealerDeliveryDto[], ymd: string): DealerDeliveryDto[] {
  return rows.filter((row) => row.calendarDate === ymd && row.customerStatus !== 'CANCELLED');
}

export function groupUpcomingByCalendarDate(
  rows: DealerDeliveryDto[],
  today: string,
): Record<UpcomingGroupKey, DealerDeliveryDto[]> {
  const weekEnd = addDaysYmd(startOfWeekSunday(today), 6);
  const groups: Record<UpcomingGroupKey, DealerDeliveryDto[]> = {
    today: [],
    thisWeek: [],
    later: [],
  };
  for (const row of rows) {
    if (row.customerStatus === 'CANCELLED' || row.customerStatus === 'DELIVERED') continue;
    const date = row.calendarDate;
    if (!date) continue;
    if (date <= today) groups.today.push(row);
    else if (date <= weekEnd) groups.thisWeek.push(row);
    else groups.later.push(row);
  }
  return groups;
}

export function selectDealerCalendarDayMeta(rows: DealerDeliveryDto[]): Record<string, DayMeta> {
  const byDay = new Map<string, DealerDeliveryDto[]>();
  for (const row of rows) {
    if (!row.calendarDate || row.customerStatus === 'CANCELLED') continue;
    const list = byDay.get(row.calendarDate) ?? [];
    list.push(row);
    byDay.set(row.calendarDate, list);
  }
  const meta: Record<string, DayMeta> = {};
  for (const [ymd, list] of byDay) {
    const markers: DayMarker[] = [];
    const hasAttention = list.some(
      (r) => r.customerStatus === 'MAY_BE_DELAYED' || r.customerStatus === 'DELAYED',
    );
    const hasProposed = list.some((r) => r.customerStatus === 'AWAITING_CONFIRMATION');
    const hasConfirmed = list.some((r) =>
      [
        'CONFIRMED_ON_TRACK',
        'IN_PRODUCTION',
        'READY_FOR_DELIVERY',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
      ].includes(r.customerStatus),
    );
    if (hasConfirmed) markers.push('confirmed');
    if (hasProposed) markers.push('proposed');
    if (hasAttention) markers.push('attention');
    meta[ymd] = { markers, count: list.length };
  }
  return meta;
}

export function formatPortalDate(locale: string, ymd: string): string {
  const sliced = toYmdSlice(ymd);
  if (!sliced) return ymd;
  const [year, month, day] = sliced.split('-').map(Number);
  const tag = locale === 'ar' ? 'ar' : locale === 'he' ? 'he' : 'en-GB';
  return new Intl.DateTimeFormat(tag, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1));
}
