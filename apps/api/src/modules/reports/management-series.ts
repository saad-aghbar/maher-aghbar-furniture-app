/**
 * Management summary — small time-series aggregates for the web desk.
 *
 * Pure bucketing helpers live here so they can be unit-tested without Prisma.
 * The service fetches minimal rows for a bounded window (7–30 days) and buckets
 * them by local calendar day. Keys are `YYYY-MM-DD` in server local time,
 * matching `startOfLocalDay` used across the summary.
 */

export type MgmtDayPoint = { date: string; count: number };
export type MgmtDayAmount = { date: string; amount: number };
export type MgmtDayQuality = { date: string; passed: number; failed: number };
export type MgmtStageDuration = {
  stageCode: string;
  stageName: string;
  avgMinutes: number;
  samples: number;
};

export type MgmtSeries = {
  /** Tasks completed per day, last 7 days ending today. */
  completedLast7: MgmtDayPoint[];
  /** Open production orders due per day, today through +6. */
  dueNext7: MgmtDayPoint[];
  /** Planned/ready deliveries per day, today through +6. */
  deliveriesNext7: MgmtDayPoint[];
  /** Inspections passed / failed per day, last 14 days ending today. */
  qualityLast14: MgmtDayQuality[];
  /** Customer payments per day, last 30 days ending today. Finance-gated. */
  paymentsLast30: MgmtDayAmount[] | null;
  /** Average actual minutes per stage over the last 30 days, slowest first. Task-read gated. */
  stageDurations: MgmtStageDuration[] | null;
};

export function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** `count` consecutive day keys starting at `start` (local midnight). */
export function dayKeys(start: Date, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    out.push(localDayKey(d));
  }
  return out;
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/** Count rows per local day over a fixed window; days with no rows are zero-filled. */
export function bucketCounts<T>(
  rows: T[],
  dateOf: (row: T) => Date | null | undefined,
  start: Date,
  days: number,
): MgmtDayPoint[] {
  const keys = dayKeys(start, days);
  const map = new Map<string, number>(keys.map((k) => [k, 0]));
  for (const row of rows) {
    const d = dateOf(row);
    if (!d) continue;
    const k = localDayKey(d);
    if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
  }
  return keys.map((date) => ({ date, count: map.get(date) ?? 0 }));
}

/** Sum a numeric field per local day over a fixed window. */
export function bucketAmounts<T>(
  rows: T[],
  dateOf: (row: T) => Date | null | undefined,
  amountOf: (row: T) => number,
  start: Date,
  days: number,
): MgmtDayAmount[] {
  const keys = dayKeys(start, days);
  const map = new Map<string, number>(keys.map((k) => [k, 0]));
  for (const row of rows) {
    const d = dateOf(row);
    if (!d) continue;
    const k = localDayKey(d);
    if (!map.has(k)) continue;
    const amt = Number(amountOf(row));
    map.set(k, (map.get(k) ?? 0) + (Number.isFinite(amt) ? amt : 0));
  }
  return keys.map((date) => ({
    date,
    amount: Math.round((map.get(date) ?? 0) * 1000) / 1000,
  }));
}

const PASS_RESULTS = new Set(['PASSED', 'PASSED_WITH_NOTES']);
const FAIL_RESULTS = new Set(['FAILED_REWORK_REQUIRED', 'BLOCKED']);

/** Split inspections into passed / failed per local day. Null results are ignored. */
export function bucketQuality<T>(
  rows: T[],
  dateOf: (row: T) => Date | null | undefined,
  resultOf: (row: T) => string | null | undefined,
  start: Date,
  days: number,
): MgmtDayQuality[] {
  const keys = dayKeys(start, days);
  const map = new Map<string, { passed: number; failed: number }>(
    keys.map((k) => [k, { passed: 0, failed: 0 }]),
  );
  for (const row of rows) {
    const d = dateOf(row);
    const r = resultOf(row);
    if (!d || !r) continue;
    const bucket = map.get(localDayKey(d));
    if (!bucket) continue;
    if (PASS_RESULTS.has(r)) bucket.passed += 1;
    else if (FAIL_RESULTS.has(r)) bucket.failed += 1;
  }
  return keys.map((date) => ({ date, ...(map.get(date) ?? { passed: 0, failed: 0 }) }));
}

/** Average minutes per stage, slowest first. Rows without a stage or minutes are skipped. */
export function averageStageDurations<T>(
  rows: T[],
  stageOf: (row: T) => { code: string; name: string } | null | undefined,
  minutesOf: (row: T) => number | null | undefined,
): MgmtStageDuration[] {
  const acc = new Map<string, { name: string; total: number; n: number }>();
  for (const row of rows) {
    const stage = stageOf(row);
    const minutes = minutesOf(row);
    if (!stage?.code || minutes == null || !Number.isFinite(minutes) || minutes <= 0) continue;
    const cur = acc.get(stage.code) ?? { name: stage.name, total: 0, n: 0 };
    cur.total += minutes;
    cur.n += 1;
    acc.set(stage.code, cur);
  }
  return [...acc.entries()]
    .map(([stageCode, v]) => ({
      stageCode,
      stageName: v.name,
      avgMinutes: Math.round(v.total / v.n),
      samples: v.n,
    }))
    .sort((a, b) => b.avgMinutes - a.avgMinutes);
}
