import {
  buildDayPickTimeline,
  buildWorkerDayPlan,
  formatHm,
  localDayBounds,
  pickSlotsFromFreeWindows,
  suggestWindowFromFree,
  windowFromFreeBlock,
} from '../workerDayPlan';
import {
  FIXTURE_WORKER_120_PCT_DAY,
  FIXTURE_WORKER_CONFLICT_DAY,
  FIXTURE_WORKER_FREE_WINDOWS_DAY,
} from '@/features/sales-orders/journeyLaneFixtures';

describe('workerDayPlan (time-based capacity)', () => {
  it('FIXTURE_WORKER_FREE_WINDOWS_DAY: several tasks + free windows, under capacity', () => {
    const f = FIXTURE_WORKER_FREE_WINDOWS_DAY;
    const bounds = localDayBounds(f.dayYmd)!;
    const plan = buildWorkerDayPlan({
      dayStartMs: bounds.dayStartMs,
      dayEndMs: bounds.dayEndMs,
      busy: [...f.busy],
      proposed: f.proposed,
      capacityMinutes: f.capacityMinutes,
    });
    expect(plan.taskCount).toBe(3);
    expect(plan.plannedMinutes).toBe(2 * 60 + 2.5 * 60 + 1.5 * 60);
    expect(plan.capacityMinutes).toBe(8 * 60);
    expect(plan.overCapacity).toBe(false);
    expect(plan.freeWindows.length).toBeGreaterThanOrEqual(2);
    expect(plan.blocks.some((b) => b.kind === 'available')).toBe(true);
    expect(plan.blocks.some((b) => b.kind === 'proposed' && !b.conflicts)).toBe(
      true,
    );
  });

  it('FIXTURE_WORKER_CONFLICT_DAY: proposed overlaps busy — conflict, no auto-move', () => {
    const f = FIXTURE_WORKER_CONFLICT_DAY;
    const bounds = localDayBounds(f.dayYmd)!;
    const plan = buildWorkerDayPlan({
      dayStartMs: bounds.dayStartMs,
      dayEndMs: bounds.dayEndMs,
      busy: [...f.busy],
      proposed: f.proposed,
      capacityMinutes: f.capacityMinutes,
    });
    const proposed = plan.blocks.find((b) => b.kind === 'proposed');
    expect(proposed && proposed.kind === 'proposed' && proposed.conflicts).toBe(
      true,
    );
  });

  it('FIXTURE_WORKER_120_PCT_DAY: overtime context without reschedule', () => {
    const f = FIXTURE_WORKER_120_PCT_DAY;
    const bounds = localDayBounds(f.dayYmd)!;
    const plan = buildWorkerDayPlan({
      dayStartMs: bounds.dayStartMs,
      dayEndMs: bounds.dayEndMs,
      busy: [...f.busy],
      proposed: null,
      capacityMinutes: f.capacityMinutes,
    });
    expect(plan.overCapacity).toBe(true);
    expect(plan.loadPercent).toBeGreaterThanOrEqual(120);
    expect(plan.availableMinutes).toBe(0);
  });

  it('suggestWindowFromFree never mutates busy blocks — returns opt-in window only', () => {
    const f = FIXTURE_WORKER_FREE_WINDOWS_DAY;
    const bounds = localDayBounds(f.dayYmd)!;
    const plan = buildWorkerDayPlan({
      dayStartMs: bounds.dayStartMs,
      dayEndMs: bounds.dayEndMs,
      busy: [...f.busy],
      capacityMinutes: f.capacityMinutes,
    });
    const suggestion = suggestWindowFromFree(plan.freeWindows, 60);
    expect(suggestion).not.toBeNull();
    expect(plan.blocks.filter((b) => b.kind === 'busy')).toHaveLength(3);
  });

  it('7.5h / 8h with 4 tasks is valid (not one-order-per-day)', () => {
    const bounds = localDayBounds('2026-09-01')!;
    const plan = buildWorkerDayPlan({
      dayStartMs: bounds.dayStartMs,
      dayEndMs: bounds.dayEndMs,
      capacityMinutes: 480,
      busy: [
        {
          startMs: new Date(2026, 8, 1, 8, 0).getTime(),
          endMs: new Date(2026, 8, 1, 10, 0).getTime(),
          label: 'A',
        },
        {
          startMs: new Date(2026, 8, 1, 10, 0).getTime(),
          endMs: new Date(2026, 8, 1, 12, 0).getTime(),
          label: 'B',
        },
        {
          startMs: new Date(2026, 8, 1, 12, 30).getTime(),
          endMs: new Date(2026, 8, 1, 14, 0).getTime(),
          label: 'C',
        },
        {
          startMs: new Date(2026, 8, 1, 14, 0).getTime(),
          endMs: new Date(2026, 8, 1, 16, 0).getTime(),
          label: 'D',
        },
      ],
    });
    expect(plan.taskCount).toBe(4);
    expect(plan.plannedMinutes).toBe(7.5 * 60);
    expect(plan.overCapacity).toBe(false);
    expect(plan.loadPercent).toBe(93.8);
  });
});

describe('windowFromFreeBlock', () => {
  const start = new Date(2026, 8, 1, 10, 0).getTime();
  const end = new Date(2026, 8, 1, 12, 0).getTime(); // 2h free

  it('places duration at block start when it fits', () => {
    const picked = windowFromFreeBlock(start, end, 60);
    expect(picked).toEqual({
      startMs: start,
      endMs: start + 60 * 60_000,
    });
  });

  it('caps end to the free slot when duration is longer', () => {
    const picked = windowFromFreeBlock(start, end, 180);
    expect(picked).toEqual({ startMs: start, endMs: end });
  });

  it('uses the full tiny slot when duration exceeds it', () => {
    const tinyEnd = start + 15 * 60_000;
    const picked = windowFromFreeBlock(start, tinyEnd, 120);
    expect(picked).toEqual({ startMs: start, endMs: tinyEnd });
  });

  it('returns null for inverted or empty ranges', () => {
    expect(windowFromFreeBlock(end, start, 30)).toBeNull();
    expect(windowFromFreeBlock(start, start, 30)).toBeNull();
  });
});

describe('pickSlotsFromFreeWindows / buildDayPickTimeline', () => {
  it('splits an empty 8h day into duration-sized Available picks', () => {
    const bounds = localDayBounds('2026-09-01')!;
    const plan = buildWorkerDayPlan({
      dayStartMs: bounds.dayStartMs,
      dayEndMs: bounds.dayEndMs,
      busy: [],
      capacityMinutes: 480,
    });
    const slots = pickSlotsFromFreeWindows(plan.freeWindows, 120);
    expect(slots).toHaveLength(4);
    expect(formatHm(slots[0]!.startMs)).toBe('08:00');
    expect(formatHm(slots[0]!.endMs)).toBe('10:00');
    expect(formatHm(slots[3]!.startMs)).toBe('14:00');
    expect(formatHm(slots[3]!.endMs)).toBe('16:00');

    const timeline = buildDayPickTimeline(plan, 120);
    expect(timeline.every((b) => b.kind === 'available')).toBe(true);
    expect(timeline).toHaveLength(4);
  });

  it('keeps busy blocks and fills free gaps with picks for any worker day', () => {
    const bounds = localDayBounds('2026-09-01')!;
    const busyStart = new Date(2026, 8, 1, 10, 0).getTime();
    const busyEnd = new Date(2026, 8, 1, 12, 0).getTime();
    const plan = buildWorkerDayPlan({
      dayStartMs: bounds.dayStartMs,
      dayEndMs: bounds.dayEndMs,
      busy: [{ startMs: busyStart, endMs: busyEnd, label: 'SO-1' }],
      capacityMinutes: 480,
    });
    const timeline = buildDayPickTimeline(plan, 120);
    expect(timeline.map((b) => b.kind)).toEqual([
      'available',
      'busy',
      'available',
      'available',
    ]);
    expect(timeline[0]).toMatchObject({
      kind: 'available',
      startMs: bounds.dayStartMs,
      endMs: busyStart,
    });
    expect(timeline[1]).toMatchObject({ kind: 'busy', label: 'SO-1' });
  });
});
