import { zonedLocalToUtc } from './working-calendar';
import { exceptionAppliesToWorker, freeWindowsFromBusy, workerDayWindows } from './worker-day-windows';

const TZ = 'Asia/Amman';
const ymd = '2026-09-12'; // Saturday, open

function amman(hh: number, mm: number): Date {
  return zonedLocalToUtc(2026, 9, 12, hh, mm, 0, TZ);
}

const baseInput = {
  timezone: TZ,
  workingWeekdays: [0, 1, 2, 3, 4, 6],
  shiftStart: '08:00',
  shiftEnd: '16:00',
  breaks: [{ start: '12:00', end: '13:00' }] as { start: string; end: string }[],
};

describe('workerDayWindows', () => {
  it('uses the factory shift when there is no overtime exception', () => {
    const day = workerDayWindows({
      calendarInput: { ...baseInput, exceptions: [] },
      ymd,
      workerId: 'ahmad',
    });
    expect(day.isWorking).toBe(true);
    expect(day.overtime).toBe(false);
    expect(day.availableMinutes).toBe(7 * 60); // 08–16 minus lunch
  });

  it('keeps EXTRA_SHIFT factory-wide when overtimeEmployeeIds is empty', () => {
    const day = workerDayWindows({
      calendarInput: {
        ...baseInput,
        exceptions: [
          {
            date: new Date(`${ymd}T00:00:00.000Z`),
            type: 'EXTRA_SHIFT',
            shiftStart: '08:00',
            shiftEnd: '19:00',
            overtimeEmployeeIds: [],
          },
        ],
      },
      ymd,
      workerId: 'ahmad',
    });
    expect(day.overtime).toBe(true);
    expect(day.factoryWideOvertime).toBe(true);
    expect(day.availableMinutes).toBe(10 * 60); // 08–19 minus lunch
  });

  it('restricts EXTRA_SHIFT to named workers when overtimeEmployeeIds is set', () => {
    const exception = {
      date: new Date(`${ymd}T00:00:00.000Z`),
      type: 'EXTRA_SHIFT' as const,
      shiftStart: '08:00',
      shiftEnd: '19:00',
      overtimeEmployeeIds: ['ahmad'],
    };
    const ahmad = workerDayWindows({
      calendarInput: { ...baseInput, exceptions: [exception] },
      ymd,
      workerId: 'ahmad',
    });
    const ali = workerDayWindows({
      calendarInput: { ...baseInput, exceptions: [exception] },
      ymd,
      workerId: 'ali',
    });
    expect(ahmad.overtime).toBe(true);
    expect(ahmad.availableMinutes).toBe(10 * 60);
    expect(ali.overtime).toBe(false);
    expect(ali.availableMinutes).toBe(7 * 60);
    expect(exceptionAppliesToWorker(exception, 'ali')).toBe(false);
  });

  it('builds free windows from busy blocks inside the available intervals', () => {
    const available = [
      { start: amman(8, 0), end: amman(12, 0) },
      { start: amman(13, 0), end: amman(16, 0) },
    ];
    const gaps = freeWindowsFromBusy(available, [
      { start: amman(8, 0), end: amman(10, 30) },
      { start: amman(13, 0), end: amman(14, 45) },
    ]);
    expect(gaps.map((g) => g.durationMinutes)).toEqual([90, 75]);
  });
});
