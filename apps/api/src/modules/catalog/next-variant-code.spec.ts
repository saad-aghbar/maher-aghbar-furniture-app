import { nextVariantCode } from './next-variant-code';

describe('nextVariantCode', () => {
  it('starts at V2 when only STD exists', () => {
    expect(nextVariantCode(['STD'])).toBe('V2');
  });

  it('fills the first gap', () => {
    expect(nextVariantCode(['STD', 'V2', 'V4'])).toBe('V3');
  });
});
