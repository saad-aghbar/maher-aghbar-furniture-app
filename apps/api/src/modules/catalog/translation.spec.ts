import { TranslationService } from './translation.service';
import type { TranslateProvider } from '@maher/integrations';

function mockTranslate(overrides: Partial<TranslateProvider> = {}): TranslateProvider {
  return {
    name: 'mock',
    translate: async (text) => `EN ${text}`,
    suggestNameTranslations: async (name) => ({
      nameAr: name,
      nameEn: `EN ${name}`,
      nameHe: `HE ${name}`,
    }),
    ...overrides,
  };
}

describe('TranslationService', () => {
  it('fills English from Arabic when English is blank', async () => {
    const service = new TranslationService(mockTranslate());
    expect(await service.fillEnglishName('كرينا', '')).toBe('EN كرينا');
    expect(await service.fillEnglishName('كرينا', 'Karina')).toBe('Karina');
  });

  it('leaves English empty when the provider throws', async () => {
    const service = new TranslationService(
      mockTranslate({
        suggestNameTranslations: async () => {
          throw new Error('offline');
        },
        translate: async () => {
          throw new Error('offline');
        },
      }),
    );
    expect(await service.fillEnglishName('كرينا', '')).toBe('');
    expect(await service.fillEnglishProse('لف بسيط', '')).toBe('');
  });

  it('translates factory-note prose', async () => {
    const service = new TranslationService(mockTranslate());
    expect(await service.fillEnglishProse('لف بسيط', '')).toBe('EN لف بسيط');
  });

  it('keeps an English source in nameEn instead of stuffing it into nameAr', async () => {
    const service = new TranslationService(mockTranslate());
    expect(await service.translateName('Beech lumber', 'en')).toEqual({
      nameAr: 'Beech lumber',
      nameEn: 'Beech lumber',
      nameHe: 'HE Beech lumber',
    });
  });

  it('fills every locale for prose from a Hebrew source', async () => {
    const service = new TranslationService(
      mockTranslate({
        translate: async (text, _from, to) => `${to}:${text}`,
      }),
    );
    expect(await service.translateProseAll('כיסא', 'he')).toEqual({
      nameAr: 'ar:כיסא',
      nameEn: 'en:כיסא',
      nameHe: 'כיסא',
    });
  });
});
