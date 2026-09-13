import { translate } from '../translate';

const KEYS = [
  'mobile.adminRequest.lineDeskTitle',
  'mobile.adminRequest.saveCorrections',
  'mobile.adminRequest.fabrics',
  'mobile.adminRequest.dealerNotes',
  'mobile.adminRequest.endCustomerPhone',
  'mobile.adminQuotation.editLine',
  'mobile.adminScheduling.salesOrderGroup',
] as const;

describe('factory review i18n', () => {
  it.each(KEYS)('resolves %s in EN, AR, and HE', (key) => {
    for (const locale of ['en', 'ar', 'he'] as const) {
      const value = translate(locale, key);
      expect(value).not.toBe(key);
    }
  });

  it('keeps sentence-case desk labels', () => {
    expect(translate('en', 'mobile.adminRequest.lineDeskTitle')).toBe('Line desk');
    expect(translate('en', 'mobile.adminRequest.saveCorrections')).toBe('Save corrections');
    expect(translate('en', 'mobile.adminQuotation.editLine')).toBe('Edit line');
    expect(translate('en', 'mobile.adminScheduling.salesOrderGroup')).toBe('Sales order');
  });
});
