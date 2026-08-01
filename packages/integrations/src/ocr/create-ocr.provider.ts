import type { OcrProvider } from './types';
import { MockOcrProvider } from './mock-ocr.provider';
import { OpenAiVisionOcrProvider } from './openai-vision-ocr.provider';
import { HttpOcrProvider } from './http-ocr.provider';

export function createOcrProvider(env: NodeJS.ProcessEnv = process.env): OcrProvider {
  const forced = (env.OCR_PROVIDER ?? env.AI_OCR_PROVIDER ?? '').toLowerCase();
  if (forced === 'mock') return new MockOcrProvider();

  const ocrKey = env.OCR_API_KEY?.trim();
  const openAiKey = env.OPENAI_API_KEY?.trim();

  if (ocrKey && env.OCR_API_URL && !env.OCR_API_URL.includes('openai.com')) {
    return new HttpOcrProvider(ocrKey, env.OCR_API_URL);
  }

  if (ocrKey || openAiKey) {
    return new OpenAiVisionOcrProvider(ocrKey || openAiKey!);
  }

  return new MockOcrProvider();
}
