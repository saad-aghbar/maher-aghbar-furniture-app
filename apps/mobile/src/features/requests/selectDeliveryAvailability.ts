import type {
  AvailabilityResult,
  ScheduleEstimateConfidence,
} from '@/api/modules/scheduling';
import type { DayMeta } from '@/components/calendar';

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
};

const IDLE: DeliveryAvailabilityDisplay = {
  kind: 'idle',
  earliestDate: null,
  suggestedDate: null,
  alternativeDates: [],
  requestedDateFeasible: true,
  confidence: null,
  isPreliminary: false,
};

/** Normalize API/ISO timestamps to calendar `YYYY-MM-DD` for form fields + chip compare. */
export function toDeliveryYmd(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  return match?.[1] ?? null;
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

  if (result.estimateStatus === 'UNAVAILABLE') {
    return {
      ...IDLE,
      kind: 'unavailable',
      confidence: result.estimateConfidence,
    };
  }

  const alternativeDates = (result.alternativeDates ?? [])
    .map(toDeliveryYmd)
    .filter((d): d is string => Boolean(d))
    .slice(0, 3);
  const hasRequestedDate = Boolean(toDeliveryYmd(requestedDeliveryDate));
  const feasible = !hasRequestedDate || result.requestedDateFeasible;

  return {
    kind: feasible ? 'feasible' : 'infeasible',
    earliestDate: toDeliveryYmd(result.earliestAvailableDate),
    suggestedDate: toDeliveryYmd(result.suggestedDeliveryDate),
    alternativeDates,
    requestedDateFeasible: feasible,
    confidence: result.estimateConfidence,
    isPreliminary: result.estimateStatus === 'PRELIMINARY',
  };
}

/** Quick-pick chip dates for the delivery date field — earliest + alternatives, de-duplicated. */
export function selectQuickPickDates(display: DeliveryAvailabilityDisplay): string[] {
  const dates = [display.earliestDate, ...display.alternativeDates]
    .map(toDeliveryYmd)
    .filter((d): d is string => Boolean(d));
  return [...new Set(dates)].slice(0, 4);
}

/**
 * Build MonthCalendar dayMeta for a visible month from availability display.
 * Maps commercial availability onto the shared admin load palette:
 * closed → busy(too early) → light(earliest) → half(alternatives) → empty(later open).
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
  const available = new Set(selectQuickPickDates(display));
  const last = new Date(year, monthIndex + 1, 0).getDate();
  const meta: Record<string, DayMeta> = {};

  for (let d = 1; d <= last; d++) {
    const ymd = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dow = new Date(year, monthIndex, d).getDay(); // 0=Sun
    const isWorking = workingDays
      ? workingDays.has(ymd)
      : dow !== 5; // Friday closed by default (Sat works)

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
    if (available.has(ymd)) {
      meta[ymd] = { tone: 'half', disabled: false, density: 1 };
      continue;
    }
    // On/after earliest working day: selectable (dealer may request later)
    if (earliest && ymd >= earliest) {
      meta[ymd] = { tone: 'empty', disabled: false };
      continue;
    }
    meta[ymd] = { tone: 'busy', disabled: true };
  }
  return meta;
}

