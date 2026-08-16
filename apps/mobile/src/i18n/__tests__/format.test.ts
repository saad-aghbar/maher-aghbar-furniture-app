import {
  compactHoursOfParts,
  compactHoursOfSegments,
  formatCompactHours,
  formatCompactHoursOf,
  formatCurrency,
  formatDate,
  formatDuration,
  formatIdentifier,
  formatMonthYear,
  formatNumber,
  formatPercent,
  formatTime,
  formatTimeRange,
  hasNonLatinDigits,
  isolateLtr,
  parseDisplayDate,
  stripBidiIsolates,
  toClockHm,
  toLatinDigits,
} from '../format';

describe('format', () => {
  const date = new Date('2026-08-05T12:00:00Z');

  it('formats English dates with English months and Latin digits', () => {
    expect(formatDate('en', date)).toMatch(/Aug|August/);
    expect(formatDate('en', date)).toMatch(/2026/);
    expect(hasNonLatinDigits(formatDate('en', date))).toBe(false);
  });

  it('formats Arabic dates with Arabic months and Latin digits', () => {
    const ar = formatDate('ar', date);
    expect(hasNonLatinDigits(ar)).toBe(false);
    expect(ar).toMatch(/أغسطس|اغسطس/);
    expect(ar).not.toMatch(/Aug|August/);
    expect(ar).toMatch(/2026/);
    expect(ar).not.toContain('\u2066');
  });

  it('formats Hebrew dates with Hebrew months, not Arabic months', () => {
    const he = formatDate('he', date);
    expect(hasNonLatinDigits(he)).toBe(false);
    expect(he).not.toMatch(/أغسطس|اغسطس|آب/);
    expect(he).not.toMatch(/Aug|August/);
    expect(he).toMatch(/2026/);
    expect(he).toMatch(/אוג|אב/);
    expect(he).not.toContain('\u2066');
  });

  it('parses bare YMD as a local calendar day', () => {
    const parsed = parseDisplayDate('2026-08-16');
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(7);
    expect(parsed.getDate()).toBe(16);
    expect(formatDate('en', '2026-08-16')).toMatch(/16/);
    expect(formatDate('ar', '2026-08-16')).toMatch(/16/);
  });

  it('formats month/year per locale', () => {
    expect(formatMonthYear('en', 2026, 7)).toMatch(/August 2026/);
    expect(formatMonthYear('ar', 2026, 7)).toMatch(/أغسطس|اغسطس/);
    expect(formatMonthYear('ar', 2026, 7)).not.toMatch(/August/);
    expect(formatMonthYear('he', 2026, 7)).toMatch(/אוג|אב/);
  });

  it('keeps time ranges in chronological order inside RTL isolates', () => {
    const range = formatTimeRange('ar', '10:38', '13:11');
    expect(stripBidiIsolates(range)).toBe('10:38–13:11');
    expect(range.startsWith('\u2066')).toBe(true);
    expect(range.indexOf('10:38')).toBeLessThan(range.indexOf('13:11'));
    expect(formatTimeRange('en', '08:00', '12:00')).toBe('08:00–12:00');
    expect(formatTime('en', '16:00')).toBe('16:00');
    expect(toClockHm('9:05')).toBe('09:05');
  });

  it('keeps PO identifiers intact as LTR islands', () => {
    const id = 'PO-2026-00032';
    expect(stripBidiIsolates(formatIdentifier('ar', id))).toBe(id);
    expect(formatIdentifier('en', id)).toBe(id);
    expect(formatIdentifier('he', id)).toBe(isolateLtr(id));
  });

  it('formats duration plurals in en, ar, and he', () => {
    expect(formatDuration('en', 33)).toBe('33m');
    expect(formatDuration('en', 120)).toBe('2h');
    expect(formatDuration('en', 153)).toBe('2h 33m');
    expect(formatDuration('ar', 1)).toBe('دقيقة واحدة');
    expect(formatDuration('ar', 2)).toBe('دقيقتان');
    expect(formatDuration('ar', 33)).toBe('33 دقيقة');
    expect(formatDuration('ar', 120)).toBe('ساعتان');
    expect(formatDuration('ar', 153)).toBe('ساعتان و33 دقيقة');
    expect(formatDuration('he', 1)).toBe('דקה אחת');
    expect(formatDuration('he', 120)).toBe('שעתיים');
    expect(formatDuration('he', 153)).toContain('שעתיים');
    expect(formatDuration('he', 153)).not.toMatch(/ساعة/);
  });

  it('formats percent and compact hours as stable number+unit groups', () => {
    expect(formatPercent('en', 29)).toBe('29%');
    expect(stripBidiIsolates(formatPercent('ar', 29))).toBe('29٪');
    expect(formatCompactHours('en', 14)).toBe('14h');
    expect(stripBidiIsolates(formatCompactHours('ar', 14))).toMatch(/14/);
    expect(stripBidiIsolates(formatCompactHours('ar', 14))).not.toMatch(/h$/);
    expect(formatCompactHoursOf('en', 0, 7)).toBe('0h / 7h');
    expect(formatCompactHoursOf('ar', 0, 7)).toBe('0 س / 7 س');
    expect(formatCompactHoursOf('he', 0, 7)).toBe('0ש׳ / 7ש׳');
    expect(compactHoursOfParts('en', 14, 7.5)).toMatchObject({
      allocated: '14',
      available: '7.5',
      unit: 'h',
    });
    expect(compactHoursOfParts('ar', 0, 7)).toMatchObject({
      allocated: '0',
      available: '7',
      unit: 'س',
      text: '0 س / 7 س',
    });
    expect(compactHoursOfSegments('ar', 14, 7.5)).toEqual(['14', 'س', '/', '7.5', 'س']);
    expect(compactHoursOfSegments('ar', 6.5, 14)).toEqual(['6.5', 'س', '/', '14', 'س']);
    expect(compactHoursOfSegments('en', 14, 7.5)).toEqual(['14', 'h', '/', '7.5', 'h']);
    expect(compactHoursOfSegments('he', 14, 7.5)).toEqual(['14', 'ש׳', '/', '7.5', 'ש׳']);
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

  it('formats ILS currency with Latin digits', () => {
    const en = formatCurrency('en', 1250.75);
    expect(en).toMatch(/1/);
    expect(hasNonLatinDigits(formatCurrency('ar', 100))).toBe(false);
    expect(hasNonLatinDigits(formatCurrency('he', 100))).toBe(false);
  });
});
