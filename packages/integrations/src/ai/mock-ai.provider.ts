import type {
  ExtractionProvider,
  ExtractionResult,
  ExtractedField,
  ExtractedLineItem,
  SupportedLocale,
  TranslateProvider,
} from './types';

function regexExtract(rawText: string, customerId?: string): ExtractedField[] {
  const text = rawText.trim();
  const qty =
    text.match(/\bqty[:\s]*(\d+)/i)?.[1] ?? text.match(/\b(\d+)\s*(pcs|units|seats)?\b/i)?.[1];
  const width = text.match(/\bW\s*(\d+)/i)?.[1] ?? text.match(/width[:\s]*(\d+)/i)?.[1];
  const height = text.match(/\bH\s*(\d+)/i)?.[1] ?? text.match(/height[:\s]*(\d+)/i)?.[1];
  const depth = text.match(/\bD\s*(\d+)/i)?.[1] ?? text.match(/depth[:\s]*(\d+)/i)?.[1];
  const date = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
  const fabric =
    text.match(/\b(grey|gray|beige|blue|green|red|velvet|leather|fabric)[\w\s-]*/i)?.[0]?.trim() ??
    null;
  const product =
    text.match(/\b(sofa|bed|table|chair|cabinet|wardrobe|desk)[\w\s-]*/i)?.[0]?.trim() ??
    'Custom furniture';

  return [
    { fieldName: 'product', fieldValue: product, confidence: 0.9 },
    { fieldName: 'quantity', fieldValue: qty ?? '1', confidence: qty ? 0.95 : 0.5 },
    { fieldName: 'width', fieldValue: width ?? null, confidence: width ? 0.88 : 0.2, isMissing: !width },
    { fieldName: 'height', fieldValue: height ?? null, confidence: height ? 0.88 : 0.2, isMissing: !height },
    { fieldName: 'depth', fieldValue: depth ?? null, confidence: depth ? 0.88 : 0.2, isMissing: !depth },
    { fieldName: 'fabric', fieldValue: fabric, confidence: fabric ? 0.84 : 0.3, isMissing: !fabric },
    {
      fieldName: 'deliveryDate',
      fieldValue: date ?? null,
      confidence: date ? 0.9 : 0.2,
      isMissing: !date,
    },
    {
      fieldName: 'customer',
      fieldValue: customerId ?? null,
      confidence: customerId ? 0.9 : 0.4,
      isMissing: !customerId,
    },
  ];
}

function detectLanguage(text: string): SupportedLocale {
  if (/[\u0590-\u05FF]/.test(text)) return 'he';
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  return 'en';
}

export class MockTranslateProvider implements TranslateProvider {
  readonly name = 'mock';

  async translate(text: string, _from: SupportedLocale | 'auto', to: SupportedLocale): Promise<string> {
    if (to === 'ar') return `طلب مستخرج: ${text.slice(0, 200)}`;
    if (to === 'he') return `בקשה מחולצת: ${text.slice(0, 200)}`;
    return text;
  }

  async suggestNameTranslations(name: string) {
    return {
      nameAr: name,
      nameEn: name,
      nameHe: name,
    };
  }
}

function lineItemFromFields(fields: ExtractedField[]): ExtractedLineItem {
  const get = (name: string) => fields.find((f) => f.fieldName === name)?.fieldValue ?? null;
  return {
    productName: get('product') ?? 'Custom furniture',
    quantity: get('quantity') ?? '1',
    width: get('width'),
    height: get('height'),
    depth: get('depth'),
    fabricType: get('fabric'),
    material: get('material'),
    category: get('category'),
  };
}

export class MockExtractionProvider implements ExtractionProvider {
  readonly name = 'mock';

  constructor(private readonly translate: TranslateProvider = new MockTranslateProvider()) {}

  async extractStructured(
    text: string,
    opts?: { customerId?: string; targetLanguage?: SupportedLocale },
  ): Promise<ExtractionResult> {
    const originalText =
      text.trim() ||
      'Sofa 3 seats grey velvet W220 H90 D95 qty 4 delivery 2026-09-15 hotel lobby';
    const fields = regexExtract(originalText, opts?.customerId);
    const product = fields.find((f) => f.fieldName === 'product')?.fieldValue ?? 'Custom furniture';
    const qty = fields.find((f) => f.fieldName === 'quantity')?.fieldValue ?? '1';
    const width = fields.find((f) => f.fieldName === 'width')?.fieldValue;
    const height = fields.find((f) => f.fieldName === 'height')?.fieldValue;
    const depth = fields.find((f) => f.fieldName === 'depth')?.fieldValue;
    const fabric = fields.find((f) => f.fieldName === 'fabric')?.fieldValue;
    const date = fields.find((f) => f.fieldName === 'deliveryDate')?.fieldValue;

    const translatedText =
      `طلب مستخرج: ${product} كمية ${qty}` +
      (width ? ` عرض ${width}` : '') +
      (height ? ` ارتفاع ${height}` : '') +
      (depth ? ` عمق ${depth}` : '') +
      (fabric ? ` قماش/لون ${fabric}` : '') +
      (date ? ` تسليم ${date}` : '');

    return {
      originalText,
      translatedText,
      detectedLanguage: detectLanguage(originalText),
      fields,
      items: [lineItemFromFields(fields)],
      provider: this.name,
    };
  }
}
