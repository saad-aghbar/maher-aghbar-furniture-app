/** Helpers for production assign windows — prefer short slots over full-day defaults. */

export const DEFAULT_ASSIGN_DURATION_MINUTES = 120;

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

/**
 * Default assign window: existing planned times, else order production start day,
 * else a short afternoon/morning slot from now.
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
  estHours: string;
  estMinutes: string;
} {
  const now = opts?.now ?? new Date();
  const fromStart = partsFromIso(opts?.plannedStart ?? null);
  const fromDue = partsFromIso(opts?.plannedCompletion ?? null);
  const duration = Math.max(
    30,
    Math.round(opts?.estimatedMinutes ?? DEFAULT_ASSIGN_DURATION_MINUTES),
  );
  const eh = Math.floor(duration / 60);
  const em = duration % 60;

  if (fromStart && fromDue) {
    return {
      start: fromStart,
      due: fromDue,
      estHours: String(eh || ''),
      estMinutes: em ? String(em).padStart(2, '0') : '',
    };
  }

  if (fromDue && !fromStart) {
    const dueDate = new Date(opts!.plannedCompletion!);
    const startDate = new Date(dueDate.getTime() - duration * 60_000);
    return {
      start: partsFromIso(startDate.toISOString())!,
      due: fromDue,
      estHours: String(eh || ''),
      estMinutes: em ? String(em).padStart(2, '0') : '',
    };
  }

  const orderYmd = (() => {
    const raw = opts?.orderPlannedStartDate?.trim();
    if (!raw) return null;
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
    if (m) return m[1]!;
    return partsFromIso(raw)?.ymd ?? null;
  })();
  if (orderYmd && !fromStart) {
    const start: LocalWallParts = {
      ymd: orderYmd,
      hour: '8',
      minute: '00',
    };
    const startDate = new Date(`${orderYmd}T08:00:00`);
    const end = new Date(startDate.getTime() + duration * 60_000);
    return {
      start,
      due: partsFromIso(end.toISOString())!,
      estHours: String(eh || ''),
      estMinutes: em ? String(em).padStart(2, '0') : '',
    };
  }

  // Next local work block: round up to next half hour, 2h (or estimate) long.
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
  const end = new Date(start.getTime() + duration * 60_000);
  return {
    start: partsFromIso(start.toISOString())!,
    due: partsFromIso(end.toISOString())!,
    estHours: String(eh || ''),
    estMinutes: em ? String(em).padStart(2, '0') : '',
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
