import {
  adminLoadDensity,
  adminLoadTone,
  buildMonthCells,
  compareYmd,
  monthRangeYmd,
  parseYmd,
  shiftMonth,
  toYmd,
  todayYmd,
  ymdInRange,
  nextDateRange,
} from '../calendarMath';

describe('calendarMath', () => {
  it('formats and parses YMD round-trip', () => {
    expect(toYmd(2026, 7, 11)).toBe('2026-08-11');
    expect(parseYmd('2026-08-11')).toEqual({ y: 2026, m: 7, d: 11 });
    expect(parseYmd('not-a-date')).toBeNull();
    expect(parseYmd('2026-02-31')).toBeNull();
  });

  it('builds Monday-first month cells with padding', () => {
    // August 2026 starts on Saturday → 5 leading nulls (Mon–Fri pad)
    const cells = buildMonthCells(2026, 7);
    expect(cells[0]).toBeNull();
    expect(cells.filter((c) => c != null).length).toBe(31);
    expect(cells.length % 7).toBe(0);
  });

  it('shifts months and returns month range', () => {
    expect(shiftMonth({ y: 2026, m: 0 }, -1)).toEqual({ y: 2025, m: 11 });
    expect(monthRangeYmd({ y: 2026, m: 7 })).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    });
  });

  it('compares and ranges YMD strings', () => {
    expect(compareYmd('2026-08-01', '2026-08-11')).toBe(-1);
    expect(ymdInRange('2026-08-11', '2026-08-01', '2026-08-31')).toBe(true);
    expect(ymdInRange('2026-07-31', '2026-08-01', null)).toBe(false);
  });

  it('builds a date range from successive taps', () => {
    expect(nextDateRange('', '', '2026-08-11')).toEqual({
      start: '2026-08-11',
      end: '',
    });
    expect(nextDateRange('2026-08-11', '', '2026-08-20')).toEqual({
      start: '2026-08-11',
      end: '2026-08-20',
    });
    expect(nextDateRange('2026-08-11', '', '2026-08-05')).toEqual({
      start: '2026-08-05',
      end: '2026-08-11',
    });
    expect(nextDateRange('2026-08-11', '', '2026-08-11')).toEqual({
      start: '2026-08-11',
      end: '2026-08-11',
    });
    expect(nextDateRange('2026-08-11', '2026-08-20', '2026-08-01')).toEqual({
      start: '2026-08-01',
      end: '',
    });
  });

  it('returns today as local YMD', () => {
    expect(todayYmd(new Date(2026, 7, 11))).toBe('2026-08-11');
  });

  it('maps admin load thresholds deterministically', () => {
    expect(adminLoadTone(0, false)).toBe('closed');
    expect(adminLoadTone(0, true)).toBe('empty');
    expect(adminLoadTone(1, true)).toBe('light');
    expect(adminLoadTone(2, true)).toBe('light');
    expect(adminLoadTone(3, true)).toBe('half');
    expect(adminLoadTone(5, true)).toBe('half');
    expect(adminLoadTone(6, true)).toBe('busy');
    expect(adminLoadDensity(0, true)).toBe(0);
    expect(adminLoadDensity(2, true)).toBe(1);
    expect(adminLoadDensity(4, true)).toBe(2);
    expect(adminLoadDensity(9, true)).toBe(3);
    expect(adminLoadDensity(3, false)).toBe(0);
  });
});
