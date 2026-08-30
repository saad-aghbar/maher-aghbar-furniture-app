import { digitsOnly, formatPhoneForDisplay } from '../countryDialCodes';

describe('formatPhoneForDisplay', () => {
  it('spaces the Jabal Contract Jordan mobile without changing digits', () => {
    expect(formatPhoneForDisplay('+962790210010')).toBe('+962 790 210 010');
    expect(digitsOnly(formatPhoneForDisplay('+962790210010'))).toBe('962790210010');
  });

  it('is stable when the number is already spaced', () => {
    expect(formatPhoneForDisplay('+962 790 210 010')).toBe('+962 790 210 010');
  });

  it('passes through empty placeholders', () => {
    expect(formatPhoneForDisplay('')).toBe('');
    expect(formatPhoneForDisplay('   ')).toBe('');
    expect(formatPhoneForDisplay('—')).toBe('—');
  });
});
