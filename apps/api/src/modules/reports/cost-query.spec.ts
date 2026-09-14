import { SalesOrderStatus } from '@maher/database';
import { costOrdersWhere, costReturnsWhere, parseDateBasis, parseSalesOrderStatus } from './cost-query';

function andParts(where: { AND?: unknown[] }) {
  return where.AND ?? [];
}

describe('cost-query', () => {
  it('treats missing filters as unconstrained aside from archivedAt', () => {
    const where = costOrdersWhere({});
    expect(andParts(where)).toEqual(expect.arrayContaining([{ archivedAt: null }]));
    expect(costReturnsWhere({})).toEqual({});
  });

  it('parses known sales-order statuses only', () => {
    expect(parseSalesOrderStatus('COMPLETED')).toBe('COMPLETED');
    expect(parseSalesOrderStatus('nope')).toBeUndefined();
  });

  it('defaults date basis to delivered', () => {
    expect(parseDateBasis(undefined)).toBe('delivered');
    expect(parseDateBasis('orderDate')).toBe('orderDate');
  });

  it('uses orderDate only when that basis is requested', () => {
    const where = costOrdersWhere({
      productId: 'prod-1',
      status: 'IN_PRODUCTION',
      customerId: 'cust-1',
      from: '2026-01-01',
      to: '2026-01-31',
      dateBasis: 'orderDate',
    });
    expect(andParts(where)).toEqual(
      expect.arrayContaining([
        { customerId: 'cust-1' },
        { status: SalesOrderStatus.IN_PRODUCTION },
        { lines: { some: { productId: 'prod-1' } } },
        {
          orderDate: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        },
      ]),
    );
  });

  it('filters delivered orders by actualDeliveredAt', () => {
    const where = costOrdersWhere({
      from: '2026-09-01',
      to: '2026-09-14',
      dateBasis: 'delivered',
    });
    expect(andParts(where)).toEqual(
      expect.arrayContaining([
        {
          deliveries: {
            some: {
              purpose: 'OUTBOUND_ORDER',
              actualDeliveredAt: expect.objectContaining({
                gte: expect.any(Date),
                lte: expect.any(Date),
              }),
            },
          },
        },
      ]),
    );
  });

  it('filters factory activity by transaction and timer dates', () => {
    const where = costOrdersWhere({
      from: '2026-09-01',
      to: '2026-09-14',
      dateBasis: 'activity',
    });
    expect(JSON.stringify(where)).toContain('inventoryTransactions');
    expect(JSON.stringify(where)).toContain('timeEntries');
  });

  it('narrows orders by variantId, option, complexity, search and return flag', () => {
    const where = costOrdersWhere({
      productId: 'prod-1',
      variantId: 'var-1',
      optionValueId: 'opt-1',
      complexity: 'CUSTOM',
      q: 'SO-2026',
      hasReturn: true,
    });
    expect(JSON.stringify(where)).toContain('SO-2026');
    expect(JSON.stringify(where)).toContain('CUSTOM');
    expect(JSON.stringify(where)).toContain('returns');
  });

  it('ignores unknown status instead of throwing', () => {
    expect(JSON.stringify(costOrdersWhere({ status: 'NOPE' }))).not.toContain('NOPE');
  });

  it('narrows returns by productId and lifecycle status', () => {
    const where = costReturnsWhere({ productId: 'prod-1', status: 'REQUESTED' });
    expect(where.OR).toEqual([
      { productId: 'prod-1' },
      { salesOrderLine: { productId: 'prod-1' } },
    ]);
    expect(where.lifecycleState).toBe('REQUESTED');
  });
});
