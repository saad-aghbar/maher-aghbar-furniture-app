import { translate } from '@/i18n/translate';
import {
  containsTechnicalAiJargon,
  DEALER_AI_STATE_I18N_KEYS,
} from '@/features/requests/aiIntakeHumanState';

describe('newOrder dealer AI i18n', () => {
  const stepKeys = [
    'mobile.newOrder.steps.product',
    'mobile.newOrder.steps.details',
    'mobile.newOrder.steps.customer',
    'mobile.newOrder.steps.attachments',
    'mobile.newOrder.step1Title',
    'mobile.newOrder.step2Title',
    'mobile.newOrder.step3Title',
    'mobile.newOrder.step4Title',
    'mobile.newOrder.step4ReviewTitle',
    'mobile.newOrder.attachmentsSection',
  ] as const;

  for (const locale of ['en', 'ar', 'he'] as const) {
    it(`resolves 4-step and AI state keys in ${locale}`, () => {
      for (const key of stepKeys) {
        const value = translate(locale, key);
        expect(value).toBeTruthy();
        expect(value).not.toBe(key);
      }
      for (const state of DEALER_AI_STATE_I18N_KEYS) {
        const key = `mobile.newOrder.aiStates.${state}`;
        const value = translate(locale, key);
        expect(value).toBeTruthy();
        expect(value).not.toBe(key);
        expect(containsTechnicalAiJargon(key)).toBe(false);
        expect(containsTechnicalAiJargon(value)).toBe(false);
      }
    });
  }
});
