import type { Locale } from '@maher/types';

export type TrilingualNames = {
  nameEn: string;
  nameAr: string;
  nameHe: string;
};

export function slugFromEnglishName(nameEn: string, prefix: string): string {
  const base = nameEn
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return base || `${prefix}_${Date.now().toString(36).toUpperCase()}`;
}

export function asLocale(locale: string): Locale {
  return locale === 'ar' || locale === 'he' || locale === 'en' ? locale : 'en';
}
