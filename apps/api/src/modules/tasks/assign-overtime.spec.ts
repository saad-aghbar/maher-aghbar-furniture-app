import { mergeOvertimeException } from '../scheduling/overtime-assign';

describe('mergeOvertimeException', () => {
  it('extends an existing EXTRA_SHIFT rather than shrinking it', () => {
    const merged = mergeOvertimeException({
      existing: {
        type: 'EXTRA_SHIFT',
        shiftStart: '08:00',
        shiftEnd: '20:00',
        overtimeEmployeeIds: ['worker-a'],
      },
      calendarShiftStart: '08:00',
      calendarShiftEnd: '16:00',
      untilHm: '17:30',
      employeeId: 'worker-b',
    });
    expect(merged.shiftEnd).toBe('20:00');
    expect(merged.overtimeEmployeeIds).toEqual(['worker-a', 'worker-b']);
  });

  it('unions overtimeEmployeeIds without duplicating', () => {
    const merged = mergeOvertimeException({
      existing: {
        type: 'EXTRA_SHIFT',
        shiftStart: '08:00',
        shiftEnd: '17:00',
        overtimeEmployeeIds: ['worker-a'],
      },
      calendarShiftStart: '08:00',
      calendarShiftEnd: '16:00',
      untilHm: '18:00',
      employeeId: 'worker-a',
    });
    expect(merged.shiftEnd).toBe('18:00');
    expect(merged.overtimeEmployeeIds).toEqual(['worker-a']);
  });

  it('starts from the factory shift when no overtime exists yet', () => {
    const merged = mergeOvertimeException({
      existing: null,
      calendarShiftStart: '08:00',
      calendarShiftEnd: '16:00',
      untilHm: '17:30',
      employeeId: 'worker-a',
    });
    expect(merged.shiftStart).toBe('08:00');
    expect(merged.shiftEnd).toBe('17:30');
    expect(merged.overtimeEmployeeIds).toEqual(['worker-a']);
  });
});
