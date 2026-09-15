import { translate } from '../translate';

const KEYS = [
  'mobile.notifications.prefs.title',
  'mobile.notifications.prefs.subtitle',
  'mobile.notifications.prefs.deliverToPhone',
  'mobile.notifications.prefs.pauseAll',
  'mobile.notifications.prefs.groupAll',
  'mobile.notifications.prefs.groupNone',
  'mobile.notifications.prefs.confirm',
  'mobile.notifications.prefs.saved',
  'mobile.notifications.prefs.saveFailed',
] as const;

describe('notification settings i18n keys', () => {
  it('resolves English confirm copy without leftover Arabic', () => {
    expect(translate('en', 'mobile.notifications.prefs.confirm')).toBe('Confirm');
    expect(translate('en', 'mobile.notifications.prefs.title')).toBe('Notification settings');
    expect(translate('en', 'mobile.notifications.prefs.confirm')).not.toMatch(/[\u0600-\u06FF]/);
  });

  for (const locale of ['en', 'ar', 'he'] as const) {
    it(`resolves prefs keys in ${locale}`, () => {
      for (const key of KEYS) {
        const value = translate(locale, key);
        expect(value).not.toBe(key);
        expect(value.length).toBeGreaterThan(0);
      }
    });
  }
});
