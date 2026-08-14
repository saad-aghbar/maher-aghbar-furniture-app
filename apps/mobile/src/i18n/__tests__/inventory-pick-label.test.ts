import { translate } from '../translate';

const PICKER_KEYS = [
  'mobile.inventory.pickItem',
  'mobile.inventory.pickSemiItem',
  'mobile.inventory.pickFinishedItem',
  'mobile.inventory.itemSemi',
  'mobile.inventory.itemFinished',
  'mobile.inventory.searchSemiPlaceholder',
  'mobile.inventory.searchFinishedPlaceholder',
  'mobile.inventory.emptySemiPickerBody',
  'mobile.inventory.emptyFinishedPickerBody',
  'mobile.inventory.pickWarehouseFirst',
  'mobile.inventory.pickFreeQty',
  'mobile.inventory.transferRequiredSemi',
  'mobile.inventory.transferRequiredFinished',
  'mobile.inventory.countRequiredSemi',
  'mobile.inventory.countRequiredFinished',
  'mobile.inventory.transferQtyExceeds',
] as const;

describe('inventory transfer/count picker i18n', () => {
  it('resolves picker titles in EN, AR, and HE without raw keys or enums', () => {
    expect(translate('en', 'mobile.inventory.pickItem')).toBe('Select material');
    expect(translate('en', 'mobile.inventory.pickSemiItem')).toBe('Select semi-finished item');
    expect(translate('en', 'mobile.inventory.pickFinishedItem')).toBe('Select finished product');
    expect(translate('ar', 'mobile.inventory.pickSemiItem')).toBe('اختر منتجاً نصف مصنّع');
    expect(translate('ar', 'mobile.inventory.pickFinishedItem')).toBe('اختر منتجاً جاهزاً');
    expect(translate('he', 'mobile.inventory.pickSemiItem')).toBe('בחירת פריט חצי מוגמר');
    expect(translate('he', 'mobile.inventory.pickFinishedItem')).toBe('בחירת מוצר מוגמר');
  });

  it.each(PICKER_KEYS)('does not leak %s as a raw key', (key) => {
    for (const locale of ['en', 'ar', 'he'] as const) {
      const value = translate(locale, key, { qty: 6, unit: 'pcs' });
      expect(value).not.toBe(key);
      expect(value).not.toMatch(/RAW_MATERIALS|SEMI_FINISHED|FINISHED_GOODS/);
    }
  });
});
