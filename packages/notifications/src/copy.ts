import { renderSafePushText } from './privacy';
import type { LocaleCopy, TopicDefinition } from './types';

export type PushLocale = 'ar' | 'en' | 'he';

export function pickLocaleCopy(copy: LocaleCopy, locale: PushLocale): string {
  if (locale === 'ar') return copy.ar;
  if (locale === 'he') return copy.he;
  return copy.en;
}

export function lockScreenCopy(
  topic: TopicDefinition,
  locale: PushLocale,
  vars: Record<string, string | number | null | undefined> | undefined,
): { title: string; body: string } {
  return {
    title: renderSafePushText(pickLocaleCopy(topic.pushTitle, locale), vars ?? {}),
    body: renderSafePushText(pickLocaleCopy(topic.pushBody, locale), vars ?? {}),
  };
}

export function genericLockScreenCopy(locale: PushLocale): { title: string; body: string } {
  if (locale === 'ar') {
    return { title: 'تنبيه من ماهر', body: 'افتح التطبيق للتفاصيل.' };
  }
  if (locale === 'he') {
    return { title: 'התראה ממאהר', body: 'פתחו את האפליקציה לפרטים.' };
  }
  return { title: 'Maher update', body: 'Open the app for details.' };
}
