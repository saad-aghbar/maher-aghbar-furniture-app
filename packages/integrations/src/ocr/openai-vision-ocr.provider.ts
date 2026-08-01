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
              'Extract all readable text from the image or document. Return plain text only.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'OCR this document.' },
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
