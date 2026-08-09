import { buildTaskTimingSummary, closedSecondsFromTimeEntries } from './task-timing.util';

describe('closedSecondsFromTimeEntries', () => {
  it('sums closed wall-clock seconds without rounding up', () => {
    expect(
      closedSecondsFromTimeEntries([
        {
          startedAt: new Date('2026-08-09T12:00:00.000Z'),
          endedAt: new Date('2026-08-09T12:01:02.000Z'),
        },
      ]),
    ).toBe(62);
  });

  it('ignores open entries', () => {
    expect(
      closedSecondsFromTimeEntries([
        {
          startedAt: new Date('2026-08-09T12:00:00.000Z'),
          endedAt: null,
        },
      ]),
    ).toBe(0);
  });
});

describe('buildTaskTimingSummary', () => {
  const now = new Date('2026-08-09T12:00:00.000Z');

  it('returns idle when never started', () => {
    expect(
      buildTaskTimingSummary({
        status: 'READY',
        actualMinutes: 0,
        now,
      }),
    ).toEqual({
      status: 'idle',
      actualMinutes: 0,
      actualSeconds: 0,
      openStartedAt: null,
      estimatedMinutes: null,
      plannedCompletion: null,
      elapsedMinutes: 0,
    });
  });

  it('counts open segment when running', () => {
    const summary = buildTaskTimingSummary({
      status: 'IN_PROGRESS',
      actualMinutes: 30,
      actualSeconds: 30 * 60,
      openStartedAt: new Date('2026-08-09T11:45:00.000Z'),
      estimatedMinutes: 90,
      plannedCompletion: new Date('2026-08-09T18:30:00.000Z'),
      now,
    });
    expect(summary.status).toBe('running');
    expect(summary.openStartedAt).toBe('2026-08-09T11:45:00.000Z');
    expect(summary.elapsedMinutes).toBe(45);
    expect(summary.estimatedMinutes).toBe(90);
    expect(summary.plannedCompletion).toBe('2026-08-09T18:30:00.000Z');
  });

  it('preserves exact closed seconds when stopped', () => {
    expect(
      buildTaskTimingSummary({
        status: 'PAUSED',
        actualMinutes: 1,
        actualSeconds: 62,
        now,
      }),
    ).toMatchObject({
      status: 'stopped',
      actualMinutes: 1,
      actualSeconds: 62,
      openStartedAt: null,
      elapsedMinutes: 1,
    });
  });

  it('marks paused/blocked as stopped without open clock', () => {
    expect(
      buildTaskTimingSummary({
        status: 'PAUSED',
        actualMinutes: 12,
        now,
      }),
    ).toMatchObject({
      status: 'stopped',
      actualMinutes: 12,
      actualSeconds: 12 * 60,
      openStartedAt: null,
      elapsedMinutes: 12,
    });
  });

  it('marks completed as done', () => {
    expect(
      buildTaskTimingSummary({
        status: 'COMPLETED',
        actualMinutes: 40,
        now,
      }).status,
    ).toBe('done');
  });
});
