import type { OcrProvider } from './types';
import { MockOcrProvider } from './mock-ocr.provider';
import { OpenAiVisionOcrProvider } from './openai-vision-ocr.provider';
import { HttpOcrProvider } from './http-ocr.provider';
import { LocalFreeOcrProvider, PreferPdfTextOcrProvider } from './local-ocr.provider';

function wrapPdfPrefer(inner: OcrProvider): OcrProvider {
  return new PreferPdfTextOcrProvider(inner);
}

export function createOcrProvider(env: NodeJS.ProcessEnv = process.env): OcrProvider {
  const forced = (env.OCR_PROVIDER ?? env.AI_OCR_PROVIDER ?? '').toLowerCase();
  if (forced === 'mock') return new MockOcrProvider();
  if (forced === 'local' || forced === 'tesseract' || forced === 'pdf') {
    return new LocalFreeOcrProvider();
  }

  const ocrKey = env.OCR_API_KEY?.trim();
  const openAiKey = env.OPENAI_API_KEY?.trim();

  if (ocrKey && env.OCR_API_URL && !env.OCR_API_URL.includes('openai.com')) {
    return wrapPdfPrefer(new HttpOcrProvider(ocrKey, env.OCR_API_URL));
  }

  if (forced === 'openai' || forced === 'http') {
    if (ocrKey || openAiKey) {
      return wrapPdfPrefer(new OpenAiVisionOcrProvider(ocrKey || openAiKey!));
    }
  }

  if (ocrKey || openAiKey) {
    return wrapPdfPrefer(new OpenAiVisionOcrProvider(ocrKey || openAiKey!));
  }

  // No cloud keys — use free local path when explicitly requested via default override,
  // otherwise keep deterministic mock for CI/demos.
  if (forced === 'auto') return new LocalFreeOcrProvider();
  return new MockOcrProvider();
}
