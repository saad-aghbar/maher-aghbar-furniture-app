import { WorkingCalendar } from './working-calendar';
import { planExecutionRipple, planPauseSlide, type RippleAllocation } from './execution-ripple';

function cal(extra?: ConstructorParameters<typeof WorkingCalendar>[0]['exceptions']) {
  return new WorkingCalendar({
    timezone: 'Asia/Amman',
    workingWeekdays: [0, 1, 2, 3, 4, 6],
    shiftStart: '08:00',
    shiftEnd: '16:00',
    exceptions: extra,
  });
}

function alloc(partial: Partial<RippleAllocation> & Pick<RippleAllocation, 'allocationId' | 'taskId'>): RippleAllocation {
  return {
    employeeId: 'w1',
    plannedStart: new Date('2026-09-08T05:00:00.000Z'), // 08:00 Asia/Amman
    plannedEnd: new Date('2026-09-08T07:00:00.000Z'),
    estimatedMinutes: 120,
    isPinned: false,
    taskStatus: 'NOT_STARTED',
    orderId: 'po-1',
    ...partial,
  };
}

describe('planExecutionRipple', () => {
  const now = new Date('2026-09-08T10:00:00.000Z'); // 13:00 Amman

  it('places remainder on the next working day for tomorrow mode', () => {
    const calendar = cal();
    const result = planExecutionRipple({
      overrunningTaskId: 't1',
      remainingMinutes: 90,
      mode: 'tomorrow',
      now,
      calendar,
      allocations: [
        alloc({
          allocationId: 'a1',
          taskId: 't1',
          taskStatus: 'IN_PROGRESS',
        }),
      ],
      edges: [],
    });
    expect(result.moves).toHaveLength(1);
    expect(calendar.localYmd(result.moves[0]!.newStart)).toBe('2026-09-09');
  });

  it('does not move started tasks and reports STARTED_TASK', () => {
    const calendar = cal();
    const result = planExecutionRipple({
      overrunningTaskId: 't1',
      remainingMinutes: 60,
      mode: 'overtime',
      now,
      calendar,
      allocations: [
        alloc({ allocationId: 'a1', taskId: 't1', taskStatus: 'IN_PROGRESS' }),
        alloc({
          allocationId: 'a2',
          taskId: 't2',
          taskStatus: 'IN_PROGRESS',
          plannedStart: new Date('2026-09-08T07:00:00.000Z'),
          plannedEnd: new Date('2026-09-08T09:00:00.000Z'),
        }),
      ],
      edges: [],
    });
    expect(result.blocked.some((b) => b.code === 'STARTED_TASK' && b.taskId === 't2')).toBe(true);
    expect(result.moves.every((m) => m.taskId !== 't2')).toBe(true);
  });

  it('stops at a pinned later allocation', () => {
    const calendar = cal();
    const result = planExecutionRipple({
      overrunningTaskId: 't1',
      remainingMinutes: 180,
      mode: 'overtime',
      now,
      calendar,
      allocations: [
        alloc({ allocationId: 'a1', taskId: 't1', taskStatus: 'IN_PROGRESS' }),
        alloc({
          allocationId: 'a2',
          taskId: 't2',
          isPinned: true,
          plannedStart: new Date('2026-09-08T10:00:00.000Z'),
          plannedEnd: new Date('2026-09-08T12:00:00.000Z'),
        }),
      ],
      edges: [],
    });
    expect(result.blocked.some((b) => b.code === 'PINNED_MOVED')).toBe(true);
    expect(result.moves.every((m) => m.taskId !== 't2')).toBe(true);
  });

  it('shifts a NOT_STARTED DAG successor after the remainder', () => {
    const calendar = cal();
    const result = planExecutionRipple({
      overrunningTaskId: 't1',
      remainingMinutes: 120,
      mode: 'tomorrow',
      now,
      calendar,
      allocations: [
        alloc({ allocationId: 'a1', taskId: 't1', taskStatus: 'IN_PROGRESS' }),
        alloc({
          allocationId: 'a2',
          taskId: 't2',
          employeeId: 'w2',
          plannedStart: new Date('2026-09-08T07:00:00.000Z'),
          plannedEnd: new Date('2026-09-08T09:00:00.000Z'),
        }),
      ],
      edges: [{ fromTaskId: 't1', toTaskId: 't2' }],
    });
    const successor = result.moves.find((m) => m.taskId === 't2');
    expect(successor).toBeTruthy();
    expect(successor!.reason).toBe('dag_downstream');
    expect(successor!.newStart.getTime()).toBeGreaterThanOrEqual(
      result.moves.find((m) => m.taskId === 't1')!.newEnd.getTime(),
    );
  });

  it('uses EXTRA_SHIFT hours for overtime remainder', () => {
    const calendar = cal([
      {
        date: new Date('2026-09-08T12:00:00.000Z'),
        type: 'EXTRA_SHIFT',
        shiftStart: '08:00',
        shiftEnd: '20:00',
      },
    ]);
    const late = new Date('2026-09-08T14:00:00.000Z'); // 17:00 Amman — past normal 16:00
    const result = planExecutionRipple({
      overrunningTaskId: 't1',
      remainingMinutes: 60,
      mode: 'overtime',
      now: late,
      calendar,
      allocations: [alloc({ allocationId: 'a1', taskId: 't1', taskStatus: 'IN_PROGRESS' })],
      edges: [],
    });
    expect(result.moves).toHaveLength(1);
    expect(calendar.localYmd(result.moves[0]!.newStart)).toBe('2026-09-08');
  });
});

describe('planPauseSlide', () => {
  const lunchCal = () =>
    new WorkingCalendar({
      timezone: 'Asia/Amman',
      workingWeekdays: [0, 1, 2, 3, 4, 6],
      shiftStart: '08:00',
      shiftEnd: '16:00',
      breaks: [{ start: '12:00', end: '12:30' }],
      exceptions: [],
    });

  it('does not slide when the pause is only the 12:00–12:30 lunch', () => {
    const calendar = lunchCal();
    const pauseStart = new Date('2026-09-08T09:00:00.000Z'); // 12:00 Amman
    const resumeAt = new Date('2026-09-08T09:30:00.000Z'); // 12:30 Amman
    const minutes = calendar.workingMinutesBetween(pauseStart, resumeAt);
    expect(minutes).toBe(0);
    const result = planPauseSlide({
      taskId: 't1',
      pauseWorkingMinutes: minutes,
      calendar,
      allocations: [
        alloc({ allocationId: 'a1', taskId: 't1', taskStatus: 'IN_PROGRESS' }),
        alloc({
          allocationId: 'a2',
          taskId: 't2',
          plannedStart: new Date('2026-09-08T10:00:00.000Z'),
          plannedEnd: new Date('2026-09-08T13:00:00.000Z'),
        }),
      ],
      edges: [],
    });
    expect(result.moves).toHaveLength(0);
  });

  it('slides later same-worker NOT_STARTED work by 60 working minutes', () => {
    const calendar = lunchCal();
    const result = planPauseSlide({
      taskId: 't1',
      pauseWorkingMinutes: 60,
      calendar,
      allocations: [
        alloc({
          allocationId: 'a1',
          taskId: 't1',
          taskStatus: 'IN_PROGRESS',
          plannedStart: new Date('2026-09-08T05:00:00.000Z'),
          plannedEnd: new Date('2026-09-08T09:00:00.000Z'),
        }),
        alloc({
          allocationId: 'a2',
          taskId: 't2',
          plannedStart: new Date('2026-09-08T09:30:00.000Z'),
          plannedEnd: new Date('2026-09-08T11:30:00.000Z'),
          estimatedMinutes: 120,
        }),
      ],
      edges: [],
    });
    const source = result.moves.find((m) => m.taskId === 't1');
    const later = result.moves.find((m) => m.taskId === 't2');
    expect(source).toBeTruthy();
    expect(later).toBeTruthy();
    expect(calendar.workingMinutesBetween(source!.oldEnd, source!.newEnd)).toBe(60);
    expect(later!.newStart.getTime()).toBeGreaterThanOrEqual(source!.newEnd.getTime());
  });
});
