import {
  DEALER_VISIBLE_QUOTATION_STATUSES,
  dealerCanDecideQuotation,
  isDealerVisibleQuotationStatus,
} from './quotation-visibility';

describe('quotation-visibility', () => {
  it('hides unsent internal statuses from dealers', () => {
    expect(isDealerVisibleQuotationStatus('DRAFT')).toBe(false);
    expect(isDealerVisibleQuotationStatus('INTERNAL_REVIEW')).toBe(false);
    expect(isDealerVisibleQuotationStatus('APPROVED')).toBe(false);
    expect(isDealerVisibleQuotationStatus('CANCELLED')).toBe(false);
  });

  it('allows published commercial statuses', () => {
    for (const status of DEALER_VISIBLE_QUOTATION_STATUSES) {
      expect(isDealerVisibleQuotationStatus(status)).toBe(true);
    }
  });

  it('allows dealer decisions only on SENT', () => {
    expect(dealerCanDecideQuotation('SENT')).toBe(true);
    expect(dealerCanDecideQuotation('APPROVED')).toBe(false);
    expect(dealerCanDecideQuotation('VIEWED')).toBe(false);
    expect(dealerCanDecideQuotation('ACCEPTED')).toBe(false);
  });
});
