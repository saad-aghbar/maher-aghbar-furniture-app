import { translate } from '../translate';

const KEYS = [
  'mobile.productionSetup.pickWorkflow',
  'mobile.productionSetup.searchWorkflows',
  'mobile.productionSetup.workflowListTitle',
  'mobile.productionSetup.versionLabel',
  'mobile.productionSetup.stageCount',
  'mobile.productionSetup.noWorkflows',
  'mobile.production.workflow.scopeAll',
  'mobile.production.workflow.scopeStandard',
  'mobile.production.workflow.scopeReturn',
  'mobile.production.workflow.scopeHint',
  'mobile.production.workflow.scopeSection',
  'mobile.production.workflow.searchWorkflows',
] as const;

describe('workflow picker i18n', () => {
  it.each(KEYS)('resolves %s in EN, AR, and HE without shouty codes', (key) => {
    for (const locale of ['en', 'ar', 'he'] as const) {
      const value = translate(locale, key);
      expect(value).not.toBe(key);
      expect(value).not.toMatch(/SIMPLE_OTTOMAN|STANDARD_FURNITURE|ARMCHAIR_PATH/);
    }
  });

  it('keeps sheet titles in sentence case, not all caps', () => {
    expect(translate('en', 'mobile.productionSetup.pickWorkflow')).toBe('Choose workflow');
    expect(translate('en', 'mobile.productionSetup.workflowListTitle')).toBe('Published paths');
    expect(translate('en', 'mobile.productionSetup.versionLabel')).toBe('Version {n}');
    expect(translate('en', 'mobile.production.workflow.scopeAll')).toBe('All');
    expect(translate('en', 'mobile.production.workflow.scopeStandard')).toBe('Normal');
    expect(translate('en', 'mobile.production.workflow.scopeReturn')).toBe('Return / recovery');
    expect(translate('en', 'mobile.production.workflow.searchWorkflows')).toBe(
      'Search workflows…',
    );
    expect(translate('en', 'mobile.productionSetup.pickWorkflow')).not.toBe(
      translate('en', 'mobile.productionSetup.pickWorkflow').toUpperCase(),
    );
  });
});
