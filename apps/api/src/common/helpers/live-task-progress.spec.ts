import {
  liveElapsedMinutes,
  livePercentFromTaskRow,
  liveStageProgressPercent,
  liveTaskProgressPercent,
  liveWorkflowProgressPercent,
} from './live-task-progress';

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

  it('climbs when elapsed ticks forward while running', () => {
    const estimate = 120;
    const atOneHour = liveTaskProgressPercent({
      status: 'IN_PROGRESS',
      elapsedMinutes: 60,
      estimatedMinutes: estimate,
    });
    const later = liveTaskProgressPercent({
      status: 'IN_PROGRESS',
      elapsedMinutes: 72,
      estimatedMinutes: estimate,
    });
    expect(atOneHour).toBe(50);
    expect(later).toBe(60);
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

describe('liveElapsedMinutes', () => {
  it('adds the open segment only while running', () => {
    const now = new Date('2026-08-09T12:00:00.000Z');
    expect(
      liveElapsedMinutes({
        running: true,
        openStartedAt: '2026-08-09T11:45:00.000Z',
        closedSeconds: 30 * 60,
        now,
      }),
    ).toBe(45);
    expect(
      liveElapsedMinutes({
        running: false,
        openStartedAt: '2026-08-09T11:45:00.000Z',
        closedSeconds: 30 * 60,
        now,
      }),
    ).toBe(30);
  });
});

describe('liveStageProgressPercent', () => {
  it('averages live task percents', () => {
    expect(
      liveStageProgressPercent([
        { status: 'IN_PROGRESS', elapsedMinutes: 60, estimatedMinutes: 120 },
        { status: 'COMPLETED', elapsedMinutes: 10, estimatedMinutes: 60 },
      ]),
    ).toBe(75);
  });
});

describe('liveWorkflowProgressPercent', () => {
  it('weights in-progress and paused work by estimate', () => {
    expect(
      liveWorkflowProgressPercent([
        { status: 'COMPLETED', progressPercent: 100, estimatedMinutes: 60 },
        { status: 'IN_PROGRESS', progressPercent: 50, estimatedMinutes: 60 },
      ]),
    ).toBe(75);
    expect(
      liveWorkflowProgressPercent([
        { status: 'PAUSED', progressPercent: 50, estimatedMinutes: 120 },
        { status: 'PENDING', progressPercent: 0, estimatedMinutes: 120 },
      ]),
    ).toBe(25);
  });
});

describe('livePercentFromTaskRow', () => {
  it('uses closed sessions only when paused', () => {
    expect(
      livePercentFromTaskRow({
        status: 'PAUSED',
        actualMinutes: 30,
        estimatedMinutes: 120,
        timeEntries: [
          {
            startedAt: '2026-08-09T10:00:00.000Z',
            endedAt: '2026-08-09T10:30:00.000Z',
          },
          {
            startedAt: '2026-08-09T11:00:00.000Z',
            endedAt: null,
          },
        ],
      }, new Date('2026-08-09T12:00:00.000Z')),
    ).toBe(25);
  });
});
