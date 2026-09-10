import {
  canOfferLeftover,
  isLastSameWorkerWindowToday,
  leftoverRemainingMinutes,
} from './leftover-eligibility';

describe('leftover eligibility', () => {
  const localYmd = (d: Date) => d.toISOString().slice(0, 10);

  it('hides leftover and overtime when another same-worker window is later today', () => {
    const last = isLastSameWorkerWindowToday({
      taskId: 'morning',
      employeeId: 'w1',
      localYmd,
      allocations: [
        {
          taskId: 'morning',
          employeeId: 'w1',
          plannedStart: new Date('2026-09-08T05:00:00.000Z'),
        },
        {
          taskId: 'afternoon',
          employeeId: 'w1',
          plannedStart: new Date('2026-09-08T10:00:00.000Z'),
        },
      ],
    });
    expect(last).toBe(false);
    expect(canOfferLeftover({ status: 'IN_PROGRESS', isLastWindowToday: last })).toBe(false);
  });

  it('offers leftover on the worker’s last planned window today', () => {
    const last = isLastSameWorkerWindowToday({
      taskId: 'afternoon',
      employeeId: 'w1',
      localYmd,
      allocations: [
        {
          taskId: 'morning',
          employeeId: 'w1',
          plannedStart: new Date('2026-09-08T05:00:00.000Z'),
        },
        {
          taskId: 'afternoon',
          employeeId: 'w1',
          plannedStart: new Date('2026-09-08T10:00:00.000Z'),
        },
      ],
    });
    expect(last).toBe(true);
    expect(canOfferLeftover({ status: 'PAUSED', isLastWindowToday: last })).toBe(true);
  });

  it('uses max(1, estimated − elapsed) for leftover minutes', () => {
    expect(leftoverRemainingMinutes(120, 90)).toBe(30);
    expect(leftoverRemainingMinutes(60, 90)).toBe(1);
    expect(leftoverRemainingMinutes(null, 10)).toBe(30);
  });
});
