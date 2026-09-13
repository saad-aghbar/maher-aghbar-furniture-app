import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupportedLocale, TranslateProvider } from '@maher/integrations';
import { TRANSLATE_PROVIDER } from '../../integrations/integrations.module';

export type TranslatedNames = {
  nameAr: string;
  nameEn: string;
  nameHe: string;
};

export type NameSourceLocale = SupportedLocale;

export function parseSourceLocale(value: unknown): NameSourceLocale {
  if (value === 'en' || value === 'he' || value === 'ar') return value;
  return 'ar';
}

function localeKey(locale: NameSourceLocale): keyof TranslatedNames {
  if (locale === 'ar') return 'nameAr';
  if (locale === 'he') return 'nameHe';
  return 'nameEn';
}

function emptyNames(): TranslatedNames {
  return { nameAr: '', nameEn: '', nameHe: '' };
}

function preserveSource(
  source: string,
  sourceLocale: NameSourceLocale,
  suggested: Partial<TranslatedNames>,
): TranslatedNames {
  return {
    nameAr: sourceLocale === 'ar' ? source : suggested.nameAr?.trim() || source,
    nameEn: sourceLocale === 'en' ? source : suggested.nameEn?.trim() || source,
    nameHe: sourceLocale === 'he' ? source : suggested.nameHe?.trim() || source,
  };
}

/**
 * Locale-source catalog copy. The typed language is stored as-is; the other
 * two locales are filled from the translate provider.
 */
@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);

  constructor(@Inject(TRANSLATE_PROVIDER) private readonly translate: TranslateProvider) {}

  async translateName(
    text: string,
    sourceLocale: NameSourceLocale = 'ar',
  ): Promise<TranslatedNames> {
    const source = text.trim();
    if (!source) return emptyNames();
    try {
      const suggested = await this.translate.suggestNameTranslations(source);
      return preserveSource(source, sourceLocale, suggested);
    } catch (err) {
      this.logger.warn(`Name translation failed: ${err instanceof Error ? err.message : String(err)}`);
      const failed = emptyNames();
      failed[localeKey(sourceLocale)] = source;
      return failed;
    }
  }

  async translateProse(text: string): Promise<string> {
    const source = text.trim();
    if (!source) return '';
    try {
      const translated = await this.translate.translate(source, 'ar', 'en');
      return translated.trim();
    } catch (err) {
      this.logger.warn(`Prose translation failed: ${err instanceof Error ? err.message : String(err)}`);
      return '';
    }
  }

  async translateProseAll(
    text: string,
    sourceLocale: NameSourceLocale = 'ar',
  ): Promise<TranslatedNames> {
    const source = text.trim();
    if (!source) return emptyNames();
    const names = emptyNames();
    names[localeKey(sourceLocale)] = source;
    const targets: NameSourceLocale[] = (['ar', 'en', 'he'] as const).filter(
      (locale) => locale !== sourceLocale,
    );
    await Promise.all(
      targets.map(async (to) => {
        try {
          const translated = await this.translate.translate(source, sourceLocale, to);
          names[localeKey(to)] = translated.trim() || source;
        } catch (err) {
          this.logger.warn(
            `Prose translation failed (${sourceLocale}→${to}): ${err instanceof Error ? err.message : String(err)}`,
          );
          names[localeKey(to)] = source;
        }
      }),
    );
    return names;
  }

  /** Keep an existing English value; otherwise translate Arabic. */
  async fillEnglishName(
    arabic: string | null | undefined,
    english: string | null | undefined,
  ): Promise<string> {
    const en = String(english ?? '').trim();
    if (en) return en;
    const ar = String(arabic ?? '').trim();
    if (!ar) return '';
    const suggested = await this.translateName(ar, 'ar');
    return suggested.nameEn;
  }

  async fillEnglishProse(
    arabic: string | null | undefined,
    english: string | null | undefined,
  ): Promise<string> {
    const en = String(english ?? '').trim();
    if (en) return en;
    const ar = String(arabic ?? '').trim();
    if (!ar) return '';
    return this.translateProse(ar);
  }
}
