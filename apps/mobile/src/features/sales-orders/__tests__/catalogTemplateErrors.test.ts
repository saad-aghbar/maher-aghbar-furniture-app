import { translateErrorCode } from '@maher/i18n';

const CODES = [
  'SETUP_LOCKED',
  'WORKFLOW_CHANGE_REQUIRED',
  'CUSTOM_NO_TEMPLATE',
  'NO_CATALOG_PRODUCT',
  'NO_PUBLISHED_WORKFLOW',
  'NETWORK_ERROR',
  'TIMEOUT',
  'VALIDATION_ERROR',
  'WORKFLOW_REQUIRED',
  'SETUP_INCOMPLETE',
] as const;

describe('catalog template human error mapping', () => {
  it.each(CODES)('maps %s to a human sentence in EN/AR/HE', (code) => {
    for (const locale of ['en', 'ar', 'he'] as const) {
      const value = translateErrorCode(locale, code);
      expect(value).toBeTruthy();
      expect(value).not.toBe(code);
      expect(value).not.toMatch(
        /SETUP_LOCKED|WORKFLOW_CHANGE_REQUIRED|CUSTOM_NO_TEMPLATE|NO_CATALOG_PRODUCT|NO_PUBLISHED_WORKFLOW|NETWORK_ERROR|VALIDATION_ERROR|WORKFLOW_REQUIRED|SETUP_INCOMPLETE/,
      );
    }
  });
});
