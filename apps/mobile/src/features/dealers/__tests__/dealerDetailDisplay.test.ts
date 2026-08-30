import { dealerIdentitySubtitle, hasVisibleContact } from '../dealerDetailDisplay';

describe('dealerIdentitySubtitle', () => {
  it('drops the subtitle when company name matches the title', () => {
    expect(dealerIdentitySubtitle('Jabal Contract', 'Jabal Contract', 'Companies')).toBeNull();
  });

  it('keeps a distinct company name', () => {
    expect(dealerIdentitySubtitle('Jabal', 'Jabal Contract', 'Companies')).toBe('Jabal Contract');
  });

  it('falls back to type when there is no company name', () => {
    expect(dealerIdentitySubtitle('Jabal Contract', null, 'Companies')).toBe('Companies');
    expect(dealerIdentitySubtitle('Jabal Contract', '  ', 'Companies')).toBe('Companies');
  });
});

describe('hasVisibleContact', () => {
  it('hides empty and dash placeholders', () => {
    expect(hasVisibleContact(null)).toBe(false);
    expect(hasVisibleContact('')).toBe(false);
    expect(hasVisibleContact(' ')).toBe(false);
    expect(hasVisibleContact('-')).toBe(false);
    expect(hasVisibleContact('—')).toBe(false);
  });

  it('keeps a real fax or phone', () => {
    expect(hasVisibleContact('+962790210010')).toBe(true);
    expect(hasVisibleContact('06-555-0100')).toBe(true);
  });
});
