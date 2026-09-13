import {
  bumpStageClock,
  hoursMinutesToTotalMinutes,
  totalMinutesToHoursMinutes,
} from '../formatDuration';

describe('stage clock duration', () => {
  it('splits and joins hours and minutes', () => {
    expect(totalMinutesToHoursMinutes(149)).toEqual({ hours: 2, minutes: 29 });
    expect(hoursMinutesToTotalMinutes(1, 55)).toBe(115);
  });

  it('wraps minutes into hours and will not go below zero', () => {
    expect(bumpStageClock(59, 'minutes', 1)).toBe(60);
    expect(bumpStageClock(60, 'minutes', -1)).toBe(59);
    expect(bumpStageClock(0, 'minutes', -1)).toBe(0);
    expect(bumpStageClock(60, 'hours', 1)).toBe(120);
    expect(bumpStageClock(5, 'hours', -1)).toBe(5);
  });
});
