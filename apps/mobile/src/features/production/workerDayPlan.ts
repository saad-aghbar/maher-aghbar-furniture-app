/**
 * Time-based worker-day plan for assign UX.
 * Capacity is hours, not “one order per day”. Nothing moves automatically.
 */

export type WorkerDayBusyBlock = {
  startMs: number;
  endMs: number;
  label: string;
  salesOrderNumber?: string | null;
  stage?: string | null;
};

export type WorkerDayTimelineBlock =
  | {
      kind: 'busy';
      startMs: number;
      endMs: number;
      label: string;
      salesOrderNumber?: string | null;
      stage?: string | null;
      durationMinutes: number;
    }
  | {
      kind: 'available';
      startMs: number;
      endMs: number;
      durationMinutes: number;
    }
  | {
      kind: 'proposed';
      startMs: number;
      endMs: number;
      durationMinutes: number;
      conflicts: boolean;
    };

export type WorkerDayPlan = {
  capacityMinutes: number;
  plannedMinutes: number;
  availableMinutes: number;
  loadPercent: number;
  overCapacity: boolean;
  taskCount: number;
  blocks: WorkerDayTimelineBlock[];
  freeWindows: Array<{ startMs: number; endMs: number; durationMinutes: number }>;
};

export type BuildWorkerDayPlanInput = {
  dayStartMs: number;
  dayEndMs: number;
  busy: WorkerDayBusyBlock[];
  proposed?: { startMs: number; endMs: number } | null;
  capacityMinutes?: number;
};

function clip(
  start: number,
  end: number,
  lo: number,
  hi: number,
): { start: number; end: number } | null {
  const s = Math.max(start, lo);
  const e = Math.min(end, hi);
  if (e <= s) return null;
  return { start: s, end: e };
}

function minutesBetween(a: number, b: number): number {
  return Math.max(0, Math.round((b - a) / 60_000));
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Build a shift timeline: busy work, available gaps, optional proposed assignment.
 * Overtime is reported as loadPercent > 100 — never auto-reschedules.
 */
export function buildWorkerDayPlan(input: BuildWorkerDayPlanInput): WorkerDayPlan {
  const dayStart = input.dayStartMs;
  const dayEnd = input.dayEndMs;
  const capacityMinutes =
    input.capacityMinutes ?? minutesBetween(dayStart, dayEnd);

  const clipped = input.busy
    .map((b) => {
      const c = clip(b.startMs, b.endMs, dayStart, dayEnd);
      if (!c) return null;
      return { ...b, startMs: c.start, endMs: c.end };
    })
    .filter(Boolean) as WorkerDayBusyBlock[];

  clipped.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

  const plannedMinutes = clipped.reduce(
    (sum, b) => sum + minutesBetween(b.startMs, b.endMs),
    0,
  );
  const availableMinutes = Math.max(0, capacityMinutes - plannedMinutes);
  const loadPercent =
    capacityMinutes > 0
      ? Math.round((plannedMinutes / capacityMinutes) * 1000) / 10
      : 0;
  const overCapacity = plannedMinutes > capacityMinutes;

  const freeWindows: WorkerDayPlan['freeWindows'] = [];
  let cursor = dayStart;
  for (const b of clipped) {
    if (b.startMs > cursor) {
      freeWindows.push({
        startMs: cursor,
        endMs: b.startMs,
        durationMinutes: minutesBetween(cursor, b.startMs),
      });
    }
    cursor = Math.max(cursor, b.endMs);
  }
  if (cursor < dayEnd) {
    freeWindows.push({
      startMs: cursor,
      endMs: dayEnd,
      durationMinutes: minutesBetween(cursor, dayEnd),
    });
  }

  const proposedClip = input.proposed
    ? clip(input.proposed.startMs, input.proposed.endMs, dayStart, dayEnd)
    : null;
  const proposedConflicts =
    proposedClip != null &&
    clipped.some((b) =>
      overlaps(proposedClip.start, proposedClip.end, b.startMs, b.endMs),
    );

  // Timeline = free windows + busy, with proposed overlaid as its own block when set.
  const blocks: WorkerDayTimelineBlock[] = [];
  cursor = dayStart;
  for (const b of clipped) {
    if (b.startMs > cursor) {
      pushGapWithProposed(blocks, cursor, b.startMs, proposedClip, proposedConflicts);
    }
    blocks.push({
      kind: 'busy',
      startMs: b.startMs,
      endMs: b.endMs,
      label: b.label,
      salesOrderNumber: b.salesOrderNumber,
      stage: b.stage,
      durationMinutes: minutesBetween(b.startMs, b.endMs),
    });
    cursor = b.endMs;
  }
  if (cursor < dayEnd) {
    pushGapWithProposed(blocks, cursor, dayEnd, proposedClip, proposedConflicts);
  }

  // If proposed sits only on busy time, still surface it once after busy blocks.
  if (
    proposedClip &&
    !blocks.some((b) => b.kind === 'proposed') &&
    proposedClip.end > proposedClip.start
  ) {
    blocks.push({
      kind: 'proposed',
      startMs: proposedClip.start,
      endMs: proposedClip.end,
      durationMinutes: minutesBetween(proposedClip.start, proposedClip.end),
      conflicts: true,
    });
    blocks.sort((a, b) => a.startMs - b.startMs);
  }

  return {
    capacityMinutes,
    plannedMinutes,
    availableMinutes,
    loadPercent,
    overCapacity,
    taskCount: clipped.length,
    blocks: blocks.filter((b) => b.endMs > b.startMs),
    freeWindows: freeWindows.filter((w) => w.durationMinutes > 0),
  };
}

function pushGapWithProposed(
  blocks: WorkerDayTimelineBlock[],
  gapStart: number,
  gapEnd: number,
  proposed: { start: number; end: number } | null,
  conflicts: boolean,
): void {
  if (gapEnd <= gapStart) return;
  if (!proposed) {
    blocks.push({
      kind: 'available',
      startMs: gapStart,
      endMs: gapEnd,
      durationMinutes: minutesBetween(gapStart, gapEnd),
    });
    return;
  }
  const inside = clip(proposed.start, proposed.end, gapStart, gapEnd);
  if (!inside) {
    blocks.push({
      kind: 'available',
      startMs: gapStart,
      endMs: gapEnd,
      durationMinutes: minutesBetween(gapStart, gapEnd),
    });
    return;
  }
  if (inside.start > gapStart) {
    blocks.push({
      kind: 'available',
      startMs: gapStart,
      endMs: inside.start,
      durationMinutes: minutesBetween(gapStart, inside.start),
    });
  }
  blocks.push({
    kind: 'proposed',
    startMs: inside.start,
    endMs: inside.end,
    durationMinutes: minutesBetween(inside.start, inside.end),
    conflicts,
  });
  if (inside.end < gapEnd) {
    blocks.push({
      kind: 'available',
      startMs: inside.end,
      endMs: gapEnd,
      durationMinutes: minutesBetween(inside.end, gapEnd),
    });
  }
}

/** First free window that fits duration — suggestion only; never applied automatically. */
export function suggestWindowFromFree(
  freeWindows: WorkerDayPlan['freeWindows'],
  durationMinutes: number,
): { startMs: number; endMs: number } | null {
  const need = Math.max(1, durationMinutes) * 60_000;
  for (const w of freeWindows) {
    if (w.endMs - w.startMs >= need) {
      return { startMs: w.startMs, endMs: w.startMs + need };
    }
  }
  return null;
}

/**
 * Place an assignment at the start of a free block for `durationMinutes`,
 * capped to the block end (tiny slots use the full free range).
 */
export function windowFromFreeBlock(
  startMs: number,
  endMs: number,
  durationMinutes: number,
): { startMs: number; endMs: number } | null {
  if (!(endMs > startMs)) return null;
  const need = Math.max(1, Math.round(durationMinutes || 1)) * 60_000;
  const span = endMs - startMs;
  return {
    startMs,
    endMs: startMs + Math.min(need, span),
  };
}

/**
 * Split free windows into tap targets sized to `durationMinutes` so the full
 * day shows as discrete Available slots (not one giant free block).
 * Remainder shorter than duration is still shown as a last slot.
 */
export function pickSlotsFromFreeWindows(
  freeWindows: WorkerDayPlan['freeWindows'],
  durationMinutes: number,
): Array<{ startMs: number; endMs: number; durationMinutes: number }> {
  const step = Math.max(1, Math.round(durationMinutes || 1)) * 60_000;
  const slots: Array<{ startMs: number; endMs: number; durationMinutes: number }> =
    [];
  for (const w of freeWindows) {
    if (!(w.endMs > w.startMs)) continue;
    let cursor = w.startMs;
    while (cursor < w.endMs) {
      const end = Math.min(cursor + step, w.endMs);
      if (end <= cursor) break;
      slots.push({
        startMs: cursor,
        endMs: end,
        durationMinutes: minutesBetween(cursor, end),
      });
      cursor = end;
    }
  }
  return slots;
}

/** Busy work + duration-sized Available picks, ordered through the day. */
export function buildDayPickTimeline(
  plan: WorkerDayPlan,
  durationMinutes: number,
): WorkerDayTimelineBlock[] {
  const picks = pickSlotsFromFreeWindows(plan.freeWindows, durationMinutes);
  const busy = plan.blocks.filter(
    (b): b is Extract<WorkerDayTimelineBlock, { kind: 'busy' }> =>
      b.kind === 'busy',
  );
  const available: WorkerDayTimelineBlock[] = picks.map((p) => ({
    kind: 'available',
    startMs: p.startMs,
    endMs: p.endMs,
    durationMinutes: p.durationMinutes,
  }));
  return [...busy, ...available].sort(
    (a, b) => a.startMs - b.startMs || a.endMs - b.endMs,
  );
}

export function formatHm(ms: number, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      ...(timeZone ? { timeZone } : {}),
    }).format(new Date(ms));
  } catch {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}

/** Local day bounds for a YMD + shift hours (factory desk default 08:00–16:00). */
export function localDayBounds(
  ymd: string,
  startHour = 8,
  endHour = 16,
): { dayStartMs: number; dayEndMs: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dayStartMs = new Date(y, mo, d, startHour, 0, 0, 0).getTime();
  const dayEndMs = new Date(y, mo, d, endHour, 0, 0, 0).getTime();
  if (!Number.isFinite(dayStartMs) || !Number.isFinite(dayEndMs)) return null;
  return { dayStartMs, dayEndMs };
}
