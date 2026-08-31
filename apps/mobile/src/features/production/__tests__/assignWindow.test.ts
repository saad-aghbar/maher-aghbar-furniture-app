import {
  defaultAssignWindowParts,
  parseScheduleConflicts,
  parseSuggestedWindow,
} from '../assignWindow';

describe('assignWindow helpers', () => {
  it('defaults to a short slot instead of a full workday', () => {
    const parts = defaultAssignWindowParts({
      now: new Date('2026-09-01T09:10:00'),
      estimatedMinutes: 90,
    });
    expect(parts.start.ymd).toBe('2026-09-01');
    expect(parts.estHours).toBe('1');
    expect(parts.estMinutes).toBe('30');
    // Rounded up from 09:10 → 09:30, then +90m → 11:00
    expect(parts.start.hour).toBe('9');
    expect(parts.start.minute).toBe('30');
    expect(parts.due.hour).toBe('11');
    expect(parts.due.minute).toBe('00');
  });

  it('preserves existing planned window', () => {
    const parts = defaultAssignWindowParts({
      plannedStart: '2026-09-02T08:00:00.000Z',
      plannedCompletion: '2026-09-02T12:00:00.000Z',
    });
    expect(parts.start.ymd).toBeTruthy();
    expect(parts.due.ymd).toBeTruthy();
  });

  it('parses conflict payloads', () => {
    expect(parseScheduleConflicts(null)).toEqual([]);
    expect(
      parseScheduleConflicts([
        {
          kind: 'TASK',
          id: 't1',
          label: 'PO Cutting',
          start: 'a',
          end: 'b',
        },
      ]),
    ).toEqual([
      {
        kind: 'TASK',
        id: 't1',
        label: 'PO Cutting',
        start: 'a',
        end: 'b',
      },
    ]);
    expect(
      parseSuggestedWindow({
        plannedStart: 's',
        plannedCompletion: 'e',
      }),
    ).toEqual({ plannedStart: 's', plannedCompletion: 'e' });
  });
});
