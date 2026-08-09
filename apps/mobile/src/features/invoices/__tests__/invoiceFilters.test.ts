import {
  filterDealersByQuery,
  invoiceFilterActiveCount,
  isInvoiceStatusFilterActive,
} from '../invoiceFilters';

describe('filterDealersByQuery', () => {
  const dealers = [
    { id: '1', name: 'Dead Sea Spa', searchText: 'Dead Sea Spa منتجع البحر الميت' },
    { id: '2', name: 'Wadi Rum Lodge', searchText: 'Wadi Rum Lodge وادي رم' },
    { id: '3', name: 'Amman Traders', searchText: 'Amman Traders تجار عمان' },
  ];

  it('returns all dealers when query is empty', () => {
    expect(filterDealersByQuery(dealers, '  ')).toHaveLength(3);
  });

  it('matches English name fragments', () => {
    expect(filterDealersByQuery(dealers, 'wadi').map((d) => d.id)).toEqual(['2']);
  });

  it('matches Arabic search text', () => {
    expect(filterDealersByQuery(dealers, 'عمان').map((d) => d.id)).toEqual(['3']);
  });

  it('is case-insensitive', () => {
    expect(filterDealersByQuery(dealers, 'DEAD').map((d) => d.id)).toEqual(['1']);
  });
});

describe('invoice status filter helpers', () => {
  it('treats ALL as inactive', () => {
    expect(isInvoiceStatusFilterActive('ALL')).toBe(false);
    expect(isInvoiceStatusFilterActive('OVERDUE')).toBe(true);
  });

  it('counts status and dealer filters', () => {
    expect(invoiceFilterActiveCount('ALL', null)).toBe(0);
    expect(invoiceFilterActiveCount('PAID', null)).toBe(1);
    expect(invoiceFilterActiveCount('ALL', 'c1')).toBe(1);
    expect(invoiceFilterActiveCount('ISSUED', 'c1')).toBe(2);
  });
});
