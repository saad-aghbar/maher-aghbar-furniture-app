import { translate } from '../translate';

const KEYS = [
  'mobile.newOrder.customize',
  'mobile.newOrder.modifyVariantHint',
  'mobile.newOrder.modifySpecsHint',
  'mobile.newOrder.modifyNoSpecsBody',
  'mobile.newOrder.modifyMeasurementsHint',
  'mobile.newOrder.modifyNotesHint',
  'mobile.newOrder.modifyNotesPlaceholder',
  'mobile.newOrder.ownSpec',
  'mobile.newOrder.ownSpecHint',
  'mobile.newOrder.ownSpecName',
  'mobile.newOrder.ownSpecNamePlaceholder',
  'mobile.newOrder.ownSpecValue',
  'mobile.newOrder.ownSpecValuePlaceholder',
  'mobile.newOrder.saveOwnSpec',
  'mobile.newOrder.editOwnSpec',
  'mobile.newOrder.pickLibrarySpecHint',
  'mobile.newOrder.noUnusedLibrarySpecs',
  'mobile.newOrder.addModifiedToBasket',
  'mobile.newOrder.saveModifiedToBasket',
] as const;

describe('dealer modify i18n', () => {
  it.each(KEYS)('resolves %s in EN, AR, and HE', (key) => {
    for (const locale of ['en', 'ar', 'he'] as const) {
      const value = translate(locale, key);
      expect(value).not.toBe(key);
    }
  });

  it('keeps the CTA in sentence case', () => {
    expect(translate('en', 'mobile.newOrder.addModifiedToBasket')).toBe(
      'Add modified to basket',
    );
    expect(translate('en', 'mobile.newOrder.editItem')).toBe('Edit item');
    expect(translate('en', 'mobile.newOrder.ownSpec')).toBe('Your spec');
  });
});
