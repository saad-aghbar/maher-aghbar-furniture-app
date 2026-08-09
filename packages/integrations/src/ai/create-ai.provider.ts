import type { AiProviders } from './types';
import { MockExtractionProvider, MockTranslateProvider } from './mock-ai.provider';
import { OpenAiExtractionProvider, OpenAiTranslateProvider } from './openai-ai.provider';

export function createAiProviders(env: NodeJS.ProcessEnv = process.env): AiProviders {
  const forced = (env.AI_PROVIDER ?? env.AI_LLM_PROVIDER ?? '').toLowerCase();
  const apiKey = env.OPENAI_API_KEY?.trim();

  const useOpenAi =
    forced === 'openai' ||
    ((forced === '' || forced === 'auto') && Boolean(apiKey));

  if (forced === 'mock' || !useOpenAi || !apiKey) {
    if (forced === 'openai' && !apiKey) {
      console.warn('[ai] AI_PROVIDER=openai but OPENAI_API_KEY missing — using mock');
    }
    const translate = new MockTranslateProvider();
    return { translate, extract: new MockExtractionProvider(translate) };
  }

  const translate = new OpenAiTranslateProvider(apiKey);
  return { translate, extract: new OpenAiExtractionProvider(apiKey, translate) };
}
