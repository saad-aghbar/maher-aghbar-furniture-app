import {
  classifyScheduleRisk,
  compareAtRiskPriority,
  isInternalScheduleReason,
  isMayBeLateStatus,
  isProjectedLate,
  isTerminalProductionStatus,
  publicScheduleReason,
} from '../at-risk';

const friday = new Date('2026-08-14T12:00:00.000Z');
const saturday = new Date('2026-08-15T12:00:00.000Z');
const sunday = new Date('2026-08-16T12:00:00.000Z');

describe('classifyScheduleRisk', () => {
  it('returns exactly one primary status and never mixes chips', () => {
    const cases = [
      classifyScheduleRisk({
        productionOrderStatus: 'IN_PROGRESS',
        scheduleStatus: 'PROPOSED',
        projectedCompletion: saturday,
        requestedDateFeasible: false,
        requestedDeliveryDate: friday,
        now: friday,
      }),
      classifyScheduleRisk({
        productionOrderStatus: 'IN_PROGRESS',
        scheduleStatus: 'APPROVED',
        committedDeliveryDate: friday,
        projectedCompletion: saturday,
        now: friday,
      }),
      classifyScheduleRisk({
        productionOrderStatus: 'IN_PROGRESS',
        scheduleStatus: 'APPROVED',
        committedDeliveryDate: friday,
        projectedCompletion: sunday,
        now: saturday,
      }),
      classifyScheduleRisk({
        productionOrderStatus: 'IN_PROGRESS',
        scheduleStatus: 'NEEDS_REVIEW',
        unschedulableReason: 'WIP_NOT_READY',
        requiresAdminEstimateReview: true,
        now: friday,
      }),
      classifyScheduleRisk({
        productionOrderStatus: 'IN_PROGRESS',
        scheduleStatus: 'APPROVED',
        committedDeliveryDate: sunday,
        projectedCompletion: saturday,
        now: friday,
      }),
    ];
    const primaries = cases.map((c) => c.primaryStatus);
    expect(primaries).toEqual([
      'AWAITING_APPROVAL',
      'AT_RISK',
      'LATE',
      'BLOCKED',
      'ON_TRACK',
    ]);
    for (const row of cases) {
      const flags = [
        row.contributesToMayBeLate,
        row.contributesToAwaitingApproval,
      ].filter(Boolean);
      expect(flags.length).toBeLessThanOrEqual(1);
      expect(isMayBeLateStatus(row.primaryStatus)).toBe(row.contributesToMayBeLate);
    }
  });

  it('excludes CANCELLED and COMPLETED from dashboard counts', () => {
    for (const status of ['CANCELLED', 'COMPLETED'] as const) {
      const row = classifyScheduleRisk({
        productionOrderStatus: status,
        scheduleStatus: 'NEEDS_REVIEW',
        unschedulableReason: 'WIP_NOT_READY',
        requiresAdminEstimateReview: true,
      });
      expect(isTerminalProductionStatus(status)).toBe(true);
      expect(row.contributesToMayBeLate).toBe(false);
      expect(row.contributesToAwaitingApproval).toBe(false);
      expect(row.contributesToDashboard).toBe(false);
    }
  });

  it('does not put requested-infeasible uncommitted plans in May be late', () => {
    const row = classifyScheduleRisk({
      productionOrderStatus: 'IN_PROGRESS',
      scheduleStatus: 'PROPOSED',
      requestedDeliveryDate: friday,
      projectedCompletion: sunday,
      requestedDateFeasible: false,
      requiresAdminEstimateReview: true,
      now: friday,
    });
    expect(row.primaryStatus).toBe('AWAITING_APPROVAL');
    expect(row.contributesToMayBeLate).toBe(false);
    expect(row.reasonCodes).toContain('DURATION_ESTIMATE_REVIEW');
    expect(row.recommendedAction).toBe('REVIEW_ESTIMATES');
  });

  it('marks NEEDS_REVIEW + WIP as BLOCKED and recoverable', () => {
    const row = classifyScheduleRisk({
      productionOrderStatus: 'READY_FOR_DELIVERY',
      scheduleStatus: 'NEEDS_REVIEW',
      unschedulableReason: 'WIP_NOT_READY',
      requiresAdminEstimateReview: true,
    });
    expect(row.primaryStatus).toBe('BLOCKED');
    expect(row.reasonCode).toBe('WIP_NOT_READY');
    expect(row.recoverableAutomatically).toBe(true);
    expect(row.recommendedAction).toBe('VIEW_PRODUCTION');
    expect(row.contributesToMayBeLate).toBe(true);
  });

  it('does not auto-resolve missing estimates without a plan', () => {
    const row = classifyScheduleRisk({
      productionOrderStatus: 'PLANNED',
      scheduleStatus: 'NEEDS_REVIEW',
      requiresAdminEstimateReview: true,
    });
    expect(row.primaryStatus).toBe('BLOCKED');
    expect(row.recoverableAutomatically).toBe(false);
    expect(row.recommendedAction).toBe('REVIEW_ESTIMATES');
  });

  it('keeps no-worker blocked and not auto-recoverable', () => {
    const row = classifyScheduleRisk({
      productionOrderStatus: 'PLANNED',
      scheduleStatus: 'NEEDS_REVIEW',
      unschedulableReason: 'NO_ELIGIBLE_WORKER',
    });
    expect(row.reasonCode).toBe('NO_ELIGIBLE_WORKER');
    expect(row.recoverableAutomatically).toBe(false);
    expect(row.recommendedAction).toBe('MANAGE_WORKERS');
  });

  it('uses LATE when the committed calendar day has already passed', () => {
    const row = classifyScheduleRisk({
      productionOrderStatus: 'IN_PROGRESS',
      scheduleStatus: 'APPROVED',
      committedDeliveryDate: friday,
      projectedCompletion: sunday,
      now: saturday,
    });
    expect(row.primaryStatus).toBe('LATE');
    expect(row.recoverableAutomatically).toBe(false);
    expect(row.recommendedAction).toBe('REVIEW_COMMITMENT');
  });

  it('ignores superseded-only flags: classifier sees the latest active row only', () => {
    const latest = classifyScheduleRisk({
      productionOrderStatus: 'IN_PROGRESS',
      scheduleStatus: 'APPROVED',
      committedDeliveryDate: sunday,
      projectedCompletion: saturday,
      now: friday,
    });
    expect(latest.primaryStatus).toBe('ON_TRACK');
    expect(latest.contributesToMayBeLate).toBe(false);
  });
});

describe('isProjectedLate / priority', () => {
  it('compares completion to committed then requested', () => {
    expect(isProjectedLate(saturday, friday, null)).toBe(true);
    expect(isProjectedLate(friday, saturday, null)).toBe(false);
    expect(isProjectedLate(saturday, sunday, friday)).toBe(true);
  });

  it('sorts urgent before normal then by number', () => {
    const rows = [
      { productionOrderId: 'b', number: 'PO-2', priority: 'NORMAL' as const },
      { productionOrderId: 'a', number: 'PO-1', priority: 'URGENT' as const },
    ];
    expect([...rows].sort(compareAtRiskPriority).map((r) => r.number)).toEqual(['PO-1', 'PO-2']);
  });

  it('strips internal demo/debug reason strings from public copy', () => {
    expect(isInternalScheduleReason('demo:cedar-italian-velvet')).toBe(true);
    expect(publicScheduleReason('demo:jabal-dining-late')).toBeNull();
    expect(publicScheduleReason('WIP_NOT_READY')).toBe('WIP_NOT_READY');
    expect(publicScheduleReason(null)).toBeNull();
  });
});
