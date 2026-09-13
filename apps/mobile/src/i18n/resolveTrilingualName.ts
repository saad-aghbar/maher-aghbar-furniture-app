import { translateCatalogName } from '@/api/modules/catalogAdmin';

export type TrilingualNames = {
  nameEn: string;
  nameAr: string;
  nameHe: string;
};

export type NameSourceLocale = 'ar' | 'en' | 'he';

export function asNameSourceLocale(locale: string): NameSourceLocale {
  if (locale === 'ar' || locale === 'he') return locale;
  return 'en';
}

export function copyTrilingual(text: string): TrilingualNames {
  const source = text.trim();
  return { nameEn: source, nameAr: source, nameHe: source };
}

export function preserveSourceLocale(
  source: string,
  locale: NameSourceLocale,
  suggested: Partial<TrilingualNames>,
): TrilingualNames {
  const trimmed = source.trim();
  return {
    nameEn: locale === 'en' ? trimmed : suggested.nameEn?.trim() || trimmed,
    nameAr: locale === 'ar' ? trimmed : suggested.nameAr?.trim() || trimmed,
    nameHe: locale === 'he' ? trimmed : suggested.nameHe?.trim() || trimmed,
  };
}

export async function resolveTrilingualName(
  text: string,
  locale: string,
  kind: 'name' | 'prose' = 'name',
): Promise<TrilingualNames> {
  const source = text.trim();
  if (!source) return { nameEn: '', nameAr: '', nameHe: '' };
  const sourceLocale = asNameSourceLocale(locale);
  try {
    const suggested = await translateCatalogName(source, kind, sourceLocale);
    return preserveSourceLocale(source, sourceLocale, suggested);
  } catch {
    return copyTrilingual(source);
  }
}

/**
 * Re-translate only when the visible field changed. Unchanged edits keep
 * stored translations (blank locales still get the typed text).
 */
export async function resolveTrilingualIfChanged(opts: {
  typed: string;
  locale: string;
  original: string;
  existing?: Partial<TrilingualNames> | null;
  kind?: 'name' | 'prose';
}): Promise<TrilingualNames> {
  const typed = opts.typed.trim();
  if (!typed) return { nameEn: '', nameAr: '', nameHe: '' };
  if (opts.existing && typed === opts.original.trim()) {
    return {
      nameEn: opts.existing.nameEn?.trim() || typed,
      nameAr: opts.existing.nameAr?.trim() || typed,
      nameHe: opts.existing.nameHe?.trim() || typed,
    };
  }
  return resolveTrilingualName(typed, opts.locale, opts.kind ?? 'name');
}
