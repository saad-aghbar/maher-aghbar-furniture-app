import {
  PLEX_ARABIC,
  PLEX_HEBREW,
  PLEX_LATIN,
  applyAppTypeface,
  resolveAppFontFamily,
  resolveAppFontStyle,
} from '../fonts';

describe('resolveAppFontFamily', () => {
  it('uses Plex Arabic 1:1 for Arabic', () => {
    expect(resolveAppFontFamily('ar', { weight: 'regular' })).toBe(PLEX_ARABIC.regular);
    expect(resolveAppFontFamily('ar', { weight: 'medium' })).toBe(PLEX_ARABIC.medium);
    expect(resolveAppFontFamily('ar', { weight: 'semibold' })).toBe(PLEX_ARABIC.semibold);
  });

  it('uses Plex Sans 1:1 for English and Plex Hebrew 1:1 for Hebrew', () => {
    expect(resolveAppFontFamily('en', { weight: 'regular' })).toBe(PLEX_LATIN.regular);
    expect(resolveAppFontFamily('en', { weight: 'medium' })).toBe(PLEX_LATIN.medium);
    expect(resolveAppFontFamily('en', { weight: 'semibold' })).toBe(PLEX_LATIN.semibold);
    expect(resolveAppFontFamily('he', { weight: 'regular' })).toBe(PLEX_HEBREW.regular);
    expect(resolveAppFontFamily('he', { weight: 'medium' })).toBe(PLEX_HEBREW.medium);
    expect(resolveAppFontFamily('he', { weight: 'semibold' })).toBe(PLEX_HEBREW.semibold);
  });

  it('maps display variants to medium without Arabic softening', () => {
    expect(resolveAppFontFamily('ar', { variant: 'title' })).toBe(PLEX_ARABIC.medium);
    expect(resolveAppFontFamily('en', { variant: 'title' })).toBe(PLEX_LATIN.medium);
    expect(resolveAppFontFamily('he', { variant: 'heading' })).toBe(PLEX_HEBREW.medium);
  });
});

describe('resolveAppFontStyle', () => {
  it('zeros tracking only for Arabic', () => {
    expect(resolveAppFontStyle('ar', { weight: 'regular' })).toEqual({
      fontFamily: PLEX_ARABIC.regular,
      letterSpacing: 0,
    });
    expect(resolveAppFontStyle('en', { weight: 'medium' })).toEqual({
      fontFamily: PLEX_LATIN.medium,
    });
    expect(resolveAppFontStyle('he', { weight: 'semibold' })).toEqual({
      fontFamily: PLEX_HEBREW.semibold,
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
  it('maps numeric fontWeight onto Plex files and strips fontWeight', () => {
    const next = applyAppTypeface('en', { fontSize: 15, fontWeight: '600' });
    expect(next.fontFamily).toBe(PLEX_LATIN.semibold);
    expect(next.fontWeight).toBeUndefined();
    expect(next.fontSize).toBe(15);
  });

  it('lets AppText weight win over a caller fontWeight', () => {
    const next = applyAppTypeface(
      'en',
      { fontWeight: '400', color: '#111' },
      { weight: 'semibold' },
    );
    expect(next.fontFamily).toBe(PLEX_LATIN.semibold);
    expect(next.fontWeight).toBeUndefined();
  });

  it('keeps Courier for monospace codes', () => {
    const next = applyAppTypeface('en', { fontFamily: 'Courier', fontSize: 11 });
    expect(next.fontFamily).toBe('Courier');
  });

  it('maps a heavy system weight onto Plex Arabic SemiBold', () => {
    const next = applyAppTypeface('ar', { fontWeight: '600' });
    expect(next.fontFamily).toBe(PLEX_ARABIC.semibold);
    expect(next.letterSpacing).toBe(0);
    expect(next.fontWeight).toBeUndefined();
  });

  it('keeps the locale face when face=latin is passed (no-op)', () => {
    const next = applyAppTypeface('ar', { fontSize: 12 }, { face: 'latin', weight: 'semibold' });
    expect(next.fontFamily).toBe(PLEX_ARABIC.semibold);
  });
});
