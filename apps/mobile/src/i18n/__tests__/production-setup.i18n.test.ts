import { translate } from '../translate';

const KEYS = [
  'mobile.production.workflow.setupInvalid',
  'mobile.production.workflow.issueOutputName',
  'production.setup.issues',
] as const;

describe('production setup leftover copy', () => {
  it('humanizes INVALID as Incomplete without claiming the setup is valid', () => {
    expect(translate('en', 'mobile.production.workflow.setupInvalid')).toBe('Incomplete');
    expect(translate('en', 'mobile.production.workflow.setupInvalid')).not.toBe('Invalid');
    expect(translate('en', 'mobile.production.workflow.setupReady')).toBe('Ready');
  });

  it('does not dump a parenthetical example on output-name issues', () => {
    const en = translate('en', 'mobile.production.workflow.issueOutputName', {
      stage: 'Packaging',
    });
    expect(en).toBe('Name every ship package for Packaging.');
    expect(en).not.toMatch(/for example/i);
    expect(en).not.toMatch(/\(.*\)/);
  });

  it.each(KEYS)('resolves %s in EN, AR, and HE', (key) => {
    for (const locale of ['en', 'ar', 'he'] as const) {
      const value = translate(locale, key, { stage: 'Packaging' });
      expect(value).not.toBe(key);
      expect(value).not.toMatch(/INVALID|NEEDS_SETUP/);
      expect(value).not.toMatch(/for example/i);
    }
  });
});
