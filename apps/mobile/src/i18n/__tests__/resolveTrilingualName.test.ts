import {
  copyTrilingual,
  preserveSourceLocale,
  resolveTrilingualIfChanged,
  resolveTrilingualName,
} from '../resolveTrilingualName';

jest.mock('@/api/modules/catalogAdmin', () => ({
  translateCatalogName: jest.fn(),
}));

import { translateCatalogName } from '@/api/modules/catalogAdmin';

const translate = translateCatalogName as jest.MockedFunction<typeof translateCatalogName>;

describe('resolveTrilingualName', () => {
  beforeEach(() => {
    translate.mockReset();
  });

  it('copies the typed text into every locale when translation fails', async () => {
    translate.mockRejectedValue(new Error('offline'));
    await expect(resolveTrilingualName('Beech lumber', 'en')).resolves.toEqual({
      nameEn: 'Beech lumber',
      nameAr: 'Beech lumber',
      nameHe: 'Beech lumber',
    });
  });

  it('keeps an English source in nameEn', async () => {
    translate.mockResolvedValue({
      nameAr: 'خشب الزان',
      nameEn: 'Oak',
      nameHe: 'אורן',
    });
    await expect(resolveTrilingualName('Beech lumber', 'en')).resolves.toEqual({
      nameEn: 'Beech lumber',
      nameAr: 'خشب الزان',
      nameHe: 'אורן',
    });
    expect(translate).toHaveBeenCalledWith('Beech lumber', 'name', 'en');
  });

  it('keeps stored translations when the visible field did not change', async () => {
    translate.mockRejectedValue(new Error('should not run'));
    await expect(
      resolveTrilingualIfChanged({
        typed: 'كنبة',
        locale: 'ar',
        original: 'كنبة',
        existing: { nameAr: 'كنبة', nameEn: 'Sofa', nameHe: 'ספה' },
      }),
    ).resolves.toEqual({
      nameAr: 'كنبة',
      nameEn: 'Sofa',
      nameHe: 'ספה',
    });
    expect(translate).not.toHaveBeenCalled();
  });

  it('re-translates when the visible field changes', async () => {
    translate.mockResolvedValue({
      nameAr: 'كنبة جديدة',
      nameEn: 'New sofa',
      nameHe: 'ספה חדשה',
    });
    await expect(
      resolveTrilingualIfChanged({
        typed: 'كنبة جديدة',
        locale: 'ar',
        original: 'كنبة',
        existing: { nameAr: 'كنبة', nameEn: 'Sofa', nameHe: 'ספה' },
      }),
    ).resolves.toEqual({
      nameAr: 'كنبة جديدة',
      nameEn: 'New sofa',
      nameHe: 'ספה חדשה',
    });
  });

  it('copies into empty stored locales on an unchanged edit', async () => {
    await expect(
      resolveTrilingualIfChanged({
        typed: 'Karina',
        locale: 'en',
        original: 'Karina',
        existing: { nameEn: 'Karina', nameAr: '', nameHe: null },
      }),
    ).resolves.toEqual({
      nameEn: 'Karina',
      nameAr: 'Karina',
      nameHe: 'Karina',
    });
  });
});

describe('preserveSourceLocale', () => {
  it('never overwrites the typed locale', () => {
    expect(
      preserveSourceLocale('Oak', 'en', {
        nameAr: 'بلوط',
        nameEn: 'Beech',
        nameHe: 'אלון',
      }),
    ).toEqual({
      nameEn: 'Oak',
      nameAr: 'بلوط',
      nameHe: 'אלון',
    });
  });

  it('falls back to the typed text when a translation is blank', () => {
    expect(copyTrilingual('  Oak  ')).toEqual({
      nameEn: 'Oak',
      nameAr: 'Oak',
      nameHe: 'Oak',
    });
  });
});
