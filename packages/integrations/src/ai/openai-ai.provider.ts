import type {
  ExtractionProvider,
  ExtractionResult,
  ExtractedField,
  ExtractedLineItem,
  SupportedLocale,
  TranslateProvider,
} from './types';
import { MockExtractionProvider } from './mock-ai.provider';

function resolveTargetLocale(opts?: { targetLanguage?: SupportedLocale }): SupportedLocale {
  const fromOpts = opts?.targetLanguage;
  if (fromOpts === 'ar' || fromOpts === 'he' || fromOpts === 'en') return fromOpts;
  const fromEnv = process.env.DEFAULT_LOCALE;
  if (fromEnv === 'ar' || fromEnv === 'he' || fromEnv === 'en') return fromEnv;
  return 'ar';
}

function localeLabel(locale: SupportedLocale): string {
  if (locale === 'ar') return 'Arabic';
  if (locale === 'he') return 'Hebrew';
  return 'English';
}

async function chatJson(
  apiKey: string,
  model: string,
  system: string,
  user: string,
): Promise<unknown> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI request failed (${res.status}): ${body}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content ?? '{}';
  return JSON.parse(content) as unknown;
}

export class OpenAiTranslateProvider implements TranslateProvider {
  readonly name = 'openai';

  constructor(
    private readonly apiKey: string,
    private readonly model = process.env.AI_LLM_MODEL ?? 'gpt-4o-mini',
  ) {}

  async translate(text: string, from: SupportedLocale | 'auto', to: SupportedLocale): Promise<string> {
    const sourceNote =
      from === 'he'
        ? 'Source is handwritten Hebrew from a furniture order form.'
        : 'Source may be handwritten Hebrew, Arabic, or English furniture order text.';
    const result = (await chatJson(
      this.apiKey,
      this.model,
      `You translate furniture RFQ/order text into the factory system language (${localeLabel(to)}). ${sourceNote} Preserve numbers, dimensions, quantities, and dates. Return JSON: {"translated":"..."}`,
      `Translate from ${from} to ${to}:\n${text}`,
    )) as { translated?: string };
    return result.translated ?? text;
  }

  async suggestNameTranslations(name: string) {
    const result = (await chatJson(
      this.apiKey,
      this.model,
      'Translate a customer/company display name into Arabic, English, and Hebrew. Return JSON: {"nameAr":"...","nameEn":"...","nameHe":"..."}. Keep proper nouns when appropriate.',
      name,
    )) as { nameAr?: string; nameEn?: string; nameHe?: string };
    return {
      nameAr: result.nameAr ?? name,
      nameEn: result.nameEn ?? name,
      nameHe: result.nameHe ?? name,
    };
  }
}

export class OpenAiExtractionProvider implements ExtractionProvider {
  readonly name = 'openai';

  constructor(
    private readonly apiKey: string,
    private readonly translate: TranslateProvider,
    private readonly model = process.env.AI_LLM_MODEL ?? 'gpt-4o-mini',
  ) {}

  async extractStructured(
    text: string,
    opts?: { customerId?: string; targetLanguage?: SupportedLocale },
  ): Promise<ExtractionResult> {
    const originalText = text.trim();
    const targetLanguage = resolveTargetLocale(opts);
    if (!originalText) {
      return new MockExtractionProvider(this.translate).extractStructured(text, opts);
    }

    const result = (await chatJson(
      this.apiKey,
      this.model,
      `Extract furniture order / RFQ fields from OCR text. The source is often handwritten Hebrew (sometimes Arabic or English) from a photographed factory order form.
Return product names and category labels in ${localeLabel(targetLanguage)} where possible. Keep numeric dimensions and quantities as written.
Return JSON:
{"detectedLanguage":"ar|en|he","projectName":null|string,"deliveryDate":null|string,"items":[{"productName":"...","quantity":"1","width":null|string,"height":null|string,"depth":null|string,"fabricType":null|string,"material":null|string,"category":null|string,"notes":null|string}],"confidence":{"productName":0-1,...}}
Include every distinct line item. Dimensions may be missing per item.`,
      originalText,
    )) as {
      detectedLanguage?: SupportedLocale;
      projectName?: string | null;
      deliveryDate?: string | null;
      items?: Array<{
        productName?: string;
        product?: string;
        quantity?: string;
        width?: string | null;
        height?: string | null;
        depth?: string | null;
        fabricType?: string | null;
        fabric?: string | null;
        material?: string | null;
        category?: string | null;
        notes?: string | null;
      }>;
      product?: string;
      quantity?: string;
      width?: string | null;
      height?: string | null;
      depth?: string | null;
      fabric?: string | null;
      confidence?: Record<string, number>;
    };

    const conf = result.confidence ?? {};
    const field = (
      name: string,
      value: string | null | undefined,
      fallbackConf: number,
    ): ExtractedField => ({
      fieldName: name,
      fieldValue: value ?? null,
      confidence: conf[name] ?? (value ? fallbackConf : 0.2),
      isMissing: value == null || value === '',
    });

    const rawItems = result.items?.length
      ? result.items
      : [
          {
            productName: result.product,
            product: result.product,
            quantity: result.quantity,
            width: result.width,
            height: result.height,
            depth: result.depth,
            fabricType: result.fabric,
            fabric: result.fabric,
          },
        ];

    const items: ExtractedLineItem[] = rawItems.map((row) => ({
      productName: row.productName ?? row.product ?? 'Custom furniture',
      quantity: row.quantity ?? '1',
      width: row.width ?? null,
      height: row.height ?? null,
      depth: row.depth ?? null,
      fabricType: row.fabricType ?? row.fabric ?? null,
      material: row.material ?? null,
      category: row.category ?? null,
      notes: row.notes ?? null,
    }));

    const primary = items[0];
    const fields: ExtractedField[] = [
      field('product', primary?.productName ?? 'Custom furniture', 0.9),
      { ...field('quantity', primary?.quantity ?? '1', 0.9), isMissing: !primary?.quantity },
      field('width', primary?.width, 0.85),
      field('height', primary?.height, 0.85),
      field('depth', primary?.depth, 0.85),
      field('fabric', primary?.fabricType, 0.8),
      field('deliveryDate', result.deliveryDate, 0.85),
      field('projectName', result.projectName, 0.8),
      {
        fieldName: 'customer',
        fieldValue: opts?.customerId ?? null,
        confidence: opts?.customerId ? 0.9 : 0.4,
        isMissing: !opts?.customerId,
      },
    ];

    const detectedLanguage = result.detectedLanguage ?? 'en';
    const translateFrom: SupportedLocale | 'auto' =
      detectedLanguage === 'he' ? 'he' : detectedLanguage;
    const translatedText = await this.translate.translate(
      originalText,
      translateFrom,
      targetLanguage,
    );

    return {
      originalText,
      translatedText,
      detectedLanguage,
      fields,
      items,
      provider: this.name,
    };
  }
}
