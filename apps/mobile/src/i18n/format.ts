import type { Locale } from '@maher/types';
import { DEFAULT_CURRENCY } from '@maher/types';
import { translate, translatePlural } from './translate';

/**
 * Numbers/currency always use Western grouping + decimal (1,112.93) with Latin
 * digits. Arabic/Hebrew UI locales must not switch to space / Arabic separators
 * (RN/ICU often renders those as blank gaps: "1 112 93").
 */
const NUMBER_LOCALE = 'en-JO-u-nu-latn';

/** English-only calendar labels (search indexing, machine strings). */
const DATE_LOCALE_EN = 'en-GB-u-nu-latn';

const BARE_YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
const CLOCK_HM = /^(\d{1,2}):(\d{2})$/;
const RANGE_DASH = '\u2013';

/** Arabic-Indic + Extended Arabic-Indic → ASCII 0–9 (safety net). */
const NON_LATIN_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/g;

/** Bidi marks + exotic spaces that Intl may inject around currency. */
const BIDI_AND_ODD_SPACE = /[\u200E\u200F\u202A-\u202E\u2066-\u2069\u00A0\u202F]/g;

export function toLatinDigits(input: string): string {
  return input.replace(NON_LATIN_DIGITS, (ch) => {
    const code = ch.charCodeAt(0);
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    return String(code - 0x06f0);
  });
}

export function hasNonLatinDigits(input: string): boolean {
  return /[\u0660-\u0669\u06F0-\u06F9]/.test(input);
}

/**
 * Force ASCII thousands `,` and decimal `.` after locale formatting.
 * Safety net for Arabic separators / space-grouping from some ICUs.
 */
export function toWesternNumberSeparators(input: string): string {
  return input
    .replace(/[\u066B٫]/g, '.')
    .replace(/[\u066C٬]/g, ',')
    .replace(/(\d)[\u00A0\u202F\u2009 ](?=\d{3}(?:\D|$))/g, '$1,')
    .replace(BIDI_AND_ODD_SPACE, ' ')
    .replace(/ +/g, ' ')
    .trim();
}

/**
 * LTR isolate so Latin numerals / identifiers / time ranges don’t reverse
 * inside RTL paragraphs. Use only for Latin-only runs — never wrap Arabic or
 * Hebrew month names. Visual placement still follows the parent’s textAlign.
 */
export function isolateLtr(text: string): string {
  return `\u2066${text}\u2069`;
}

export function stripBidiIsolates(text: string): string {
  return text.replace(/[\u2066-\u2069]/g, '');
}

function finalizeNumericText(locale: Locale, text: string): string {
  const latin = toWesternNumberSeparators(toLatinDigits(text));
  if (locale === 'ar' || locale === 'he') return isolateLtr(latin);
  return latin;
}

/** Latin digits, no LRI — for native-script dates (Arabic/Hebrew months). */
function finalizeLocalizedDate(text: string): string {
  return toWesternNumberSeparators(toLatinDigits(text));
}

function dateTimeLocaleTag(locale: Locale): string {
  if (locale === 'ar') return 'ar-u-nu-latn';
  if (locale === 'he') return 'he-u-nu-latn';
  return DATE_LOCALE_EN;
}

/** Bare YYYY-MM-DD is a factory calendar day, not UTC midnight. */
export function parseDisplayDate(value: Date | string | number): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  const trimmed = String(value).trim();
  const ymd = BARE_YMD.exec(trimmed);
  if (ymd) {
    return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  }
  return new Date(trimmed);
}

function maybeRtlIsolate(locale: Locale, text: string): string {
  const latin = toLatinDigits(text);
  return locale === 'ar' || locale === 'he' ? isolateLtr(latin) : latin;
}

/** Always English months + Latin digits. For call sites without Locale. */
export function formatDateLatn(value: Date | string | number): string {
  const date = parseDisplayDate(value);
  return toLatinDigits(
    new Intl.DateTimeFormat(DATE_LOCALE_EN, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      numberingSystem: 'latn',
    }).format(date),
  );
}

/**
 * Gregorian date with locale month names and Latin digits.
 * EN: 15 Aug 2026. AR: 15 أغسطس 2026. HE: Hebrew month names.
 * Do not LRI-wrap the whole string — native-script months must stay RTL.
 */
export function formatDate(locale: Locale, value: Date | string | number): string {
  const date = parseDisplayDate(value);
  const raw = new Intl.DateTimeFormat(dateTimeLocaleTag(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    numberingSystem: 'latn',
  }).format(date);
  return finalizeLocalizedDate(raw);
}

/**
 * Inclusive calendar range in the same family as invoice dates.
 * EN: 1 Aug 2026 – 30 Aug 2026. Never ISO and never ASCII `->`.
 * Chronological start–end; RTL screens reverse the row, not the string.
 */
export function formatDateRange(
  locale: Locale,
  start: Date | string | number,
  end: Date | string | number,
): string {
  const a = formatDate(locale, start);
  const b = formatDate(locale, end);
  if (!a && !b) return '';
  if (!b) return a;
  if (!a) return b;
  return `${a} ${RANGE_DASH} ${b}`;
}

export function dateRangeParts(
  locale: Locale,
  start: Date | string | number,
  end: Date | string | number,
): { start: string; dash: string; end: string } {
  return {
    start: formatDate(locale, start),
    dash: RANGE_DASH,
    end: formatDate(locale, end),
  };
}

export function formatDateTime(locale: Locale, value: Date | string | number): string {
  const date = parseDisplayDate(value);
  const raw = new Intl.DateTimeFormat(dateTimeLocaleTag(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    numberingSystem: 'latn',
  }).format(date);
  return finalizeLocalizedDate(raw);
}

export function formatMonthYear(locale: Locale, year: number, monthIndex: number): string {
  const raw = new Intl.DateTimeFormat(dateTimeLocaleTag(locale), {
    month: 'long',
    year: 'numeric',
    numberingSystem: 'latn',
  }).format(new Date(year, monthIndex, 1));
  return finalizeLocalizedDate(raw);
}

/** 24h `HH:mm` from an ISO instant, Date, or already-clock string. Latin digits. */
export function toClockHm(value: Date | string): string {
  if (typeof value === 'string') {
    const hm = CLOCK_HM.exec(value.trim());
    if (hm) return `${hm[1]!.padStart(2, '0')}:${hm[2]}`;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    numberingSystem: 'latn',
  }).format(date);
}

export function formatTime(locale: Locale, value: Date | string): string {
  const hm = toClockHm(value);
  if (!hm) return '';
  return maybeRtlIsolate(locale, hm);
}

/**
 * Chronological start–end as one Latin run so RTL cannot swap the clocks.
 * Example: 10:38–13:11
 */
export function formatTimeRange(
  locale: Locale,
  start: Date | string,
  end: Date | string,
): string {
  const a = toClockHm(start);
  const b = toClockHm(end);
  if (!a && !b) return '';
  if (!b) return maybeRtlIsolate(locale, a);
  if (!a) return maybeRtlIsolate(locale, b);
  return maybeRtlIsolate(locale, `${a}${RANGE_DASH}${b}`);
}

/** Machine identifiers (PO-2026-00032). Exact Latin spelling, LTR-isolated in RTL. */
export function formatIdentifier(locale: Locale, id: string): string {
  const raw = id.trim();
  if (!raw) return '';
  return maybeRtlIsolate(locale, raw);
}

export function formatPercent(locale: Locale, value: number): string {
  const n = toWesternNumberSeparators(toLatinDigits(String(Math.round(value))));
  const raw = locale === 'ar' ? `${n}٪` : `${n}%`;
  return maybeRtlIsolate(locale, raw);
}

/** Keep number+unit together (14h / 14 س) via existing i18n unit keys. */
export function formatCompactHours(locale: Locale, hours: string | number): string {
  const raw = translate(locale, 'mobile.adminScheduling.capacity.hours', { hours: String(hours) });
  return maybeRtlIsolate(locale, raw);
}

export type CompactHoursOfParts = {
  allocated: string;
  available: string;
  unit: string;
  text: string;
};

/** Visual child order for a capacity pair. Never render `text` as one RTL Text. */
export type CompactHoursOfSegments = [string, string, string, string, string];

export function compactHoursOfParts(
  locale: Locale,
  allocated: string | number,
  available: string | number,
): CompactHoursOfParts {
  const a = toLatinDigits(String(allocated));
  const b = toLatinDigits(String(available));
  if (locale === 'en') {
    return { allocated: a, available: b, unit: 'h', text: `${a}h / ${b}h` };
  }
  if (locale === 'he') {
    return { allocated: a, available: b, unit: 'ש׳', text: `${a}ש׳ / ${b}ש׳` };
  }
  return { allocated: a, available: b, unit: 'س', text: `${a} س / ${b} س` };
}

export function compactHoursOfSegments(
  locale: Locale,
  allocated: string | number,
  available: string | number,
): CompactHoursOfSegments {
  const { allocated: a, available: b, unit } = compactHoursOfParts(locale, allocated, available);
  return [a, unit, '/', b, unit];
}

export function formatCompactHoursOf(
  locale: Locale,
  allocated: string | number,
  available: string | number,
): string {
  return compactHoursOfParts(locale, allocated, available).text;
}

/**
 * Overlap / elapsed duration. EN stays `2h 33m`. AR uses plural phrases
 * (دقيقة واحدة / ساعتان و33 دقيقة). HE uses Hebrew forms, not Arabic.
 */
export function formatDuration(locale: Locale, totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (hours <= 0) {
    return translatePlural(locale, 'mobile.adminScheduling.duration.minutes', minutes, { minutes });
  }
  if (minutes <= 0) {
    return translatePlural(locale, 'mobile.adminScheduling.duration.hours', hours, { hours });
  }
  const hoursPart = translatePlural(locale, 'mobile.adminScheduling.duration.hours', hours, { hours });
  const minutesPart = translatePlural(locale, 'mobile.adminScheduling.duration.minutes', minutes, {
    minutes,
  });
  return translate(locale, 'mobile.adminScheduling.duration.hoursAndMinutes', {
    hours: hoursPart,
    minutes: minutesPart,
  });
}

export function formatNumber(
  locale: Locale,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  const raw = new Intl.NumberFormat(NUMBER_LOCALE, {
    numberingSystem: 'latn',
    ...options,
  }).format(value);
  return finalizeNumericText(locale, raw);
}

/** ILS — Israeli Shekel (shared ERP currency). Always Western separators. */
export function formatCurrency(locale: Locale, value: number, currency = DEFAULT_CURRENCY): string {
  const raw = new Intl.NumberFormat(NUMBER_LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    numberingSystem: 'latn',
  }).format(value);
  return finalizeNumericText(locale, raw);
}
