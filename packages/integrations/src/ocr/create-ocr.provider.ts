import type { OcrProvider } from './types';
import { MockOcrProvider } from './mock-ocr.provider';
import { OpenAiVisionOcrProvider } from './openai-vision-ocr.provider';
import { GoogleVisionOcrProvider } from './google-vision-ocr.provider';
import { HttpOcrProvider } from './http-ocr.provider';
import { LocalFreeOcrProvider, PreferPdfTextOcrProvider } from './local-ocr.provider';

function wrapPdfPrefer(inner: OcrProvider): OcrProvider {
  return new PreferPdfTextOcrProvider(inner);
}

function looksLikeGoogleApiKey(value: string): boolean {
  return value.startsWith('AIza');
}

export function createOcrProvider(env: NodeJS.ProcessEnv = process.env): OcrProvider {
  const forced = (env.OCR_PROVIDER ?? env.AI_OCR_PROVIDER ?? '').toLowerCase();
  if (forced === 'mock') return new MockOcrProvider();
  if (forced === 'local' || forced === 'tesseract' || forced === 'pdf') {
    return new LocalFreeOcrProvider();
  }

  const ocrKey = env.OCR_API_KEY?.trim();
  const openAiKey = env.OPENAI_API_KEY?.trim();

  if (forced === 'google' || forced === 'google-vision' || forced === 'vision') {
    if (ocrKey) return wrapPdfPrefer(new GoogleVisionOcrProvider(ocrKey));
    console.warn('[ocr] OCR_PROVIDER=google but OCR_API_KEY missing — using mock');
    return new MockOcrProvider();
  }

  if (ocrKey && env.OCR_API_URL && !env.OCR_API_URL.includes('openai.com')) {
    return wrapPdfPrefer(new HttpOcrProvider(ocrKey, env.OCR_API_URL));
  }

  if (forced === 'openai' || forced === 'http') {
    const key = openAiKey || (ocrKey && !looksLikeGoogleApiKey(ocrKey) ? ocrKey : undefined);
    if (key) return wrapPdfPrefer(new OpenAiVisionOcrProvider(key));
    console.warn('[ocr] OCR_PROVIDER=openai but no OpenAI key — using mock');
    return new MockOcrProvider();
  }

  // Auto-select when provider not forced to mock/local
  if (ocrKey && looksLikeGoogleApiKey(ocrKey)) {
    return wrapPdfPrefer(new GoogleVisionOcrProvider(ocrKey));
  }

  if (openAiKey) {
    return wrapPdfPrefer(new OpenAiVisionOcrProvider(openAiKey));
  }

  if (ocrKey) {
    return wrapPdfPrefer(new OpenAiVisionOcrProvider(ocrKey));
  }

  if (forced === 'auto') return new LocalFreeOcrProvider();
  return new MockOcrProvider();
}
