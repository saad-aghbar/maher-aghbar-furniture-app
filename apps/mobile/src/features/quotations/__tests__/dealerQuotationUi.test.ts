import { dealerCanDecideQuotation } from '../dealerQuotationUi';

describe('dealerCanDecideQuotation', () => {
  it('allows decisions only on SENT', () => {
    expect(dealerCanDecideQuotation('SENT')).toBe(true);
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
