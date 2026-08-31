import {
  DEALER_VISIBLE_QUOTATION_STATUSES,
  dealerCanDecideQuotation,
  isDealerVisibleQuotationStatus,
  isQuotationCommerciallyExpired,
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

  it('allows dealer decisions on SENT and VIEWED when not expired', () => {
    expect(dealerCanDecideQuotation('SENT')).toBe(true);
    expect(dealerCanDecideQuotation('VIEWED')).toBe(true);
    expect(dealerCanDecideQuotation('APPROVED')).toBe(false);
    expect(dealerCanDecideQuotation('ACCEPTED')).toBe(false);
  });

  it('blocks dealer decisions after valid-until', () => {
    const yesterday = new Date('2020-01-01T00:00:00.000Z');
    expect(dealerCanDecideQuotation('SENT', yesterday)).toBe(false);
    expect(isQuotationCommerciallyExpired(yesterday, new Date('2020-01-02T00:00:00.000Z'))).toBe(
      true,
    );
    expect(isQuotationCommerciallyExpired('2020-01-01', new Date('2020-01-01T12:00:00.000Z'))).toBe(
      false,
    );
  });
});
