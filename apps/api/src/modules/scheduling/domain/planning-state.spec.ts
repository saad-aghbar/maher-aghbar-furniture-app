import {
  classifyPlanningState,
  isUnscheduledPlanningState,
} from './planning-state';

describe('classifyPlanningState', () => {
  const readyTask = {
    estimatedMinutes: 120,
    plannedStart: null,
    plannedCompletion: null,
    assignedEmployeeId: null,
    status: 'NOT_STARTED',
  };

  it('marks missing snapshot / durations as NEEDS_PLANNING', () => {
    expect(
      classifyPlanningState({ orderStatus: 'PLANNED', hasSnapshot: false, tasks: [readyTask] }),
    ).toBe('NEEDS_PLANNING');
    expect(
      classifyPlanningState({
        orderStatus: 'PLANNED',
        hasSnapshot: true,
        tasks: [{ ...readyTask, estimatedMinutes: null }],
      }),
    ).toBe('NEEDS_PLANNING');
    expect(classifyPlanningState({ orderStatus: 'PLANNED', hasSnapshot: true, tasks: [] })).toBe(
      'NEEDS_PLANNING',
    );
  });

  it('marks executable unplaced work as READY_TO_SCHEDULE', () => {
    expect(
      classifyPlanningState({
        orderStatus: 'READY',
        hasSnapshot: true,
        tasks: [readyTask, { ...readyTask, estimatedMinutes: 60 }],
      }),
    ).toBe('READY_TO_SCHEDULE');
  });

  it('marks mixed placement as PARTIALLY_SCHEDULED', () => {
    expect(
      classifyPlanningState({
        orderStatus: 'PLANNED',
        hasSnapshot: true,
        tasks: [
          {
            ...readyTask,
            assignedEmployeeId: 'w1',
            plannedStart: '2026-09-12T08:00:00.000Z',
            plannedCompletion: '2026-09-12T12:00:00.000Z',
          },
          readyTask,
        ],
      }),
    ).toBe('PARTIALLY_SCHEDULED');
  });

  it('marks every required future task placed as SCHEDULED', () => {
    expect(
      classifyPlanningState({
        orderStatus: 'PLANNED',
        hasSnapshot: true,
        tasks: [
          {
            ...readyTask,
            assignedEmployeeId: 'w1',
            plannedStart: '2026-09-12T08:00:00.000Z',
            plannedCompletion: '2026-09-12T12:00:00.000Z',
          },
        ],
      }),
    ).toBe('SCHEDULED');
  });

  it('marks on-floor work with remaining unplaced tasks as PARTIALLY_SCHEDULED', () => {
    expect(
      classifyPlanningState({
        orderStatus: 'IN_PROGRESS',
        hasSnapshot: true,
        tasks: [readyTask],
      }),
    ).toBe('PARTIALLY_SCHEDULED');
  });

  it('marks started work with no remaining placements as IN_PRODUCTION', () => {
    expect(
      classifyPlanningState({
        orderStatus: 'PLANNED',
        hasSnapshot: true,
        tasks: [{ ...readyTask, status: 'IN_PROGRESS' }],
      }),
    ).toBe('IN_PRODUCTION');
  });

  it('counts only READY_TO_SCHEDULE and PARTIALLY_SCHEDULED as unscheduled KPI', () => {
    expect(isUnscheduledPlanningState('READY_TO_SCHEDULE')).toBe(true);
    expect(isUnscheduledPlanningState('PARTIALLY_SCHEDULED')).toBe(true);
    expect(isUnscheduledPlanningState('NEEDS_PLANNING')).toBe(false);
    expect(isUnscheduledPlanningState('SCHEDULED')).toBe(false);
    expect(isUnscheduledPlanningState('IN_PRODUCTION')).toBe(false);
  });
});
