import { translate } from '../translate';

const KIND_KEYS = [
  'mobile.orders.journey.kind.standard',
  'mobile.orders.journey.kind.modified',
  'mobile.orders.journey.kind.custom',
  'mobile.orders.journey.kind.basedOnCatalog',
] as const;

describe('order type lens i18n', () => {
  it.each(KIND_KEYS)('resolves %s in EN, AR, and HE without raw enums', (key) => {
    for (const locale of ['en', 'ar', 'he'] as const) {
      const value = translate(locale, key);
      expect(value).not.toBe(key);
      expect(value).not.toMatch(/STANDARD|MODIFIED|CUSTOM/);
      expect(value.toLowerCase()).not.toMatch(/customized|normal|special/);
    }
  });

  it('uses one Standard / Modified / Custom family', () => {
    expect(translate('en', 'mobile.orders.journey.kind.standard')).toBe('Standard');
    expect(translate('en', 'mobile.orders.journey.kind.modified')).toBe('Modified');
    expect(translate('en', 'mobile.orders.journey.kind.custom')).toBe('Custom');
    expect(translate('ar', 'mobile.orders.journey.kind.standard')).toBe('قياسي');
    expect(translate('ar', 'mobile.orders.journey.kind.modified')).toBe('معدّل');
    expect(translate('ar', 'mobile.orders.journey.kind.custom')).toBe('مخصص');
    expect(translate('he', 'mobile.orders.journey.kind.standard')).toBe('סטנדרטי');
    expect(translate('he', 'mobile.orders.journey.kind.modified')).toBe('מותאם');
    expect(translate('he', 'mobile.orders.journey.kind.custom')).toBe('מותאם אישית');
  });
});
