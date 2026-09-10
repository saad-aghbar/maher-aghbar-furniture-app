import {
  isScheduleExecutionStarted,
  selectScheduleApprovalActions,
} from './schedule-approval';

describe('isScheduleExecutionStarted', () => {
  it('is false for a planned order with no started tasks', () => {
    expect(
      isScheduleExecutionStarted({
        orderStatus: 'PLANNED',
        releasedToFactoryAt: null,
        actualStartDate: null,
        taskStatuses: ['NOT_STARTED', 'READY'],
      }),
    ).toBe(false);
  });

  it('is false when released but nobody has started a stage', () => {
    expect(
      isScheduleExecutionStarted({
        orderStatus: 'READY',
        releasedToFactoryAt: '2026-09-01T08:00:00.000Z',
        actualStartDate: null,
        taskStatuses: ['NOT_STARTED'],
      }),
    ).toBe(false);
  });

  it('is true once the order is on the floor', () => {
    expect(
      isScheduleExecutionStarted({
        orderStatus: 'IN_PROGRESS',
        releasedToFactoryAt: '2026-09-01T08:00:00.000Z',
        actualStartDate: '2026-09-02T08:00:00.000Z',
        taskStatuses: ['IN_PROGRESS'],
      }),
    ).toBe(true);
  });

  it('is true when any task has started even if the order status is still READY', () => {
    expect(
      isScheduleExecutionStarted({
        orderStatus: 'READY',
        releasedToFactoryAt: '2026-09-01T08:00:00.000Z',
        actualStartDate: null,
        taskStatuses: ['NOT_STARTED', 'PAUSED'],
      }),
    ).toBe(true);
  });
});

describe('selectScheduleApprovalActions', () => {
  it('allows approve only on proposed / needs-review before work starts', () => {
    expect(selectScheduleApprovalActions({ scheduleStatus: 'PROPOSED', executionStarted: false })).toEqual({
      canApprove: true,
      canUnapprove: false,
    });
    expect(selectScheduleApprovalActions({ scheduleStatus: 'NEEDS_REVIEW', executionStarted: false })).toEqual({
      canApprove: true,
      canUnapprove: false,
    });
    expect(selectScheduleApprovalActions({ scheduleStatus: 'APPROVED', executionStarted: false })).toEqual({
      canApprove: false,
      canUnapprove: true,
    });
  });

  it('locks both actions once production has started', () => {
    expect(selectScheduleApprovalActions({ scheduleStatus: 'APPROVED', executionStarted: true })).toEqual({
      canApprove: false,
      canUnapprove: false,
    });
    expect(selectScheduleApprovalActions({ scheduleStatus: 'PROPOSED', executionStarted: true })).toEqual({
      canApprove: false,
      canUnapprove: false,
    });
  });
});
