import { applyCreditLocalPreview, shouldSeedInvoiceSheet } from '../invoiceSheetSeed';

describe('shouldSeedInvoiceSheet', () => {
  it('seeds only when the sheet flips open', () => {
    expect(shouldSeedInvoiceSheet(true, false)).toBe(true);
    expect(shouldSeedInvoiceSheet(true, true)).toBe(false);
    expect(shouldSeedInvoiceSheet(false, true)).toBe(false);
  });
});

describe('applyCreditLocalPreview', () => {
  it('follows the typed amount under the cap', () => {
    expect(applyCreditLocalPreview(80, 120, 200)).toEqual({
      applyAmount: 80,
      invoiceRemainingAfter: 40,
      creditRemainingAfter: 120,
    });
  });

  it('does not walk past remaining or available credit', () => {
    expect(applyCreditLocalPreview(150, 120, 90).applyAmount).toBe(90);
    expect(applyCreditLocalPreview(150, 120, 90).invoiceRemainingAfter).toBe(30);
  });
});
