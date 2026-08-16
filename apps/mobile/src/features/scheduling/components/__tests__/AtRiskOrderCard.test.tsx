import { atRiskActionIcon, atRiskIcon, atRiskTone } from '../AtRiskOrderCard';

describe('at-risk card presentation', () => {
  it('maps status to distinct tone and icon', () => {
    expect(atRiskTone('LATE')).toBe('late');
    expect(atRiskTone('BLOCKED')).toBe('blocked');
    expect(atRiskTone('AT_RISK')).toBe('risk');
    expect(atRiskIcon('LATE')).toBe('time-outline');
    expect(atRiskIcon('BLOCKED')).toBe('ban-outline');
    expect(atRiskIcon('AT_RISK')).toBe('warning-outline');
  });

  it('maps recommended actions to icons', () => {
    expect(atRiskActionIcon('RECALCULATE')).toBe('refresh-outline');
    expect(atRiskActionIcon('VIEW_PRODUCTION')).toBe('layers-outline');
    expect(atRiskActionIcon('REVIEW_COMMITMENT')).toBe('calendar-outline');
  });
});
