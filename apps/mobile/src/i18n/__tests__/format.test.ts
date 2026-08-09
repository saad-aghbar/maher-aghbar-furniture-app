import {
  formatCurrency,
  formatDate,
  formatNumber,
  hasNonLatinDigits,
  toLatinDigits,
} from '../format';

describe('format', () => {
  const date = new Date('2026-08-05T12:00:00Z');

  it('formats dates in English months with Latin digits for all locales', () => {
    expect(formatDate('en', date)).toMatch(/2026/);
    expect(hasNonLatinDigits(formatDate('ar', date))).toBe(false);
    expect(hasNonLatinDigits(formatDate('he', date))).toBe(false);
    expect(formatDate('ar', date)).toMatch(/Aug|August/);
    expect(formatDate('ar', date)).not.toMatch(/كانون|أغسطس|آب/);
    expect(formatDate('he', date)).not.toMatch(/אוג|אב/);
    expect(formatDate('ar', date)).toMatch(/2026/);
  });

  it('formats numbers per locale with Latin digits only', () => {
    expect(formatNumber('en', 1284.5)).toMatch(/1/);
    expect(hasNonLatinDigits(formatNumber('ar', 1284))).toBe(false);
    expect(hasNonLatinDigits(formatNumber('he', 1284))).toBe(false);
    expect(toLatinDigits('١٢٣')).toBe('123');
  });

  it('keeps Western thousands and decimal separators in Arabic and Hebrew', () => {
    for (const locale of ['ar', 'he', 'en'] as const) {
      const n = formatNumber(locale, 1112.93, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      expect(n).toContain('1,112.93');
      expect(n).not.toMatch(/1\s+112/);
      expect(hasNonLatinDigits(n)).toBe(false);
    }
    const money = formatCurrency('ar', 1112.93);
    expect(money).toMatch(/1,112\.93/);
    expect(money).not.toMatch(/1\s+112\s+93/);
  });

  it('formats JOD currency with Latin digits', () => {
    const en = formatCurrency('en', 1250.75);
    expect(en).toMatch(/1/);
    expect(hasNonLatinDigits(formatCurrency('ar', 100))).toBe(false);
    expect(hasNonLatinDigits(formatCurrency('he', 100))).toBe(false);
  });
});
