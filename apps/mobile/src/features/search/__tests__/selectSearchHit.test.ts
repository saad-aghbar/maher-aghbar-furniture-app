import { parseInvoiceSearchSubtitle } from '../selectSearchHit';

describe('parseInvoiceSearchSubtitle', () => {
  it('reads API middle-dot status and decimal total', () => {
    expect(parseInvoiceSearchSubtitle('PARTIALLY_PAID · 196.272')).toEqual({
      status: 'PARTIALLY_PAID',
      amount: 196.272,
    });
    expect(parseInvoiceSearchSubtitle('ISSUED · 354.96')).toEqual({
      status: 'ISSUED',
      amount: 354.96,
    });
    expect(parseInvoiceSearchSubtitle('PAID · 850.512')).toEqual({
      status: 'PAID',
      amount: 850.512,
    });
  });

  it('accepts a bullet separator', () => {
    expect(parseInvoiceSearchSubtitle('ISSUED • 323.64')).toEqual({
      status: 'ISSUED',
      amount: 323.64,
    });
  });

  it('returns null for missing or non-invoice meta', () => {
    expect(parseInvoiceSearchSubtitle(null)).toBeNull();
    expect(parseInvoiceSearchSubtitle('')).toBeNull();
    expect(parseInvoiceSearchSubtitle('INV-2026-00011')).toBeNull();
    expect(parseInvoiceSearchSubtitle('DRAFT · not-a-number')).toBeNull();
  });
});
