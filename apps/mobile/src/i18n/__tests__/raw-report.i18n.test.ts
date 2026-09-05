import { translate } from '../translate';

const KEYS = [
  'mobile.inventory.rawReport.rowTitle',
  'mobile.inventory.rawReport.rowHint',
  'mobile.inventory.rawReport.sheetTitle',
  'mobile.inventory.rawReport.sheetHint',
  'mobile.inventory.rawReport.today',
  'mobile.inventory.rawReport.week',
  'mobile.inventory.rawReport.month',
  'mobile.inventory.rawReport.custom',
  'mobile.inventory.rawReport.from',
  'mobile.inventory.rawReport.to',
  'mobile.inventory.rawReport.generate',
  'mobile.inventory.rawReport.preparing',
  'mobile.inventory.rawReport.retry',
  'mobile.inventory.rawReport.failed',
  'mobile.inventory.rawReport.rangeInvalid',
  'mobile.inventory.rawReport.rangeRequired',
] as const;

describe('raw materials report i18n', () => {
  it.each(KEYS)('resolves %s in EN, AR, and HE', (key) => {
    for (const locale of ['en', 'ar', 'he'] as const) {
      const value = translate(locale, key);
      expect(value).not.toBe(key);
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });
});
