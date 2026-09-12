import { costOrdersWhere, costReturnsWhere, parseSalesOrderStatus } from './cost-query';

describe('cost-query', () => {
  it('treats missing filters as unconstrained', () => {
    expect(costOrdersWhere({})).toEqual({ archivedAt: null });
    expect(costReturnsWhere({})).toEqual({});
  });

  it('parses known sales-order statuses only', () => {
    expect(parseSalesOrderStatus('COMPLETED')).toBe('COMPLETED');
    expect(parseSalesOrderStatus('nope')).toBeUndefined();
  });
});
