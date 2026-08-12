import {
  KO_SANS,
  RUBIK,
  applyAppTypeface,
  resolveAppFontFamily,
  resolveAppFontStyle,
} from '../fonts';

describe('resolveAppFontFamily', () => {
  it('uses softened KO Sans for Arabic', () => {
    expect(resolveAppFontFamily('ar', { weight: 'regular' })).toBe(KO_SANS.regular);
    expect(resolveAppFontFamily('ar', { weight: 'medium' })).toBe(KO_SANS.regular);
    expect(resolveAppFontFamily('ar', { weight: 'semibold' })).toBe(KO_SANS.medium);
  });

  it('uses Rubik 1:1 for English and Hebrew', () => {
    expect(resolveAppFontFamily('en', { weight: 'regular' })).toBe(RUBIK.regular);
    expect(resolveAppFontFamily('en', { weight: 'medium' })).toBe(RUBIK.medium);
    expect(resolveAppFontFamily('en', { weight: 'semibold' })).toBe(RUBIK.semibold);
    expect(resolveAppFontFamily('he', { weight: 'regular' })).toBe(RUBIK.regular);
    expect(resolveAppFontFamily('he', { weight: 'medium' })).toBe(RUBIK.medium);
    expect(resolveAppFontFamily('he', { weight: 'semibold' })).toBe(RUBIK.semibold);
  });

  it('maps display variants to medium before Arabic softening', () => {
    expect(resolveAppFontFamily('ar', { variant: 'title' })).toBe(KO_SANS.regular);
    expect(resolveAppFontFamily('en', { variant: 'title' })).toBe(RUBIK.medium);
    expect(resolveAppFontFamily('he', { variant: 'heading' })).toBe(RUBIK.medium);
  });
});

describe('resolveAppFontStyle', () => {
  it('zeros tracking only for Arabic', () => {
    expect(resolveAppFontStyle('ar', { weight: 'regular' })).toEqual({
      fontFamily: KO_SANS.regular,
      letterSpacing: 0,
    });
    expect(resolveAppFontStyle('en', { weight: 'medium' })).toEqual({
      fontFamily: RUBIK.medium,
    });
    expect(resolveAppFontStyle('he', { weight: 'semibold' })).toEqual({
      fontFamily: RUBIK.semibold,
    });
  });

  it('never sets fontWeight alongside a custom family', () => {
    const ar = resolveAppFontStyle('ar', { systemWeight: '600' });
    const en = resolveAppFontStyle('en', { systemWeight: '600' });
    expect(ar.fontWeight).toBeUndefined();
    expect(en.fontWeight).toBeUndefined();
  });
});

describe('applyAppTypeface', () => {
  it('maps numeric fontWeight onto Rubik files and strips fontWeight', () => {
    const next = applyAppTypeface('en', { fontSize: 15, fontWeight: '600' });
    expect(next.fontFamily).toBe(RUBIK.semibold);
    expect(next.fontWeight).toBeUndefined();
    expect(next.fontSize).toBe(15);
  });

  it('lets AppText weight win over a caller fontWeight', () => {
    const next = applyAppTypeface(
      'en',
      { fontWeight: '400', color: '#111' },
      { weight: 'semibold' },
    );
    expect(next.fontFamily).toBe(RUBIK.semibold);
    expect(next.fontWeight).toBeUndefined();
  });

  it('keeps Courier for monospace codes', () => {
    const next = applyAppTypeface('en', { fontFamily: 'Courier', fontSize: 11 });
    expect(next.fontFamily).toBe('Courier');
  });

  it('softens Arabic after mapping a heavy system weight', () => {
    const next = applyAppTypeface('ar', { fontWeight: '600' });
    expect(next.fontFamily).toBe(KO_SANS.medium);
    expect(next.letterSpacing).toBe(0);
    expect(next.fontWeight).toBeUndefined();
  });
});
