import { dealerCanDecideQuotation } from '../dealerQuotationUi';

describe('dealerCanDecideQuotation', () => {
  it('allows decisions on SENT and VIEWED', () => {
    expect(dealerCanDecideQuotation('SENT')).toBe(true);
    expect(dealerCanDecideQuotation('VIEWED')).toBe(true);
  });

  it('hides decisions when the quotation is commercially expired', () => {
    expect(dealerCanDecideQuotation('SENT', true)).toBe(false);
    expect(dealerCanDecideQuotation('VIEWED', true)).toBe(false);
  });

  it('hides decisions on internal and terminal statuses', () => {
    expect(dealerCanDecideQuotation('APPROVED')).toBe(false);
    expect(dealerCanDecideQuotation('DRAFT')).toBe(false);
    expect(dealerCanDecideQuotation('INTERNAL_REVIEW')).toBe(false);
    expect(dealerCanDecideQuotation('ACCEPTED')).toBe(false);
    expect(dealerCanDecideQuotation('REJECTED')).toBe(false);
    expect(dealerCanDecideQuotation('REVISION_REQUESTED')).toBe(false);
  });
});
