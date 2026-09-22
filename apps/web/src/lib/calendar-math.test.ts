import { describe, expect, it } from 'vitest';
import {
  addDaysYmd,
  adminFactoryLoadTone,
  anyToYmd,
  buildMonthCells,
  cursorFromYmd,
  monthRangeYmd,
  nextDateRange,
  parseYmd,
  presetRange,
  shiftMonth,
  toYmd,
  ymdInRange,
} from '../../../../packages/ui/src/calendar/calendar-math';

describe('calendar-math (ported from mobile)', () => {
  it('parses and rejects YYYY-MM-DD', () => {
    expect(parseYmd('2026-09-21')).toEqual({ y: 2026, m: 8, d: 21 });
    expect(parseYmd('2026-02-30')).toBeNull();
    expect(parseYmd('nope')).toBeNull();
    expect(parseYmd('')).toBeNull();
  });

  it('builds Monday-first month cells padded to whole weeks', () => {
    const cells = buildMonthCells(2026, 8); // Sep 2026 starts on a Tuesday
    expect(cells.length % 7).toBe(0);
    expect(cells[0]).toBeNull();
    expect(cells[1]).toBe(1);
    expect(cells.filter((c) => c != null)).toHaveLength(30);
  });

  it('shifts months across year boundaries', () => {
    expect(shiftMonth({ y: 2026, m: 11 }, 1)).toEqual({ y: 2027, m: 0 });
    expect(shiftMonth({ y: 2026, m: 0 }, -1)).toEqual({ y: 2025, m: 11 });
  });

  it('computes month range and day arithmetic', () => {
    expect(monthRangeYmd({ y: 2026, m: 1 })).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(addDaysYmd('2026-09-30', 1)).toBe('2026-10-01');
    expect(toYmd(2026, 0, 5)).toBe('2026-01-05');
  });

  it('two-tap range: start, end (swapped when reversed), then restart', () => {
    expect(nextDateRange('', '', '2026-09-10')).toEqual({ start: '2026-09-10', end: '' });
    expect(nextDateRange('2026-09-10', '', '2026-09-05')).toEqual({ start: '2026-09-05', end: '2026-09-10' });
    expect(nextDateRange('2026-09-05', '2026-09-10', '2026-09-20')).toEqual({ start: '2026-09-20', end: '' });
    expect(ymdInRange('2026-09-07', '2026-09-05', '2026-09-10')).toBe(true);
    expect(ymdInRange('2026-09-11', '2026-09-05', '2026-09-10')).toBe(false);
  });

  it('maps factory load to the shared tone bands', () => {
    expect(adminFactoryLoadTone(0, false)).toBe('closed');
    expect(adminFactoryLoadTone(0, true)).toBe('empty');
    expect(adminFactoryLoadTone(30, true)).toBe('light');
    expect(adminFactoryLoadTone(60, true)).toBe('half');
    expect(adminFactoryLoadTone(90, true)).toBe('busy');
  });

  it('presets resolve relative to now', () => {
    const now = new Date(2026, 8, 21); // Monday
    expect(presetRange('today', now)).toEqual({ from: '2026-09-21', to: '2026-09-21' });
    expect(presetRange('week', now)).toEqual({ from: '2026-09-21', to: '2026-09-27' });
    expect(presetRange('month', now)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(presetRange('last30', now)).toEqual({ from: '2026-08-23', to: '2026-09-21' });
    expect(presetRange('ytd', now).from).toBe('2026-01-01');
  });

  it('normalises ISO timestamps and cursors', () => {
    expect(anyToYmd('2026-09-21T10:00:00.000Z').length).toBe(10);
    expect(anyToYmd(new Date(2026, 8, 21))).toBe('2026-09-21');
    expect(anyToYmd('')).toBe('');
    expect(cursorFromYmd('2026-03-15')).toEqual({ y: 2026, m: 2 });
  });
});
