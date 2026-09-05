import {
  filterSuppliersByQuery,
  isStatusFilterActive,
  statusFiltersForTab,
} from '../purchasingFilters';

describe('purchasingFilters', () => {
  const suppliers = [
    { id: '1', name: 'Marka Coatings', code: 'SUP-1', searchText: 'Marka Coatings ماركا' },
    { id: '2', name: 'Zarqa Timber', code: 'SUP-2', searchText: 'Zarqa Timber الزرقاء' },
  ];

  it('returns all when query empty', () => {
    expect(filterSuppliersByQuery(suppliers, '  ')).toHaveLength(2);
  });

  it('matches name and code', () => {
    expect(filterSuppliersByQuery(suppliers, 'zarqa').map((s) => s.id)).toEqual(['2']);
    expect(filterSuppliersByQuery(suppliers, 'sup-1').map((s) => s.id)).toEqual(['1']);
  });

  it('status filter helpers', () => {
    expect(isStatusFilterActive('ALL')).toBe(false);
    expect(isStatusFilterActive('SENT')).toBe(true);
    expect(statusFiltersForTab('orders')[0]).toBe('ALL');
    expect(statusFiltersForTab('requests')).toContain('SUBMITTED');
    expect(statusFiltersForTab('invoices')).toContain('PAID');
    expect(statusFiltersForTab('fabric')).toContain('NEEDS_ORDERING');
  });
});
