import {
  liveElapsedMinutes,
  liveTaskProgressPercent,
  withLiveProductionOrder,
} from '../liveTaskProgressPercent';

describe('liveTaskProgressPercent', () => {
  it('is 0 before work or without an estimate', () => {
    expect(
      liveTaskProgressPercent({ status: 'READY', elapsedMinutes: 0, estimatedMinutes: 120 }),
    ).toBe(0);
    expect(
      liveTaskProgressPercent({
        status: 'IN_PROGRESS',
        elapsedMinutes: 30,
        estimatedMinutes: null,
      }),
    ).toBe(0);
  });

  it('follows elapsed / estimate and caps at 100', () => {
    expect(
      liveTaskProgressPercent({
        status: 'IN_PROGRESS',
        elapsedMinutes: 60,
        estimatedMinutes: 120,
      }),
    ).toBe(50);
    expect(
      liveTaskProgressPercent({
        status: 'IN_PROGRESS',
        elapsedMinutes: 120,
        estimatedMinutes: 120,
      }),
    ).toBe(100);
    expect(
      liveTaskProgressPercent({
        status: 'IN_PROGRESS',
        elapsedMinutes: 180,
        estimatedMinutes: 120,
      }),
    ).toBe(100);
  });

  it('climbs when the same timer feed ticks forward while running', () => {
    const estimate = 120;
    const atOneHour = liveElapsedMinutes({
      running: true,
      openStartedAt: '2026-08-09T11:00:00.000Z',
      closedSeconds: 0,
      now: new Date('2026-08-09T12:00:00.000Z'),
    });
    const later = liveElapsedMinutes({
      running: true,
      openStartedAt: '2026-08-09T11:00:00.000Z',
      closedSeconds: 0,
      now: new Date('2026-08-09T12:12:00.000Z'),
    });
    expect(atOneHour).toBe(60);
    expect(later).toBe(72);
    expect(liveTaskProgressPercent({ status: 'IN_PROGRESS', elapsedMinutes: atOneHour, estimatedMinutes: estimate })).toBe(50);
    expect(liveTaskProgressPercent({ status: 'IN_PROGRESS', elapsedMinutes: later, estimatedMinutes: estimate })).toBe(60);
  });

  it('holds paused elapsed and is 100 when completed', () => {
    expect(
      liveTaskProgressPercent({
        status: 'PAUSED',
        elapsedMinutes: 30,
        estimatedMinutes: 120,
      }),
    ).toBe(25);
    expect(
      liveTaskProgressPercent({
        status: 'COMPLETED',
        elapsedMinutes: 40,
        estimatedMinutes: 120,
      }),
    ).toBe(100);
  });
});

describe('withLiveProductionOrder', () => {
  it('ticks running task percent from openStartedAt', () => {
    const order = {
      progressPercent: 0,
      tasks: [
        {
          status: 'IN_PROGRESS',
          progressPercent: 0,
          estimatedMinutes: 120,
          timing: {
            status: 'running',
            actualMinutes: 0,
            actualSeconds: 0,
            openStartedAt: '2026-08-09T11:00:00.000Z',
            estimatedMinutes: 120,
            elapsedMinutes: 0,
          },
        },
      ],
    };
    const atHour = withLiveProductionOrder(order, new Date('2026-08-09T12:00:00.000Z'));
    const later = withLiveProductionOrder(order, new Date('2026-08-09T12:12:00.000Z'));
    expect(atHour.tasks?.[0]?.progressPercent).toBe(50);
    expect(later.tasks?.[0]?.progressPercent).toBe(60);
  });
});
