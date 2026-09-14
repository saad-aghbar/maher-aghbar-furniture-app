import {
  COST_ORDER_STATUS_OPTIONS,
  COST_RETURN_STATUS_OPTIONS,
  EMPTY_COST_FILTER,
  costFilterActiveCount,
  costComplexityLabelKey,
  costStatusLabelKey,
} from '../costFilters';

describe('costFilters', () => {
  it('counts sort when it is not the desk default', () => {
    expect(costFilterActiveCount(EMPTY_COST_FILTER)).toBe(0);
    expect(costFilterActiveCount({ ...EMPTY_COST_FILTER, sort: 'lowestMargin' })).toBe(1);
    expect(costFilterActiveCount({ ...EMPTY_COST_FILTER, customerId: 'd1', sort: 'highestCost' })).toBe(
      2,
    );
  });

  it('keeps return statuses on the return lifecycle, not sales-order statuses', () => {
    expect(COST_ORDER_STATUS_OPTIONS).toContain('IN_PRODUCTION');
    expect(COST_RETURN_STATUS_OPTIONS).not.toContain('IN_PRODUCTION');
    expect(COST_RETURN_STATUS_OPTIONS).toContain('REQUESTED');
    expect(COST_RETURN_STATUS_OPTIONS).toContain('RETURNED_TO_STOCK');
    expect(costStatusLabelKey('returns', 'REQUESTED')).toBe('mobile.reports.returnStatus.REQUESTED');
    expect(costStatusLabelKey('orders', 'IN_PRODUCTION')).toBe('mobile.reports.status.IN_PRODUCTION');
    expect(costComplexityLabelKey('MODIFIED')).toBe('mobile.reports.complexity.MODIFIED');
  });
});
