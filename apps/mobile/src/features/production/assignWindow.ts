/** Helpers for production assign windows — duration comes from the stage time. */

export type LocalWallParts = {
  ymd: string;
  hour: string;
  minute: string;
};

export function todayYmd(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function partsFromIso(iso: string | null | undefined): LocalWallParts | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    ymd: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    hour: String(d.getHours()),
    minute: String(d.getMinutes()).padStart(2, '0'),
  };
}

function nextWorkStart(now: Date): Date {
  const start = new Date(now);
  start.setSeconds(0, 0);
  const mins = start.getMinutes();
  const bump = mins === 0 ? 0 : mins <= 30 ? 30 - mins : 60 - mins;
  start.setMinutes(start.getMinutes() + bump);
  if (start.getHours() >= 17) {
    start.setDate(start.getDate() + 1);
    start.setHours(8, 0, 0, 0);
  } else if (start.getHours() < 8) {
    start.setHours(8, 0, 0, 0);
  }
  return start;
}

/**
 * Default assign window: existing planned times, else order production start day,
 * else the next work slot. End is derived from the stage estimate — never a
 * silent 2-hour default.
 */
export function defaultAssignWindowParts(opts?: {
  plannedStart?: string | null;
  plannedCompletion?: string | null;
  estimatedMinutes?: number | null;
  /** Order-level production start (admin-chosen on the plan). */
  orderPlannedStartDate?: string | null;
  now?: Date;
}): {
  start: LocalWallParts;
  due: LocalWallParts;
  hasStageTime: boolean;
} {
  const now = opts?.now ?? new Date();
  const fromStart = partsFromIso(opts?.plannedStart ?? null);
  const fromDue = partsFromIso(opts?.plannedCompletion ?? null);
  const raw = opts?.estimatedMinutes;
  const hasStageTime = raw != null && Number.isFinite(raw) && raw > 0;
  const duration = hasStageTime ? Math.max(1, Math.round(raw)) : null;

  if (fromStart && fromDue) {
    return { start: fromStart, due: fromDue, hasStageTime };
  }

  if (fromDue && !fromStart) {
    const dueDate = new Date(opts!.plannedCompletion!);
    const startDate =
      duration != null
        ? new Date(dueDate.getTime() - duration * 60_000)
        : dueDate;
    return {
      start: partsFromIso(startDate.toISOString())!,
      due: fromDue,
      hasStageTime,
    };
  }

  const orderYmd = (() => {
    const rawDate = opts?.orderPlannedStartDate?.trim();
    if (!rawDate) return null;
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(rawDate);
    if (m) return m[1]!;
    return partsFromIso(rawDate)?.ymd ?? null;
  })();
  if (orderYmd && !fromStart) {
    const start: LocalWallParts = {
      ymd: orderYmd,
      hour: '8',
      minute: '00',
    };
    const startDate = new Date(`${orderYmd}T08:00:00`);
    const end =
      duration != null
        ? new Date(startDate.getTime() + duration * 60_000)
        : startDate;
    return {
      start,
      due: partsFromIso(end.toISOString())!,
      hasStageTime,
    };
  }

  const start = nextWorkStart(now);
  const end =
    duration != null ? new Date(start.getTime() + duration * 60_000) : start;
  return {
    start: partsFromIso(start.toISOString())!,
    due: partsFromIso(end.toISOString())!,
    hasStageTime,
  };
}

export type ScheduleConflictItem = {
  kind?: string;
  id?: string;
  label?: string;
  start?: string;
  end?: string;
};

export function parseScheduleConflicts(raw: unknown): ScheduleConflictItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Record<string, unknown> => Boolean(c) && typeof c === 'object')
    .map((c) => ({
      kind: typeof c.kind === 'string' ? c.kind : undefined,
      id: typeof c.id === 'string' ? c.id : undefined,
      label: typeof c.label === 'string' ? c.label : undefined,
      start: typeof c.start === 'string' ? c.start : undefined,
      end: typeof c.end === 'string' ? c.end : undefined,
    }));
}

export function parseSuggestedWindow(
  raw: unknown,
): { plannedStart: string; plannedCompletion: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.plannedStart !== 'string' || typeof o.plannedCompletion !== 'string') {
    return null;
  }
  return { plannedStart: o.plannedStart, plannedCompletion: o.plannedCompletion };
}
