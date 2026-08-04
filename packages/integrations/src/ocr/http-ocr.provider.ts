import type { OcrProvider, OcrResult } from './types';
import { OpenAiVisionOcrProvider } from './openai-vision-ocr.provider';

/** Generic HTTP OCR: POST multipart/json to OCR_API_URL with OCR_API_KEY. */
export class HttpOcrProvider implements OcrProvider {
  readonly name = 'http-ocr';

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = process.env.OCR_API_URL ?? 'https://api.openai.com/v1/chat/completions',
  ) {}

  async extractText(input: Buffer, mimeType: string): Promise<OcrResult> {
    // Prefer OpenAI-compatible vision when pointing at OpenAI; otherwise POST raw bytes.
    if (this.baseUrl.includes('openai.com')) {
      return new OpenAiVisionOcrProvider(this.apiKey).extractText(input, mimeType);
    }

    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': mimeType,
        'X-Api-Key': this.apiKey,
      },
      body: input,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP OCR failed (${res.status}): ${body}`);
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const json = (await res.json()) as { text?: string; content?: string };
      return {
        text: json.text ?? json.content ?? JSON.stringify(json),
        provider: this.name,
      };
    }

    return { text: await res.text(), provider: this.name };
  }
}
