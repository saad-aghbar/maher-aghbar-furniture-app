import { normalizeInvoiceTaxRate, taxAmountOnNet } from './invoice-tax-rate';

describe('normalizeInvoiceTaxRate', () => {
  it('keeps a stored fraction', () => {
    expect(normalizeInvoiceTaxRate(0.16)).toBe(0.16);
  });

  it('converts a percent so Decimal(5,4) can store it', () => {
    expect(normalizeInvoiceTaxRate(16)).toBe(0.16);
  });

  it('treats empty values as zero', () => {
    expect(normalizeInvoiceTaxRate(null)).toBe(0);
    expect(normalizeInvoiceTaxRate(undefined)).toBe(0);
  });
});

describe('taxAmountOnNet', () => {
  it('applies a fraction to the net', () => {
    expect(taxAmountOnNet(100, 0.16)).toBeCloseTo(16, 5);
  });

  it('applies a percent the same way', () => {
    expect(taxAmountOnNet(100, 16)).toBeCloseTo(16, 5);
  });
});
