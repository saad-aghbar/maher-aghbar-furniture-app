import { addDaysYmd, deviceLocalTodayYmd } from '../factoryLocalDay';

describe('factoryLocalDay helpers', () => {
  it('addDaysYmd spans month boundaries', () => {
    expect(addDaysYmd('2026-09-08', 1)).toBe('2026-09-09');
    expect(addDaysYmd('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDaysYmd('2026-09-08', -2)).toBe('2026-09-06');
  });

  it('deviceLocalTodayYmd is YYYY-MM-DD', () => {
    expect(deviceLocalTodayYmd(new Date('2026-09-08T15:00:00'))).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });
});
