import type { OcrProvider, OcrResult } from './types';

/**
 * Google Cloud Vision DOCUMENT_TEXT_DETECTION via API key.
 * Requires Cloud Vision API enabled on the Google Cloud project.
 */
export class GoogleVisionOcrProvider implements OcrProvider {
  readonly name = 'google-vision';

  constructor(private readonly apiKey: string) {}

  async extractText(input: Buffer, mimeType: string): Promise<OcrResult> {
    if (mimeType.includes('pdf')) {
      throw new Error(
        'Google Vision OCR via API key supports images only; wrap with PreferPdfTextOcrProvider for PDFs',
      );
    }

    const url = `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(this.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: input.toString('base64') },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
            imageContext: { languageHints: ['ar', 'en', 'he'] },
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Google Vision OCR failed (${res.status}): ${body}`);
    }

    const json = (await res.json()) as {
      responses?: Array<{
        fullTextAnnotation?: { text?: string };
        textAnnotations?: Array<{ description?: string }>;
        error?: { message?: string };
      }>;
    };

    const first = json.responses?.[0];
    if (first?.error?.message) {
      throw new Error(`Google Vision OCR error: ${first.error.message}`);
    }

    const text =
      first?.fullTextAnnotation?.text?.trim() ||
      first?.textAnnotations?.[0]?.description?.trim() ||
      '';

    return { text, provider: this.name, confidence: text ? 0.88 : 0.2 };
  }
}
