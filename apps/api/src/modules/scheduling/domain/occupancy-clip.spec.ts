import { clipLiveOccupancy, pauseVisualWindow } from './occupancy-clip';

describe('clipLiveOccupancy', () => {
  const start = new Date('2026-09-08T05:00:00.000Z'); // 08:00 Amman
  const end = new Date('2026-09-08T13:00:00.000Z'); // 16:00 Amman
  const now = new Date('2026-09-08T08:00:00.000Z'); // 11:00 Amman
  const pauseAt = new Date('2026-09-08T07:04:00.000Z'); // 10:04 Amman

  it('keeps the full window for in-progress work', () => {
    expect(
      clipLiveOccupancy({ start, end, now, taskStatus: 'IN_PROGRESS', pauseAt }),
    ).toEqual({ start, end });
  });

  it('clips paused work to the pause instant so the unused tail is free', () => {
    expect(
      clipLiveOccupancy({ start, end, now, taskStatus: 'PAUSED', pauseAt }),
    ).toEqual({ start, end: pauseAt });
  });

  it('falls back to now when pause instant is missing', () => {
    expect(clipLiveOccupancy({ start, end, now, taskStatus: 'PAUSED' })).toEqual({
      start,
      end: now,
    });
  });
});

describe('pauseVisualWindow', () => {
  const plannedEnd = new Date('2026-09-08T13:00:00.000Z');
  const now = new Date('2026-09-08T07:41:00.000Z');
  const pauseAt = new Date('2026-09-08T07:04:00.000Z');

  it('returns the open pause span for a paused task', () => {
    expect(pauseVisualWindow({ plannedEnd, now, taskStatus: 'PAUSED', pauseAt })).toEqual({
      start: pauseAt,
      end: now,
    });
  });

  it('is empty while the task is in progress', () => {
    expect(
      pauseVisualWindow({ plannedEnd, now, taskStatus: 'IN_PROGRESS', pauseAt }),
    ).toBeNull();
  });
});
