import { translate, translatePlural } from '../translate';

describe('order production-setup leftover copy', () => {
  it('humanizes kickers in sentence case (not ALL CAPS)', () => {
    expect(translate('en', 'mobile.orderProductionSetup.planRequiredKicker')).toBe(
      'Production plan required',
    );
    expect(translate('en', 'mobile.orderProductionSetup.planKicker')).toBe('Production plan');
    expect(translate('en', 'mobile.orderProductionSetup.factoryReadiness')).toBe(
      'Factory readiness',
    );
    for (const key of [
      'mobile.orderProductionSetup.planRequiredKicker',
      'mobile.orderProductionSetup.planKicker',
      'mobile.orderProductionSetup.factoryReadiness',
    ] as const) {
      for (const locale of ['en', 'ar', 'he'] as const) {
        const value = translate(locale, key);
        expect(value).not.toMatch(/^[A-Z ]+$/);
        expect(value).not.toBe(key);
      }
    }
  });

  it('does not tell a Released order to release', () => {
    expect(translate('en', 'mobile.orderProductionSetup.planReleasedBody')).not.toMatch(
      /then release/i,
    );
    expect(translate('en', 'mobile.orderProductionSetup.planReleasedBody')).not.toMatch(
      /required/i,
    );
    expect(translate('en', 'mobile.orderProductionSetup.planRequiredBody')).toMatch(
      /then release to the factory/i,
    );
  });

  it('pluralizes remaining issues honestly', () => {
    expect(translatePlural('en', 'mobile.orderProductionSetup.issuesRemaining', 1)).toBe(
      '1 issue remaining',
    );
    expect(translatePlural('en', 'mobile.orderProductionSetup.issuesRemaining', 2)).toBe(
      '2 issues remaining',
    );
    expect(translatePlural('ar', 'mobile.orderProductionSetup.issuesRemaining', 1)).not.toBe(
      'mobile.orderProductionSetup.issuesRemainingOne',
    );
  });

  it('keeps honest material leftover copy', () => {
    expect(translate('en', 'mobile.orderProductionSetup.materialsNeedReview')).toBe(
      'Materials need review',
    );
    expect(translate('en', 'mobile.orderProductionSetup.estimateIncomplete')).toMatch(
      /Estimate incomplete/,
    );
  });
});
