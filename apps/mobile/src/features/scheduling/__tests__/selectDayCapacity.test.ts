import {
  canStepOvertime,
  defaultOvertimeEnd,
  formatMinutesToHm,
  overtimeBounds,
  overtimeExtraMinutes,
  overtimeHoursLabel,
  parseHmToMinutes,
  stepOvertimeEnd,
} from '../selectDayCapacity';

describe('selectDayCapacity overtime stepper', () => {
  it('parses and formats HH:MM', () => {
    expect(parseHmToMinutes('08:00')).toBe(480);
    expect(parseHmToMinutes('16:00')).toBe(960);
    expect(parseHmToMinutes('20:00')).toBe(1200);
    expect(parseHmToMinutes('bad')).toBeNull();
    expect(formatMinutesToHm(1200)).toBe('20:00');
  });

  it('defaults to 4 hours after the normal shift, snapped to 30 minutes', () => {
    expect(defaultOvertimeEnd('16:00')).toBe('20:00');
    expect(defaultOvertimeEnd('15:45')).toBe('20:00');
    expect(overtimeExtraMinutes('16:00', '20:00')).toBe(240);
    expect(overtimeHoursLabel(240)).toBe('4');
    expect(overtimeHoursLabel(30)).toBe('0.5');
  });

  it('steps by 30 minutes and stops at shift-end+30 and 23:30', () => {
    expect(overtimeBounds('16:00')).toEqual({ min: 990, max: 1410 });
    expect(stepOvertimeEnd('20:00', '16:00', 1)).toBe('20:30');
    expect(stepOvertimeEnd('20:00', '16:00', -1)).toBe('19:30');
    expect(stepOvertimeEnd('16:30', '16:00', -1)).toBe('16:30');
    expect(stepOvertimeEnd('23:30', '16:00', 1)).toBe('23:30');
    expect(canStepOvertime('16:30', '16:00', -1)).toBe(false);
    expect(canStepOvertime('23:30', '16:00', 1)).toBe(false);
    expect(canStepOvertime('20:00', '16:00', 1)).toBe(true);
  });

  it('clamps a late shift so overtime stays on the same calendar day', () => {
    expect(defaultOvertimeEnd('22:00')).toBe('23:30');
    expect(stepOvertimeEnd('23:00', '22:00', -1)).toBe('22:30');
  });
});
