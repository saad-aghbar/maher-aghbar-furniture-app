export type AppSpeechLocale = 'en' | 'ar' | 'he';

export type SpeechVoicePick = {
  language: string;
  identifier?: string;
};

const FALLBACK_LANGUAGE: Record<AppSpeechLocale, string> = {
  en: 'en-US',
  ar: 'ar-SA',
  he: 'he-IL',
};

export function appSpeechLocale(locale: string | null | undefined): AppSpeechLocale {
  const raw = String(locale ?? '').toLowerCase();
  if (raw.startsWith('ar')) return 'ar';
  if (raw.startsWith('he') || raw.startsWith('iw')) return 'he';
  return 'en';
}

export function speechLanguageTag(locale: string | null | undefined): string {
  return FALLBACK_LANGUAGE[appSpeechLocale(locale)];
}

/** Prefer a device voice that matches the app language (en / ar / he). */
export function pickSpeechVoice(
  voices: Array<{ language?: string | null; identifier?: string | null; quality?: string | null }>,
  locale: string | null | undefined,
): SpeechVoicePick {
  const app = appSpeechLocale(locale);
  const prefixes =
    app === 'ar' ? ['ar'] : app === 'he' ? ['he', 'iw'] : ['en'];
  const matches = voices.filter((voice) => {
    const lang = String(voice.language ?? '').toLowerCase();
    return prefixes.some((prefix) => lang === prefix || lang.startsWith(`${prefix}-`));
  });
  const enhanced = matches.find((voice) => String(voice.quality ?? '').toLowerCase() === 'enhanced');
  const picked = enhanced ?? matches[0];
  if (picked?.language) {
    return {
      language: picked.language,
      identifier: picked.identifier ?? undefined,
    };
  }
  return { language: FALLBACK_LANGUAGE[app] };
}
