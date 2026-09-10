import { invoiceKindWhere } from './invoice-list-kind';

describe('invoiceKindWhere', () => {
  it('leaves the list unfiltered when kind is omitted', () => {
    expect(invoiceKindWhere()).toEqual({});
    expect(invoiceKindWhere(undefined)).toEqual({});
  });

  it('selects sales-order invoices by a null return link', () => {
    expect(invoiceKindWhere('ORDER')).toEqual({ returnRequestId: null });
  });

  it('selects return invoices by a present return link', () => {
    expect(invoiceKindWhere('RETURN')).toEqual({ returnRequestId: { not: null } });
  });
});
