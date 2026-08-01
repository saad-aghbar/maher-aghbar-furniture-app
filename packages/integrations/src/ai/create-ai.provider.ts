import type { AiProviders } from './types';
import { MockExtractionProvider, MockTranslateProvider } from './mock-ai.provider';
import { OpenAiExtractionProvider, OpenAiTranslateProvider } from './openai-ai.provider';

export function createAiProviders(env: NodeJS.ProcessEnv = process.env): AiProviders {
  const forced = (env.AI_PROVIDER ?? env.AI_LLM_PROVIDER ?? '').toLowerCase();
  const apiKey = env.OPENAI_API_KEY?.trim();

  if (forced === 'mock' || !apiKey) {
    const translate = new MockTranslateProvider();
    return { translate, extract: new MockExtractionProvider(translate) };
  }

  const translate = new OpenAiTranslateProvider(apiKey);
  return { translate, extract: new OpenAiExtractionProvider(apiKey, translate) };
}
