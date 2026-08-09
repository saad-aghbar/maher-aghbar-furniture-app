import { resolveArabicTextMetrics } from '../fonts';

describe('resolveArabicTextMetrics', () => {
  it('is a no-op for non-Arabic locales', () => {
    expect(
      resolveArabicTextMetrics('en', { fontSize: 34, lineHeight: 40 }),
    ).toBeUndefined();
  });

  it('raises tight hero money line boxes used on invoice boards', () => {
    const next = resolveArabicTextMetrics('ar', {
      fontSize: 34,
      lineHeight: 40,
    });
    expect(next?.lineHeight).toBeGreaterThanOrEqual(Math.ceil(34 * 1.5));
    expect(next?.paddingTop).toBeGreaterThanOrEqual(2);
  });

  it('still adds top padding when lineHeight already looks generous', () => {
    const next = resolveArabicTextMetrics('ar', {
      fontSize: 11,
      lineHeight: 18,
    });
    expect(next?.lineHeight).toBeUndefined();
    expect(next?.paddingTop).toBeGreaterThanOrEqual(2);
  });

  it('does not shrink an explicit larger paddingTop', () => {
    const next = resolveArabicTextMetrics('ar', {
      fontSize: 22,
      lineHeight: 40,
      paddingTop: 12,
    });
    expect(next?.paddingTop).toBeUndefined();
  });
});
