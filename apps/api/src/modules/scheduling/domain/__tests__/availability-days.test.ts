import {
  classifyAdminAvailabilityDay,
  dealerMaySelectDay,
  toDealerAvailabilityDay,
} from '../availability-days';

describe('availability days', () => {
  it('dealer cannot select HIGH_LOAD, closed, or too-early days', () => {
    const high = classifyAdminAvailabilityDay({
      ymd: '2026-09-23',
      isWorking: true,
      earliestYmd: '2026-09-22',
      loadPercent: 120,
      remainingMinutes: 0,
      requiredMinutes: 120,
    });
    expect(high.status).toBe('high_load');
    expect(high.reason).toBe('HIGH_LOAD');
    expect(dealerMaySelectDay(high)).toBe(false);
    expect(toDealerAvailabilityDay(high).status).toBe('unavailable');
    expect(toDealerAvailabilityDay(high).selectable).toBe(false);

    const closed = classifyAdminAvailabilityDay({
      ymd: '2026-09-25',
      isWorking: false,
      earliestYmd: '2026-09-22',
      loadPercent: 0,
      remainingMinutes: 0,
      requiredMinutes: 60,
    });
    expect(closed.status).toBe('closed');
    expect(dealerMaySelectDay(closed)).toBe(false);

    const early = classifyAdminAvailabilityDay({
      ymd: '2026-09-20',
      isWorking: true,
      earliestYmd: '2026-09-22',
      loadPercent: 10,
      remainingMinutes: 400,
      requiredMinutes: 60,
    });
    expect(early.reason).toBe('TOO_EARLY');
    expect(dealerMaySelectDay(early)).toBe(false);
  });

  it('admin can see high load while dealer still cannot select it', () => {
    const day = classifyAdminAvailabilityDay({
      ymd: '2026-09-23',
      isWorking: true,
      earliestYmd: '2026-09-22',
      loadPercent: 110,
      remainingMinutes: 40,
      requiredMinutes: 120,
    });
    expect(day.status).toBe('high_load');
    expect(toDealerAvailabilityDay(day).selectable).toBe(false);
  });

  it('marks a working day after earliest with spare capacity as available', () => {
    const day = classifyAdminAvailabilityDay({
      ymd: '2026-09-22',
      isWorking: true,
      earliestYmd: '2026-09-22',
      loadPercent: 40,
      remainingMinutes: 280,
      requiredMinutes: 120,
    });
    expect(day.status).toBe('available');
    expect(dealerMaySelectDay(day)).toBe(true);
  });
});
