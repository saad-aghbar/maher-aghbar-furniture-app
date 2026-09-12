export type SupportedLocale = 'ar' | 'en' | 'he';

export interface ExtractedField {
  fieldName: string;
  fieldValue: string | null;
  confidence: number;
  isMissing?: boolean;
}

/** Structured line item extracted from RFQ documents (supports multi-item orders). */
export interface ExtractedLineItem {
  productName: string;
  quantity?: string | null;
  width?: string | null;
  height?: string | null;
  depth?: string | null;
  fabricType?: string | null;
  material?: string | null;
  category?: string | null;
  notes?: string | null;
  variantLabel?: string | null;
  orientation?: string | null;
  woodType?: string | null;
  woodColor?: string | null;
  foamDensity?: string | null;
  finish?: string | null;
  optionCodes?: string[] | null;
  unrecognizedOptions?: string[] | null;
  confidence?: number | null;
  lowConfidenceFields?: string[] | null;
}

export type SpecLibraryValue = {
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
};

export type SpecExtractionContext = {
  locale?: SupportedLocale;
  optionGroups?: Array<{ code: string; values: SpecLibraryValue[] }>;
  products?: Array<{ id: string; sku: string; nameAr: string; nameEn: string }>;
  variants?: Array<{
    id: string;
    productId: string;
    sku: string;
    nameAr: string;
    nameEn: string;
  }>;
};

export interface ExtractionResult {
  originalText: string;
  translatedText: string;
  detectedLanguage: SupportedLocale;
  fields: ExtractedField[];
  items?: ExtractedLineItem[];
  provider: string;
}

export interface TranslateProvider {
  readonly name: string;
  translate(text: string, from: SupportedLocale | 'auto', to: SupportedLocale): Promise<string>;
  suggestNameTranslations(name: string): Promise<{ nameAr: string; nameEn: string; nameHe: string }>;
}

export interface ExtractionProvider {
  readonly name: string;
  extractStructured(
    text: string,
    opts?: { customerId?: string; targetLanguage?: SupportedLocale },
  ): Promise<ExtractionResult>;
  extractSpecFromImage?(
    buffer: Buffer,
    mime: string,
    ctx?: SpecExtractionContext,
  ): Promise<ExtractionResult>;
}

export interface AiProviders {
  translate: TranslateProvider;
  extract: ExtractionProvider;
}
