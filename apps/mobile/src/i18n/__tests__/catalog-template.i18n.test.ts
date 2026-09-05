import { translate } from '../translate';

const KEYS = [
  'mobile.productionSetup.catalogTemplate.standardProduct',
  'mobile.productionSetup.catalogTemplate.modifiedProduct',
  'mobile.productionSetup.catalogTemplate.customProduct',
  'mobile.productionSetup.catalogTemplate.planAvailable',
  'mobile.productionSetup.catalogTemplate.usePlan',
  'mobile.productionSetup.catalogTemplate.noSavedPlan',
  'mobile.productionSetup.catalogTemplate.basedOnFactoryCatalog',
  'mobile.productionSetup.catalogTemplate.basedOnProduct',
  'mobile.productionSetup.catalogTemplate.modifiedBaseline',
  'mobile.productionSetup.catalogTemplate.customManual',
  'mobile.productionSetup.catalogTemplate.modificationsTitle',
  'mobile.productionSetup.catalogTemplate.reviewModifications',
  'mobile.productionSetup.catalogTemplate.reviewRequired',
  'mobile.productionSetup.catalogTemplate.reviewed',
  'mobile.productionSetup.catalogTemplate.willLoad',
  'mobile.productionSetup.catalogTemplate.willNotChange',
  'mobile.productionSetup.catalogTemplate.applyPlan',
  'mobile.productionSetup.catalogTemplate.changeWorkflow',
  'mobile.productionSetup.catalogTemplate.assignmentsMayBeAffected',
  'mobile.productionSetup.needsReview',
  'mobile.orders.journey.kind.standard',
  'mobile.orders.journey.kind.modified',
  'mobile.orders.journey.kind.custom',
  'mobile.productionSetup.catalogTemplate.previewFailed',
  'errors.CUSTOM_NO_TEMPLATE',
  'errors.MATERIALS_REVIEW_REQUIRED',
  'errors.WORKFLOW_REQUIRED',
  'errors.SETUP_INCOMPLETE',
  'errors.SETUP_LOCKED',
  'errors.NETWORK_ERROR',
  'errors.TIMEOUT',
  'errors.NO_CATALOG_PRODUCT',
  'errors.NO_PUBLISHED_WORKFLOW',
] as const;

describe('Phase C catalog template i18n', () => {
  it.each(KEYS)('resolves %s in EN, AR, and HE without raw codes', (key) => {
    for (const locale of ['en', 'ar', 'he'] as const) {
      const value = translate(locale, key);
      expect(value).not.toBe(key);
      expect(value).not.toMatch(/STANDARD|SETUP_LOCKED|seedFromCatalog|WORKFLOW_CHANGE/);
    }
  });

  it('keeps Standard / Modified / Custom as the plan-header labels', () => {
    expect(translate('en', 'mobile.productionSetup.catalogTemplate.standardProduct')).toBe(
      'Standard product',
    );
    expect(translate('ar', 'mobile.productionSetup.catalogTemplate.standardProduct')).toBe(
      'منتج قياسي',
    );
    expect(translate('he', 'mobile.productionSetup.catalogTemplate.standardProduct')).toBe(
      'מוצר סטנדרטי',
    );
    expect(translate('en', 'mobile.productionSetup.catalogTemplate.modifiedProduct')).toBe(
      'Modified product',
    );
    expect(translate('ar', 'mobile.productionSetup.catalogTemplate.modifiedProduct')).toBe(
      'منتج معدّل',
    );
    expect(translate('he', 'mobile.productionSetup.catalogTemplate.modifiedProduct')).toBe(
      'מוצר מותאם',
    );
    expect(translate('en', 'mobile.productionSetup.catalogTemplate.customProduct')).toBe(
      'Custom product',
    );
    expect(translate('he', 'mobile.orders.journey.kind.standard')).toBe('סטנדרטי');
  });
});
