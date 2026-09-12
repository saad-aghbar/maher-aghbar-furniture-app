import { translate } from '../../i18n/translate';

const KEYS = [
  'catalog.variants',
  'catalog.variantsHint',
  'catalog.addVariant',
  'catalog.editVariant',
  'catalog.duplicateVariant',
  'catalog.deactivateVariant',
  'catalog.defaultVariant',
  'catalog.variantCode',
  'catalog.composition',
  'catalog.includedItems',
  'catalog.factoryNotes',
  'catalog.factoryNotesHint',
  'catalog.specLine',
  'catalog.noVariants',
  'catalog.variantSaved',
  'catalog.createVariant',
] as const;

describe('Product variant i18n keys', () => {
  for (const locale of ['en', 'ar', 'he'] as const) {
    it(`resolves variant keys in ${locale}`, () => {
      for (const key of KEYS) {
        const value = translate(locale, key);
        expect(value).not.toBe(key);
        expect(value.length).toBeGreaterThan(0);
      }
    });
  }
});
