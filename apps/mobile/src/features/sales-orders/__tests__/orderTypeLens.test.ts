import { keepPreviousListDataIfSameScope } from '@/api/keepPreviousListScope';
import { queryKeys } from '@/api/queryKeys';
import { nextOrderTypeFocus } from '../components/OrderTypeLensBar';

describe('admin orders type lens query keys', () => {
  it('includes search, orderType, and journeyBucket in the sales-order list key', () => {
    const filters = {
      q: 'Milano',
      orderType: 'MODIFIED' as const,
      journeyBucket: 'preparing' as const,
      sortBy: 'createdAt' as const,
    };
    expect(queryKeys.salesOrders.list(filters)).toEqual([
      'sales-orders',
      'list',
      filters,
    ]);
    expect(queryKeys.salesOrders.list({ orderType: 'STANDARD' })).not.toEqual(
      queryKeys.salesOrders.list({ orderType: 'MODIFIED' }),
    );
  });

  it('includes search, requestType, and statusGroup in the requests list key', () => {
    const filters = {
      q: 'sofa',
      requestType: 'CUSTOM' as const,
      statusGroup: 'needs_information',
    };
    expect(queryKeys.requests.list(filters)).toEqual(['requests', 'list', filters]);
    expect(
      queryKeys.requests.list({ requestType: 'STANDARD', statusGroup: 'open_inbox' }),
    ).not.toEqual(
      queryKeys.requests.list({ requestType: 'MODIFIED', statusGroup: 'open_inbox' }),
    );
  });
});

describe('keepPreviousListDataIfSameScope', () => {
  const previous = { pages: [{ data: [{ id: 'standard-1' }] }] };

  it('keeps previous pages when only search changes', () => {
    expect(
      keepPreviousListDataIfSameScope(
        previous,
        { queryKey: ['sales-orders', 'list', { orderType: 'MODIFIED', q: 'a' }] },
        { orderType: 'MODIFIED', journeyBucket: null },
        ['orderType', 'journeyBucket'],
      ),
    ).toBe(previous);
  });

  it('drops previous pages when switching Standard → Modified', () => {
    expect(
      keepPreviousListDataIfSameScope(
        previous,
        { queryKey: ['sales-orders', 'list', { orderType: 'STANDARD' }] },
        { orderType: 'MODIFIED', journeyBucket: null },
        ['orderType', 'journeyBucket'],
      ),
    ).toBeUndefined();
  });

  it('drops previous pages when inbox statusGroup changes', () => {
    expect(
      keepPreviousListDataIfSameScope(
        previous,
        { queryKey: ['requests', 'list', { statusGroup: 'open_inbox' }] },
        { requestType: null, statusGroup: 'needs_information' },
        ['requestType', 'statusGroup'],
      ),
    ).toBeUndefined();
  });
});

describe('OrderTypeLensBar selection', () => {
  it('highlights the tapped type and tapping again clears to all', () => {
    expect(nextOrderTypeFocus('all', 'modified')).toBe('modified');
    expect(nextOrderTypeFocus('modified', 'modified')).toBe('all');
    expect(nextOrderTypeFocus('modified', 'custom')).toBe('custom');
  });
});
