import { localizedName } from '@maher/i18n';
import type { Locale } from '@maher/types';
import type { CapacityByDay, CapacityResponse, CapacityRow, CapacityWorkerRow } from '@/api/modules/scheduling';
import { addDaysToYmd, weekRangeFromYmd } from './selectAdminScheduling';

export type CapacityViewMode = 'day' | 'week';

export type CapacityState =
  | 'available'
  | 'moderate'
  | 'nearCapacity'
  | 'full'
  | 'unavailable'
  | 'noEligibleWorkers'
  | 'closed';

export type CapacityWorkerView = {
  employeeId: string;
  name: string;
  eligible: boolean;
  availableMinutes: number;
  allocatedMinutes: number;
  remainingMinutes: number;
  allocatedHours: string;
  availableHours: string;
  remainingHours: string;
  full: boolean;
};

export type FactoryCapacityCardModel = {
  stageDefinitionId: string;
  code: string;
  name: string;
  eligibleWorkerCount: number;
  availableMinutes: number;
  allocatedMinutes: number;
  remainingMinutes: number;
  utilizationPercent: number;
  remainingHours: string;
  allocatedHours: string;
  availableHours: string;
  state: CapacityState;
  workers: CapacityWorkerView[];
  ineligibleWorkers: CapacityWorkerView[];
  unassignedAllocatedMinutes: number;
  unassignedHours: string;
};

export type WeekCapacityCell = {
  date: string;
  weekdayKey: 'su' | 'mo' | 'tu' | 'we' | 'th' | 'fr' | 'sa';
  isWorking: boolean;
  percent: number | null;
  state: CapacityState;
};

/** Presentation only — minutes come from the backend. Never multiply workers × shift here. */
export function minutesToHoursLabel(minutes: number): string {
  const hours = minutes / 60;
  if (!Number.isFinite(hours)) return '0';
  const rounded = Math.round(hours * 10) / 10;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded);
}

export function selectCapacityQueryParams(
  mode: CapacityViewMode,
  anchorYmd: string,
): { from: string; to: string; granularity?: 'day'; includeWorkers?: boolean } {
  if (mode === 'day') {
    return { from: anchorYmd, to: anchorYmd, granularity: 'day', includeWorkers: true };
  }
  const week = weekRangeFromYmd(anchorYmd);
  return { from: week.from, to: week.to, granularity: 'day' };
}

export function shiftCapacityAnchor(
  mode: CapacityViewMode,
  anchorYmd: string,
  delta: number,
): string {
  return addDaysToYmd(anchorYmd, mode === 'week' ? delta * 7 : delta);
}

export function selectCapacityState(input: {
  isWorking: boolean;
  eligibleWorkerCount: number;
  availableMinutes: number;
  remainingMinutes: number;
  allocatedMinutes: number;
}): CapacityState {
  if (!input.isWorking) return 'closed';
  if (input.eligibleWorkerCount === 0) return 'noEligibleWorkers';
  if (input.remainingMinutes <= 0 && input.availableMinutes > 0) return 'full';
  if (input.availableMinutes <= 0) return 'unavailable';
  const pct = input.allocatedMinutes / input.availableMinutes;
  if (pct >= 0.85) return 'nearCapacity';
  if (pct >= 0.5) return 'moderate';
  return 'available';
}

function asLocale(locale: string): Locale {
  return locale === 'ar' || locale === 'he' || locale === 'en' ? locale : 'en';
}

/** Keep short acronyms like CNC as stored on the stage code, not title-cased "Cnc". */
export function displayStageName(name: string, code: string): string {
  const compactName = name.replace(/[\s_-]/g, '').toLowerCase();
  const compactCode = code.replace(/[\s_-]/g, '').toLowerCase();
  if (compactName === compactCode && /^[A-Z0-9]+$/.test(code) && code.length <= 4) {
    return code;
  }
  return name;
}

function workerName(row: CapacityWorkerRow): string {
  return `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim() || row.employeeId;
}

/** Pass through API eligibility. Never recompute skill on device. */
function toWorkerView(row: CapacityWorkerRow, fallbackEligible: boolean): CapacityWorkerView {
  const eligible = row.eligible ?? fallbackEligible;
  return {
    employeeId: row.employeeId,
    name: workerName(row),
    eligible,
    availableMinutes: row.availableMinutes,
    allocatedMinutes: row.allocatedMinutes,
    remainingMinutes: row.remainingMinutes,
    allocatedHours: minutesToHoursLabel(row.allocatedMinutes),
    availableHours: minutesToHoursLabel(row.availableMinutes),
    remainingHours: minutesToHoursLabel(row.remainingMinutes),
    full: eligible && row.remainingMinutes <= 0 && row.availableMinutes > 0,
  };
}

function allocatedOf(row: CapacityRow): number {
  return row.allocatedMinutes ?? row.bookedMinutes;
}

function availableOf(row: CapacityRow): number {
  return row.availableMinutes ?? row.capacityMinutes;
}

function remainingOf(row: CapacityRow): number {
  if (row.remainingMinutes != null) return row.remainingMinutes;
  return Math.max(0, availableOf(row) - allocatedOf(row));
}

export function selectFactoryCapacityCards(
  rows: CapacityRow[] | undefined,
  locale: string,
  isWorking: boolean,
): FactoryCapacityCardModel[] {
  if (!rows?.length) return [];
  return rows.map((row) => {
    const availableMinutes = availableOf(row);
    const allocatedMinutes = allocatedOf(row);
    const remainingMinutes = remainingOf(row);
    const state = selectCapacityState({
      isWorking,
      eligibleWorkerCount: row.eligibleWorkerCount,
      availableMinutes,
      remainingMinutes,
      allocatedMinutes,
    });
    const utilizationPercent =
      !isWorking || availableMinutes <= 0 || state === 'noEligibleWorkers'
        ? 0
        : Math.min(100, Math.round((allocatedMinutes / availableMinutes) * 100));
    return {
      stageDefinitionId: row.stageDefinitionId ?? row.departmentId,
      code: row.code,
      name: displayStageName(
        localizedName(
          asLocale(locale),
          { nameEn: row.nameEn, nameAr: row.nameAr, nameHe: row.nameHe },
          row.code,
        ),
        row.code,
      ),
      eligibleWorkerCount: row.eligibleWorkerCount,
      availableMinutes,
      allocatedMinutes,
      remainingMinutes,
      utilizationPercent,
      remainingHours: minutesToHoursLabel(remainingMinutes),
      allocatedHours: minutesToHoursLabel(allocatedMinutes),
      availableHours: minutesToHoursLabel(availableMinutes),
      state,
      workers: (row.workers ?? []).map((worker) => toWorkerView(worker, true)),
      ineligibleWorkers: (row.ineligibleWorkers ?? []).map((worker) => toWorkerView(worker, false)),
      unassignedAllocatedMinutes: row.unassignedAllocatedMinutes ?? 0,
      unassignedHours: minutesToHoursLabel(row.unassignedAllocatedMinutes ?? 0),
    };
  });
}

const WEEKDAY_KEYS = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'] as const;

function weekdayKeyFromYmd(ymd: string): (typeof WEEKDAY_KEYS)[number] {
  const [ys, ms, ds] = ymd.split('-').map(Number);
  const dt = new Date(ys!, (ms ?? 1) - 1, ds ?? 1);
  return WEEKDAY_KEYS[dt.getDay()] ?? 'su';
}

export function selectWeekCapacityCells(
  byDay: CapacityByDay[] | undefined,
  stageDefinitionId: string,
): WeekCapacityCell[] {
  if (!byDay?.length) return [];
  return byDay.map((day) => {
    const row = day.data.find(
      (item) => (item.stageDefinitionId ?? item.departmentId) === stageDefinitionId,
    );
    const availableMinutes = row ? availableOf(row) : 0;
    const allocatedMinutes = row ? allocatedOf(row) : 0;
    const remainingMinutes = row ? remainingOf(row) : 0;
    const eligible = row?.eligibleWorkerCount ?? 0;
    const state = selectCapacityState({
      isWorking: day.isWorking,
      eligibleWorkerCount: eligible,
      availableMinutes,
      remainingMinutes,
      allocatedMinutes,
    });
    const percent =
      !day.isWorking || availableMinutes <= 0 || state === 'noEligibleWorkers'
        ? null
        : Math.min(100, Math.round((allocatedMinutes / availableMinutes) * 100));
    return {
      date: day.date,
      weekdayKey: weekdayKeyFromYmd(day.date),
      isWorking: day.isWorking,
      percent,
      state,
    };
  });
}

/** Per-day factory load % from GET /scheduling/capacity?granularity=day. */
export function selectFactoryLoadByDay(
  response: CapacityResponse | undefined,
  locale = 'en',
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  if (!response?.byDay?.length) return out;
  for (const day of response.byDay) {
    const cards = selectFactoryCapacityCards(day.data, locale, day.isWorking);
    out[day.date] = selectFactoryLoadPercent(cards, day.isWorking);
  }
  return out;
}

export function selectFactoryLoadPercent(
  cards: FactoryCapacityCardModel[],
  isWorking: boolean,
): number | null {
  if (!isWorking) return null;
  const usable = cards.filter(
    (card) => card.state !== 'noEligibleWorkers' && card.availableMinutes > 0,
  );
  if (!usable.length) return 0;
  const allocated = usable.reduce((sum, card) => sum + card.allocatedMinutes, 0);
  const available = usable.reduce((sum, card) => sum + card.availableMinutes, 0);
  if (available <= 0) return 0;
  return Math.min(100, Math.round((allocated / available) * 100));
}

export function selectCapacityIsWorking(response: CapacityResponse | undefined, ymd: string): boolean {
  const day = response?.days?.find((d) => d.date === ymd) ?? response?.byDay?.find((d) => d.date === ymd);
  if (day) return day.isWorking;
  return true;
}

export function selectCapacityRowsForDay(
  response: CapacityResponse | undefined,
  ymd: string,
): CapacityRow[] {
  const day = response?.byDay?.find((d) => d.date === ymd);
  if (day) return day.data;
  return response?.data ?? [];
}

export function capacityStateLabelKey(state: CapacityState): string {
  if (state === 'noEligibleWorkers') return 'mobile.adminScheduling.capacity.state.schedulingBlocked';
  return `mobile.adminScheduling.capacity.state.${state}`;
}

export function capacityA11yKey(state: CapacityState): string {
  if (state === 'noEligibleWorkers') return 'mobile.adminScheduling.capacity.a11yBlocked';
  if (state === 'full') return 'mobile.adminScheduling.capacity.a11yFull';
  if (state === 'closed') return 'mobile.adminScheduling.capacity.a11yClosed';
  return 'mobile.adminScheduling.capacity.a11yCard';
}

const ATTENTION_RANK: Record<CapacityState, number> = {
  noEligibleWorkers: 0,
  unavailable: 1,
  full: 2,
  nearCapacity: 3,
  moderate: 4,
  available: 5,
  closed: 6,
};

const ATTENTION_STATES = new Set<CapacityState>([
  'noEligibleWorkers',
  'unavailable',
  'full',
  'nearCapacity',
]);

/** Display-only: Blocked → Full → Near → Moderate → Available. API order stays on the card. */
export function sortCapacityCardsForDisplay(
  cards: FactoryCapacityCardModel[],
): FactoryCapacityCardModel[] {
  return [...cards].sort((a, b) => {
    const rank = ATTENTION_RANK[a.state] - ATTENTION_RANK[b.state];
    if (rank !== 0) return rank;
    return a.name.localeCompare(b.name);
  });
}

/** Every blocked / full / near-capacity stage, worst first. No display cap. */
export function selectBottleneckStages(
  cards: FactoryCapacityCardModel[],
): FactoryCapacityCardModel[] {
  return sortCapacityCardsForDisplay(cards).filter((card) => ATTENTION_STATES.has(card.state));
}

export function selectAttentionCapacityCards(
  cards: FactoryCapacityCardModel[],
): FactoryCapacityCardModel[] {
  return sortCapacityCardsForDisplay(cards).filter((card) => ATTENTION_STATES.has(card.state));
}

export function weekdayKeyFromSelectedYmd(
  ymd: string,
): 'su' | 'mo' | 'tu' | 'we' | 'th' | 'fr' | 'sa' {
  return weekdayKeyFromYmd(ymd);
}
