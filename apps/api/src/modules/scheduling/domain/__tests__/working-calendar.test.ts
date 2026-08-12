import { WorkingCalendar, zonedLocalToUtc } from '../working-calendar';

const TZ = 'Asia/Amman';

function amman(y: number, m: number, d: number, hh: number, mm: number): Date {
  return zonedLocalToUtc(y, m, d, hh, mm, 0, TZ);
}

/** Factory default: Fri closed, Sat open, 08:00–16:00. */
function calendar(overrides: Partial<ConstructorParameters<typeof WorkingCalendar>[0]> = {}) {
  return new WorkingCalendar({
    timezone: TZ,
    workingWeekdays: [0, 1, 2, 3, 4, 6],
    shiftStart: '08:00',
    shiftEnd: '16:00',
    breaks: [{ start: '12:00', end: '13:00' }],
    exceptions: [],
    ...overrides,
  });
}

describe('WorkingCalendar (Asia/Amman)', () => {
  // 2026-08-09 Sunday, 2026-08-07 Friday, 2026-08-08 Saturday, 2026-08-06 Thursday

  it('treats Fri closed and Sat–Thu working', () => {
    const cal = calendar();
    expect(cal.isWorking(amman(2026, 8, 9, 10, 0))).toBe(true); // Sunday
    expect(cal.isWorking(amman(2026, 8, 7, 10, 0))).toBe(false); // Friday
    expect(cal.isWorking(amman(2026, 8, 8, 10, 0))).toBe(true); // Saturday
    expect(cal.isWorking(amman(2026, 8, 6, 15, 30))).toBe(true); // Thursday before 16:00
    expect(cal.isWorking(amman(2026, 8, 6, 16, 30))).toBe(false); // after shift end
  });

  it('excludes lunch break from working time', () => {
    const cal = calendar();
    expect(cal.isWorking(amman(2026, 8, 9, 12, 30))).toBe(false);
    expect(cal.isWorking(amman(2026, 8, 9, 11, 59))).toBe(true);
    expect(cal.isWorking(amman(2026, 8, 9, 13, 0))).toBe(true);
  });

  it('honors HOLIDAY and SHUTDOWN exceptions', () => {
    const cal = calendar({
      exceptions: [
        { date: amman(2026, 8, 9, 12, 0), type: 'HOLIDAY' },
        { date: amman(2026, 8, 10, 12, 0), type: 'SHUTDOWN' },
      ],
    });
    expect(cal.isWorking(amman(2026, 8, 9, 10, 0))).toBe(false);
    expect(cal.isWorking(amman(2026, 8, 10, 10, 0))).toBe(false);
  });

  it('opens a closed Friday via EXTRA_SHIFT with normal hours', () => {
    const cal = calendar({
      exceptions: [
        {
          date: amman(2026, 8, 7, 12, 0),
          type: 'EXTRA_SHIFT',
          shiftStart: '08:00',
          shiftEnd: '16:00',
        },
      ],
    });
    expect(cal.isWorking(amman(2026, 8, 7, 10, 0))).toBe(true);
    expect(cal.isWorking(amman(2026, 8, 7, 12, 30))).toBe(false); // lunch kept
    expect(cal.isWorking(amman(2026, 8, 7, 16, 30))).toBe(false);
  });

  it('extends a working day with overtime EXTRA_SHIFT and keeps lunch', () => {
    const cal = calendar({
      exceptions: [
        {
          date: amman(2026, 8, 6, 12, 0), // Thursday
          type: 'EXTRA_SHIFT',
          shiftStart: '08:00',
          shiftEnd: '20:00',
        },
      ],
    });
    expect(cal.isWorking(amman(2026, 8, 6, 12, 30))).toBe(false);
    expect(cal.isWorking(amman(2026, 8, 6, 18, 0))).toBe(true);
    expect(cal.isWorking(amman(2026, 8, 6, 20, 30))).toBe(false);
    const intervals = cal.intervalsForLocalDay(amman(2026, 8, 6, 12, 0));
    expect(intervals).toHaveLength(2);
    expect(intervals[1]!.end.toISOString()).toBe(amman(2026, 8, 6, 20, 0).toISOString());
  });

  it('nextWorkingInstant jumps from Friday to Saturday open', () => {
    const cal = calendar();
    const next = cal.nextWorkingInstant(amman(2026, 8, 7, 15, 0)); // Friday afternoon
    expect(next.toISOString()).toBe(amman(2026, 8, 8, 8, 0).toISOString());
  });

  it('addWorkingMinutes skips breaks and Friday', () => {
    const cal = calendar();
    const end = cal.addWorkingMinutes(amman(2026, 8, 9, 11, 0), 90);
    expect(end.toISOString()).toBe(amman(2026, 8, 9, 13, 30).toISOString());
  });

  it('addWorkingMinutes spills across Friday into Saturday', () => {
    const cal = calendar();
    // Thursday 15:00 + 120m → Thu 15:00–16:00 = 60m, Fri off → Sat 08:00 + 60m = 09:00
    const end = cal.addWorkingMinutes(amman(2026, 8, 6, 15, 0), 120);
    expect(end.toISOString()).toBe(amman(2026, 8, 8, 9, 0).toISOString());
  });

  it('subtractWorkingMinutes walks backward across break', () => {
    const cal = calendar();
    const start = cal.subtractWorkingMinutes(amman(2026, 8, 9, 13, 30), 90);
    expect(start.toISOString()).toBe(amman(2026, 8, 9, 11, 0).toISOString());
  });

  it('expands working intervals with break split until 16:00', () => {
    const cal = calendar();
    const intervals = cal.intervalsForLocalDay(amman(2026, 8, 9, 12, 0));
    expect(intervals).toHaveLength(2);
    expect(intervals[0]!.start.toISOString()).toBe(amman(2026, 8, 9, 8, 0).toISOString());
    expect(intervals[0]!.end.toISOString()).toBe(amman(2026, 8, 9, 12, 0).toISOString());
    expect(intervals[1]!.start.toISOString()).toBe(amman(2026, 8, 9, 13, 0).toISOString());
    expect(intervals[1]!.end.toISOString()).toBe(amman(2026, 8, 9, 16, 0).toISOString());
  });
});
