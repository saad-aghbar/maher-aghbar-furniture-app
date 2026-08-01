import type {
  ExtractionProvider,
  ExtractionResult,
  ExtractedField,
  SupportedLocale,
  TranslateProvider,
} from './types';
import { MockExtractionProvider } from './mock-ai.provider';

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
    const result = (await chatJson(
      this.apiKey,
      this.model,
      'You translate furniture RFQ text. Return JSON: {"translated":"..."}',
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
    opts?: { customerId?: string },
  ): Promise<ExtractionResult> {
    const originalText = text.trim();
    if (!originalText) {
      return new MockExtractionProvider(this.translate).extractStructured(text, opts);
    }

    const result = (await chatJson(
      this.apiKey,
      this.model,
      `Extract furniture RFQ fields from OCR text. Return JSON:
{"detectedLanguage":"ar|en|he","product":"...","quantity":"...","width":null|string,"height":null|string,"depth":null|string,"fabric":null|string,"deliveryDate":null|string,"confidence":{"product":0-1,...}}
Dimensions may be missing.`,
      originalText,
    )) as {
      detectedLanguage?: SupportedLocale;
      product?: string;
      quantity?: string;
      width?: string | null;
      height?: string | null;
      depth?: string | null;
      fabric?: string | null;
      deliveryDate?: string | null;
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

    const fields: ExtractedField[] = [
      field('product', result.product ?? 'Custom furniture', 0.9),
      { ...field('quantity', result.quantity ?? '1', 0.9), isMissing: !result.quantity },
      field('width', result.width, 0.85),
      field('height', result.height, 0.85),
      field('depth', result.depth, 0.85),
      field('fabric', result.fabric, 0.8),
      field('deliveryDate', result.deliveryDate, 0.85),
      {
        fieldName: 'customer',
        fieldValue: opts?.customerId ?? null,
        confidence: opts?.customerId ? 0.9 : 0.4,
        isMissing: !opts?.customerId,
      },
    ];

    const detectedLanguage = result.detectedLanguage ?? 'en';
    const translatedText = await this.translate.translate(originalText, detectedLanguage, 'ar');

    return {
      originalText,
      translatedText,
      detectedLanguage,
      fields,
      provider: this.name,
    };
  }
}
