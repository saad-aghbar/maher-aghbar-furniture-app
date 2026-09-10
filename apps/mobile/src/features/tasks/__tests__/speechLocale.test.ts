import { appSpeechLocale, pickSpeechVoice, speechLanguageTag } from '../speechLocale';

describe('speechLocale', () => {
  it('maps the three app languages', () => {
    expect(appSpeechLocale('en')).toBe('en');
    expect(appSpeechLocale('ar')).toBe('ar');
    expect(appSpeechLocale('he')).toBe('he');
    expect(speechLanguageTag('en')).toBe('en-US');
    expect(speechLanguageTag('ar')).toBe('ar-SA');
    expect(speechLanguageTag('he')).toBe('he-IL');
  });

  it('picks a matching device voice over the fallback tag', () => {
    expect(
      pickSpeechVoice(
        [
          { language: 'en-US', identifier: 'com.apple.voice.en', quality: 'Default' },
          { language: 'ar-SA', identifier: 'com.apple.voice.ar', quality: 'Enhanced' },
          { language: 'he-IL', identifier: 'com.apple.voice.he', quality: 'Default' },
        ],
        'ar',
      ),
    ).toEqual({ language: 'ar-SA', identifier: 'com.apple.voice.ar' });
  });
});
