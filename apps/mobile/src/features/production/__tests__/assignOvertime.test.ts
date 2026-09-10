import { localDayBounds } from '../workerDayPlan';
import { overtimeStartMs, planShortSlot } from '../assignOvertime';

const sunday = localDayBounds('2026-09-06')!;
const monday = localDayBounds('2026-09-07')!;
const saturday = localDayBounds('2026-09-05')!;

describe('planShortSlot', () => {
  it('spills a 90-minute stage from a 30-minute trailing gap to the next working day', () => {
    const slotStart = sunday.dayEndMs - 30 * 60_000;
    const planned = planShortSlot({
      slotStartMs: slotStart,
      slotEndMs: sunday.dayEndMs,
      durationMinutes: 90,
      shiftEndMs: sunday.dayEndMs,
      workingDays: [
        { ymd: '2026-09-06', startMs: sunday.dayStartMs, endMs: sunday.dayEndMs },
        { ymd: '2026-09-07', startMs: monday.dayStartMs, endMs: monday.dayEndMs },
      ],
    });
    expect(planned.spill).toMatchObject({
      kind: 'spill',
      startMs: slotStart,
      todayMinutes: 30,
      nextDayMinutes: 60,
    });
    expect(planned.spill?.endMs).toBe(monday.dayStartMs + 60 * 60_000);
  });

  it('skips a closed Friday when spilling', () => {
    const thursday = localDayBounds('2026-09-03')!;
    const friday = localDayBounds('2026-09-04')!;
    const slotStart = thursday.dayEndMs - 30 * 60_000;
    const planned = planShortSlot({
      slotStartMs: slotStart,
      slotEndMs: thursday.dayEndMs,
      durationMinutes: 90,
      shiftEndMs: thursday.dayEndMs,
      workingDays: [
        { ymd: '2026-09-03', startMs: thursday.dayStartMs, endMs: thursday.dayEndMs },
        { ymd: '2026-09-05', startMs: saturday.dayStartMs, endMs: saturday.dayEndMs },
      ],
    });
    expect(planned.spill?.endMs).toBe(saturday.dayStartMs + 60 * 60_000);
    expect(planned.spill?.endMs).not.toBe(friday.dayStartMs + 60 * 60_000);
  });

  it('ends overtime on the same day at start plus duration', () => {
    const slotStart = sunday.dayEndMs - 30 * 60_000;
    const planned = planShortSlot({
      slotStartMs: slotStart,
      slotEndMs: sunday.dayEndMs,
      durationMinutes: 90,
      shiftEndMs: sunday.dayEndMs,
      workingDays: [],
    });
    expect(planned.overtime.endMs).toBe(slotStart + 90 * 60_000);
    expect(planned.overtime.overtimeMinutes).toBe(60);
    expect(planned.spill).toBeNull();
  });
});

describe('overtimeStartMs', () => {
  it('starts at shift end on a fully booked day', () => {
    expect(
      overtimeStartMs({
        shiftEndMs: sunday.dayEndMs,
        lastBusyEndMs: sunday.dayEndMs,
      }),
    ).toBe(sunday.dayEndMs);
  });

  it('starts after the last block when that already runs past the shift', () => {
    const late = sunday.dayEndMs + 30 * 60_000;
    expect(
      overtimeStartMs({
        shiftEndMs: sunday.dayEndMs,
        lastBusyEndMs: late,
      }),
    ).toBe(late);
  });
});
