import type { OcrProvider, OcrResult } from './types';

function isPdf(mimeType: string, buffer: Buffer): boolean {
  if (mimeType === 'application/pdf' || mimeType.includes('pdf')) return true;
  return buffer.length >= 5 && buffer.subarray(0, 5).toString('utf8') === '%PDF-';
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/** Extract embedded text from PDFs (no cloud key). */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // pdf-parse is CJS; require keeps types simple across bundlers.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (b: Buffer) => Promise<{ text?: string }>;
    const result = await pdfParse(buffer);
    return (result.text ?? '').replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

/**
 * Free/local OCR: PDF text via pdf-parse, images via tesseract.js.
 * Set OCR_PROVIDER=local|tesseract (requires optional deps installed).
 */
export class LocalFreeOcrProvider implements OcrProvider {
  readonly name = 'local';

  async extractText(input: Buffer, mimeType: string): Promise<OcrResult> {
    if (isPdf(mimeType, input)) {
      const text = await extractPdfText(input);
      if (text.length >= 8) {
        return { text, provider: 'pdf-parse', confidence: 0.92 };
      }
    }

    if (isImage(mimeType) || (!isPdf(mimeType, input) && input.length > 0)) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Tesseract = require('tesseract.js') as {
          recognize: (
            image: Buffer,
            langs: string,
            opts?: { logger?: (m: unknown) => void },
          ) => Promise<{ data?: { text?: string; confidence?: number } }>;
        };
        const result = await Tesseract.recognize(input, 'eng+ara', {
          logger: () => undefined,
        });
        const text = (result.data?.text ?? '').replace(/\s+/g, ' ').trim();
        if (text.length >= 3) {
          return {
            text,
            provider: 'tesseract',
            confidence: Number(result.data?.confidence ?? 70) / 100,
          };
        }
      } catch {
        // Optional dependency missing or recognition failed — fall through.
      }
    }

    return {
      text: '',
      provider: this.name,
      confidence: 0,
    };
  }
}

/** Prefer embedded PDF text before delegating to a cloud/local vision OCR. */
export class PreferPdfTextOcrProvider implements OcrProvider {
  readonly name: string;

  constructor(private readonly inner: OcrProvider) {
    this.name = `pdf+${inner.name}`;
  }

  async extractText(input: Buffer, mimeType: string): Promise<OcrResult> {
    if (isPdf(mimeType, input)) {
      const text = await extractPdfText(input);
      if (text.length >= 40) {
        return { text, provider: 'pdf-parse', confidence: 0.95 };
      }
    }
    return this.inner.extractText(input, mimeType);
  }
}
