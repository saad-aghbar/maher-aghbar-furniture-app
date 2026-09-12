import { Inject, Injectable, Logger } from '@nestjs/common';
import type { TranslateProvider } from '@maher/integrations';
import { TRANSLATE_PROVIDER } from '../../integrations/integrations.module';

export type TranslatedNames = {
  nameAr: string;
  nameEn: string;
  nameHe: string;
};

/**
 * Arabic-first catalog copy. English is filled on save when blank, and on
 * demand from the translate-name endpoint. Failures stay empty — UI falls
 * back to Arabic.
 */
@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);

  constructor(@Inject(TRANSLATE_PROVIDER) private readonly translate: TranslateProvider) {}

  async translateName(text: string): Promise<TranslatedNames> {
    const source = text.trim();
    if (!source) return { nameAr: '', nameEn: '', nameHe: '' };
    try {
      const suggested = await this.translate.suggestNameTranslations(source);
      return {
        nameAr: suggested.nameAr?.trim() || source,
        nameEn: suggested.nameEn?.trim() || '',
        nameHe: suggested.nameHe?.trim() || '',
      };
    } catch (err) {
      this.logger.warn(`Name translation failed: ${err instanceof Error ? err.message : String(err)}`);
      return { nameAr: source, nameEn: '', nameHe: '' };
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

  /** Keep an existing English value; otherwise translate Arabic. */
  async fillEnglishName(
    arabic: string | null | undefined,
    english: string | null | undefined,
  ): Promise<string> {
    const en = String(english ?? '').trim();
    if (en) return en;
    const ar = String(arabic ?? '').trim();
    if (!ar) return '';
    const suggested = await this.translateName(ar);
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
