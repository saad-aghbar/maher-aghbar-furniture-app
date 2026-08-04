import type { OcrProvider, OcrResult } from './types';

export class OpenAiVisionOcrProvider implements OcrProvider {
  readonly name = 'openai-vision';

  constructor(
    private readonly apiKey: string,
    private readonly model = process.env.AI_LLM_MODEL ?? 'gpt-4o-mini',
  ) {}

  async extractText(input: Buffer, mimeType: string): Promise<OcrResult> {
    const dataUrl = `data:${mimeType};base64,${input.toString('base64')}`;
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'You transcribe handwritten furniture factory order forms photographed on paper or whiteboards. ' +
              'The writing may be in Hebrew, Arabic, or English (often mixed). ' +
              'Preserve every number, dimension, quantity, date, fabric/color code, and product label exactly as written. ' +
              'Keep line breaks where the writer separated items. ' +
              'Do not translate, summarize, or invent content — return plain text of what was written, including unclear fragments marked with [?] if needed.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Transcribe all handwriting from this furniture order photo.' },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        temperature: 0,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI Vision OCR failed (${res.status}): ${body}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content?.trim() ?? '';
    return { text, provider: this.name, confidence: 0.85 };
  }
}
