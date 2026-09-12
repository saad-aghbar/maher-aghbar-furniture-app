import { shouldCreateDefaultVariant } from './backfill-default-variants';

describe('backfillDefaultVariants idempotency', () => {
  it('creates when the product has no default variant', () => {
    expect(shouldCreateDefaultVariant([], 'SOF-3S')).toBe(true);
  });

  it('skips when a default variant already exists', () => {
    expect(
      shouldCreateDefaultVariant([{ isDefault: true, sku: 'SOF-3S-STD' }], 'SOF-3S'),
    ).toBe(false);
  });

  it('skips when the STD sku already exists even if isDefault is false', () => {
    expect(
      shouldCreateDefaultVariant([{ isDefault: false, sku: 'SOF-3S-STD' }], 'SOF-3S'),
    ).toBe(false);
  });
});
