import {
  filterDealersByQuery,
  invoiceDeskEmptyKeys,
  invoiceDeskTabToKind,
  invoiceFilterActiveCount,
  isInvoiceStatusFilterActive,
  parseInvoiceDeskTab,
  partyFilterFallbackKey,
  partySegmentsForDesk,
  partySelectionAppliesToDesk,
  splitInvoiceCards,
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

describe('invoice desk tabs', () => {
  it('maps a desk tab to the API kind filter', () => {
    expect(invoiceDeskTabToKind('all')).toBeUndefined();
    expect(invoiceDeskTabToKind('orders')).toBe('ORDER');
    expect(invoiceDeskTabToKind('returns')).toBe('RETURN');
    expect(invoiceDeskTabToKind('purchasing')).toBeUndefined();
  });

  it('parses section deep-links', () => {
    expect(parseInvoiceDeskTab('returns')).toBe('returns');
    expect(parseInvoiceDeskTab('PURCHASING')).toBe('purchasing');
    expect(parseInvoiceDeskTab('nope')).toBeNull();
  });

  it('splits cards by return number', () => {
    const split = splitInvoiceCards([
      { id: '1', returnNumber: null },
      { id: '2', returnNumber: 'RET-1' },
    ]);
    expect(split.orders.map((c) => c.id)).toEqual(['1']);
    expect(split.returns.map((c) => c.id)).toEqual(['2']);
  });
});

describe('invoice party segments', () => {
  it('locks segments to the active desk', () => {
    expect(partySegmentsForDesk('all')).toEqual(['dealers', 'suppliers']);
    expect(partySegmentsForDesk('orders')).toEqual(['dealers']);
    expect(partySegmentsForDesk('returns')).toEqual(['dealers']);
    expect(partySegmentsForDesk('purchasing')).toEqual(['suppliers']);
  });

  it('changes the closed-button label with the desk', () => {
    expect(partyFilterFallbackKey('all')).toBe('mobile.invoices.partyFilter');
    expect(partyFilterFallbackKey('orders')).toBe('mobile.invoices.partyDealers');
    expect(partyFilterFallbackKey('returns')).toBe('mobile.invoices.partyDealers');
    expect(partyFilterFallbackKey('purchasing')).toBe('mobile.invoices.partySuppliers');
  });

  it('clears a selection that no longer applies', () => {
    expect(
      partySelectionAppliesToDesk({ kind: 'suppliers', id: 's1', name: 'Wood' }, 'orders'),
    ).toBe(false);
    expect(
      partySelectionAppliesToDesk({ kind: 'dealers', id: 'd1', name: 'Balqis' }, 'purchasing'),
    ).toBe(false);
    expect(
      partySelectionAppliesToDesk({ kind: 'dealers', id: 'd1', name: 'Balqis' }, 'all'),
    ).toBe(true);
  });
});

describe('per-tab empty copy', () => {
  it('explains when each invoice kind is created', () => {
    expect(invoiceDeskEmptyKeys('orders')).toEqual({
      title: 'mobile.invoices.emptyOrdersTitle',
      body: 'mobile.invoices.emptyOrdersBody',
    });
    expect(invoiceDeskEmptyKeys('returns').body).toBe('mobile.invoices.emptyReturnsBody');
    expect(invoiceDeskEmptyKeys('purchasing', 'RAW').title).toBe(
      'mobile.invoices.emptyPurchasingRawTitle',
    );
    expect(invoiceDeskEmptyKeys('all').title).toBe('mobile.invoices.emptyTitle');
  });
});
