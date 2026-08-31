import type {
  AvailabilityResult,
  ScheduleEstimateConfidence,
} from '@/api/modules/scheduling';
import { todayYmd, type DayMeta } from '@/components/calendar';

export const DEALER_REQUEST_LEAD_CALENDAR_DAYS = 4;

export type DeliveryAvailabilityKind =
  | 'idle'
  | 'loading'
  | 'error'
  | 'unavailable'
  | 'feasible'
  | 'infeasible';

export type DeliveryAvailabilityDisplay = {
  kind: DeliveryAvailabilityKind;
  earliestDate: string | null;
  suggestedDate: string | null;
  /** Up to 3 candidate dates beyond the earliest date, for quick-pick chips. */
  alternativeDates: string[];
  requestedDateFeasible: boolean;
  confidence: ScheduleEstimateConfidence | null;
  /** Preliminary estimate — flag so UI can add a soft disclaimer. */
  isPreliminary: boolean;
  /** Factory-local earliest day a dealer may request (today + 4). */
  minimumRequestDate: string | null;
  days: Array<{
    date: string;
    status: 'available' | 'unavailable';
    selectable: boolean;
    reason: string | null;
  }>;
};

const IDLE: DeliveryAvailabilityDisplay = {
  kind: 'idle',
  earliestDate: null,
  suggestedDate: null,
  alternativeDates: [],
  requestedDateFeasible: true,
  confidence: null,
  isPreliminary: false,
  minimumRequestDate: null,
  days: [],
};

/** Local calendar add — not UTC midnight. */
export function addCalendarDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y ?? 0, (m ?? 1) - 1, (d ?? 1) + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function localDealerMinimumRequestYmd(now: Date = new Date()): string {
  return addCalendarDaysYmd(todayYmd(now), DEALER_REQUEST_LEAD_CALENDAR_DAYS);
}

/** Normalize API/ISO timestamps to calendar `YYYY-MM-DD` for form fields + chip compare. */
export function toDeliveryYmd(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  return match?.[1] ?? null;
}

export function laterDeliveryYmd(
  a: string | null | undefined,
  b: string | null | undefined,
): string | null {
  const left = toDeliveryYmd(a);
  const right = toDeliveryYmd(b);
  if (!left) return right;
  if (!right) return left;
  return left >= right ? left : right;
}

function atOrAfterMinimum(ymd: string | null, minRequest: string | null): boolean {
  if (!ymd) return false;
  if (!minRequest) return true;
  return ymd >= minRequest;
}

/**
 * Pure selector — maps a raw availability API result (+ query state) into a
 * dealer-safe display model. Never exposes factory internals (stage names,
 * worker load, etc.) — only commercial-facing dates and a feasibility flag.
 */
export function selectDeliveryAvailability(params: {
  hasItems: boolean;
  isLoading: boolean;
  isError: boolean;
  result: AvailabilityResult | null | undefined;
  requestedDeliveryDate?: string;
}): DeliveryAvailabilityDisplay {
  const { hasItems, isLoading, isError, result, requestedDeliveryDate } = params;

  if (!hasItems) return IDLE;
  if (isError) return { ...IDLE, kind: 'error' };
  if (isLoading && !result) return { ...IDLE, kind: 'loading' };
  if (!result) return IDLE;

  const minimumRequestDate = toDeliveryYmd(result.minimumRequestDate);

  if (result.estimateStatus === 'UNAVAILABLE') {
    return {
      ...IDLE,
      kind: 'unavailable',
      confidence: result.estimateConfidence,
      minimumRequestDate,
    };
  }

  const alternativeDates = (result.alternativeDates ?? [])
    .map(toDeliveryYmd)
    .filter((d): d is string => Boolean(d) && atOrAfterMinimum(d, minimumRequestDate))
    .slice(0, 3);
  const hasRequestedDate = Boolean(toDeliveryYmd(requestedDeliveryDate));
  const requestedYmd = toDeliveryYmd(requestedDeliveryDate);
  const tooSoon = Boolean(requestedYmd && minimumRequestDate && requestedYmd < minimumRequestDate);
  const feasible = !hasRequestedDate || (result.requestedDateFeasible && !tooSoon);
  const factoryEarliest = toDeliveryYmd(result.earliestAvailableDate);
  const earliestDate = laterDeliveryYmd(factoryEarliest, minimumRequestDate);

  return {
    kind: feasible ? 'feasible' : 'infeasible',
    earliestDate,
    suggestedDate: laterDeliveryYmd(toDeliveryYmd(result.suggestedDeliveryDate), minimumRequestDate),
    alternativeDates,
    requestedDateFeasible: feasible,
    confidence: result.estimateConfidence,
    isPreliminary: result.estimateStatus === 'PRELIMINARY',
    minimumRequestDate,
    days: (result.days ?? []).map((d) => {
      const blocked = Boolean(minimumRequestDate && d.date < minimumRequestDate);
      return {
        date: d.date,
        status: blocked ? 'unavailable' : d.status,
        selectable: !blocked && Boolean(d.selectable) && d.status === 'available',
        reason: blocked ? 'DEALER_LEAD_TIME' : d.reason ?? null,
      };
    }),
  };
}

/** Quick-pick chip dates for the delivery date field — earliest + alternatives, de-duplicated. */
export function selectQuickPickDates(display: DeliveryAvailabilityDisplay): string[] {
  const min = display.minimumRequestDate;
  const dates = [display.earliestDate, ...display.alternativeDates]
    .map(toDeliveryYmd)
    .filter((d): d is string => Boolean(d) && atOrAfterMinimum(d, min));
  return [...new Set(dates)].slice(0, 4);
}

/**
 * Build MonthCalendar dayMeta for a visible month from availability display.
 * Dealer may select only Available-to-request days. HIGH_LOAD / closed / too-early
 * / 4-day lead-time buffer are never selectable.
 */
export function selectAvailabilityDayMeta(params: {
  display: DeliveryAvailabilityDisplay;
  year: number;
  monthIndex: number;
  /** Optional working YMD set from factory calendar; when omitted use Sun–Thu. */
  workingDays?: Set<string> | null;
}): Record<string, DayMeta> {
  const { display, year, monthIndex, workingDays } = params;
  const earliest = display.earliestDate;
  const minRequest = display.minimumRequestDate;
  const availableChips = new Set(selectQuickPickDates(display));
  const byDate = new Map(display.days.map((d) => [d.date, d]));
  const last = new Date(year, monthIndex + 1, 0).getDate();
  const meta: Record<string, DayMeta> = {};

  for (let d = 1; d <= last; d++) {
    const ymd = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dow = new Date(year, monthIndex, d).getDay();
    const isWorking = workingDays
      ? workingDays.has(ymd)
      : dow !== 5;

    if (minRequest && ymd < minRequest) {
      meta[ymd] = { tone: 'busy', disabled: true };
      continue;
    }

    const apiDay = byDate.get(ymd);

    if (apiDay) {
      const selectable = apiDay.selectable && apiDay.status === 'available';
      meta[ymd] = {
        tone: selectable ? (ymd === earliest ? 'light' : availableChips.has(ymd) ? 'half' : 'empty') : apiDay.reason === 'CLOSED_DAY' ? 'closed' : 'busy',
        disabled: !selectable,
        isEarliest: Boolean(earliest && ymd === earliest),
        density: selectable ? 1 : 0,
      };
      continue;
    }

    if (!isWorking) {
      meta[ymd] = { tone: 'closed', disabled: true };
      continue;
    }
    if (earliest && ymd < earliest) {
      meta[ymd] = { tone: 'busy', disabled: true };
      continue;
    }
    if (earliest && ymd === earliest) {
      meta[ymd] = { tone: 'light', isEarliest: true, disabled: false, density: 1 };
      continue;
    }
    if (availableChips.has(ymd)) {
      meta[ymd] = { tone: 'half', disabled: false, density: 1 };
      continue;
    }
    meta[ymd] = { tone: 'busy', disabled: true };
  }
  return meta;
}

/** Month window sent with availability so `days[]` covers the calendar the dealer is looking at. */
export function availabilityMonthWindow(anchorYmd?: string | null): { from: string; to: string } {
  const ymd = toDeliveryYmd(anchorYmd) ?? todayYmd();
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(5, 7));
  const from = `${y}-${String(m).padStart(2, '0')}-01`;
  const last = new Date(y, m, 0).getDate();
  return { from, to: `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}` };
}
