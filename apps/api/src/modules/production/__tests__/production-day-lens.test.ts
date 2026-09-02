import {
  intervalOverlapsFactoryDay,
  productionDayLensWhere,
  resolveFactoryDayBounds,
} from '../production-day-lens';

describe('production-day-lens (Phase C)', () => {
  const tz = 'Asia/Amman';

  it('resolves factory-local day bounds (not UTC midnight)', () => {
    const bounds = resolveFactoryDayBounds('2026-09-08', tz, new Date('2026-09-08T12:00:00Z'));
    expect(bounds.onDate).toBe('2026-09-08');
    expect(bounds.timezone).toBe(tz);
    // 00:30 Amman on Sep 8 is still Sep 8 locally
    const localHalfPast = new Date(bounds.start.getTime() + 30 * 60 * 1000);
    expect(localHalfPast.getTime()).toBeGreaterThanOrEqual(bounds.start.getTime());
    expect(localHalfPast.getTime()).toBeLessThan(bounds.endExclusive.getTime());
  });

  it('includes spanning planned intervals on overlapping dates', () => {
    const day = resolveFactoryDayBounds('2026-09-08', tz);
    const start = new Date(day.start.getTime() - 2 * 60 * 60 * 1000); // prev evening
    const end = new Date(day.endExclusive.getTime() + 2 * 60 * 60 * 1000); // next morning
    expect(intervalOverlapsFactoryDay(start, end, day.start, day.endExclusive)).toBe(true);

    const nextDay = resolveFactoryDayBounds('2026-09-09', tz);
    expect(intervalOverlapsFactoryDay(start, end, nextDay.start, nextDay.endExclusive)).toBe(true);

    const earlier = resolveFactoryDayBounds('2026-09-07', tz);
    // Still overlaps Sep 7 if start is before Sep 8
    expect(intervalOverlapsFactoryDay(start, end, earlier.start, earlier.endExclusive)).toBe(true);
  });

  it('keeps planned and actual predicates separate', () => {
    const bounds = resolveFactoryDayBounds('2026-09-08', tz);
    const planned = productionDayLensWhere(bounds, 'planned');
    const actual = productionDayLensWhere(bounds, 'actual');
    expect(JSON.stringify(planned)).toContain('plannedStart');
    expect(JSON.stringify(planned)).not.toContain('actualStart');
    expect(JSON.stringify(actual)).toContain('actualStart');
    expect(JSON.stringify(actual)).toContain('receivedAt');
  });

  it('timezone boundary: late UTC evening can still be Amman next morning', () => {
    // 2026-09-07 21:30 UTC = 2026-09-08 00:30 Asia/Amman (UTC+3)
    const instant = new Date('2026-09-07T21:30:00.000Z');
    const sep8 = resolveFactoryDayBounds('2026-09-08', tz);
    expect(instant.getTime()).toBeGreaterThanOrEqual(sep8.start.getTime());
    expect(instant.getTime()).toBeLessThan(sep8.endExclusive.getTime());
    const sep7 = resolveFactoryDayBounds('2026-09-07', tz);
    expect(instant.getTime()).toBeGreaterThanOrEqual(sep7.endExclusive.getTime());
  });
});
