import { translate } from '../../i18n/translate';

const KEYS = [
  'catalog.specOptionGroups',
  'catalog.specOptionValues',
  'catalog.noSpecOptionGroups',
  'catalog.noSpecOptionValues',
  'catalog.pickSpecOption',
  'catalog.pickSpecOptionHint',
  'catalog.searchSpecOptions',
  'catalog.noSpecOptionsMatch',
  'catalog.noSpecOption',
  'catalog.inputType',
  'catalog.appliesTo',
  'catalog.sortOrder',
  'catalog.numericValue',
  'catalog.inventoryItem',
  'catalog.colorReference',
  'catalog.inputTypeSelect',
  'catalog.inputTypeSelectWithQty',
  'catalog.inputTypeDimension',
  'catalog.inputTypeColor',
  'navigation.specOptionGroups',
  'navigation.specOptionValues',
] as const;

describe('Spec option library i18n keys', () => {
  for (const locale of ['en', 'ar', 'he'] as const) {
    it(`resolves spec-option keys in ${locale}`, () => {
      for (const key of KEYS) {
        const value = translate(locale, key);
        expect(value).not.toBe(key);
        expect(value.length).toBeGreaterThan(0);
      }
    });
  }
});
