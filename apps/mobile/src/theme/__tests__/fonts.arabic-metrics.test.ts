import { resolveArabicTextMetrics } from '../fonts';

describe('resolveArabicTextMetrics', () => {
  it('is a no-op for non-Arabic locales', () => {
    expect(
      resolveArabicTextMetrics('en', { fontSize: 34, lineHeight: 40 }),
    ).toBeUndefined();
    expect(
      resolveArabicTextMetrics('he', { fontSize: 34, lineHeight: 40 }),
    ).toBeUndefined();
  });

  it('raises only extremely tight hero money line boxes', () => {
    const next = resolveArabicTextMetrics('ar', {
      fontSize: 34,
      lineHeight: 36,
    });
    expect(next?.lineHeight).toBeGreaterThanOrEqual(Math.ceil(34 * 1.2));
  });

  it('leaves a normal 1.2+ line box alone', () => {
    const next = resolveArabicTextMetrics('ar', {
      fontSize: 11,
      lineHeight: 18,
    });
    expect(next?.lineHeight).toBeUndefined();
    expect(next?.paddingTop).toBeUndefined();
  });

  it('does not inject paddingTop', () => {
    const next = resolveArabicTextMetrics('ar', {
      fontSize: 22,
      lineHeight: 40,
    });
    expect(next?.paddingTop).toBeUndefined();
  });
});
