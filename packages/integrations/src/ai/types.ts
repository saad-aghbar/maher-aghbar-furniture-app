export type SupportedLocale = 'ar' | 'en' | 'he';

export interface ExtractedField {
  fieldName: string;
  fieldValue: string | null;
  confidence: number;
  isMissing?: boolean;
}

export interface ExtractionResult {
  originalText: string;
  translatedText: string;
  detectedLanguage: SupportedLocale;
  fields: ExtractedField[];
  provider: string;
}

export interface TranslateProvider {
  readonly name: string;
  translate(text: string, from: SupportedLocale | 'auto', to: SupportedLocale): Promise<string>;
  suggestNameTranslations(name: string): Promise<{ nameAr: string; nameEn: string; nameHe: string }>;
}

export interface ExtractionProvider {
  readonly name: string;
  extractStructured(text: string, opts?: { customerId?: string }): Promise<ExtractionResult>;
}

export interface AiProviders {
  translate: TranslateProvider;
  extract: ExtractionProvider;
}
