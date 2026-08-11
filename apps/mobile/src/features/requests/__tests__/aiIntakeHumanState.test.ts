import {
  assertDealerAiStateKeysAreHuman,
  aiStateMessageKey,
  containsTechnicalAiJargon,
  DEALER_AI_STATE_I18N_KEYS,
  previewNeedsInfo,
} from '../aiIntakeHumanState';

describe('aiIntakeHumanState', () => {
  it('exposes only human state keys without technical jargon', () => {
    expect(() => assertDealerAiStateKeysAreHuman()).not.toThrow();
    for (const key of DEALER_AI_STATE_I18N_KEYS) {
      expect(containsTechnicalAiJargon(key)).toBe(false);
      expect(key).not.toMatch(/ocr|token|llm|gpt|extract|embedding|prompt/i);
    }
  });

  it('maps states to dealer i18n keys', () => {
    expect(aiStateMessageKey('idle')).toBeNull();
    expect(aiStateMessageKey('uploading')).toBe('mobile.newOrder.aiStates.uploading');
    expect(aiStateMessageKey('preparing')).toBe('mobile.newOrder.aiStates.preparing');
    expect(aiStateMessageKey('needsInfo')).toBe('mobile.newOrder.aiStates.needsInfo');
  });

  it('flags empty previews as needs info', () => {
    expect(previewNeedsInfo({})).toBe(true);
    expect(previewNeedsInfo({ productName: '  ' })).toBe(true);
    expect(previewNeedsInfo({ productName: 'Sofa' })).toBe(false);
    expect(previewNeedsInfo({ quantity: '2' })).toBe(false);
  });

  it('detects technical jargon in copy', () => {
    expect(containsTechnicalAiJargon('Reading…')).toBe(false);
    expect(containsTechnicalAiJargon('Running OCR now')).toBe(true);
    expect(containsTechnicalAiJargon('token usage high')).toBe(true);
  });
});
