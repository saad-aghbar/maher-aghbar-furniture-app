import type { Locale } from '@maher/types';
import { DEFAULT_CURRENCY } from '@maher/types';

/**
 * Numbers/currency always use Western grouping + decimal (1,112.93) with Latin
 * digits. Arabic/Hebrew UI locales must not switch to space / Arabic separators
 * (RN/ICU often renders those as blank gaps: "1 112 93").
 */
const NUMBER_LOCALE = 'en-JO-u-nu-latn';

/** Fixed English calendar labels for every UI language. */
const DATE_LOCALE = 'en-GB-u-nu-latn';

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
 * LTR isolate so Latin numerals / dates don’t mirror inside RTL paragraphs.
 * Visual placement still follows the parent’s textAlign (right in Arabic).
 */
export function isolateLtr(text: string): string {
  return `\u2066${text}\u2069`;
}

function finalizeNumericText(locale: Locale, text: string): string {
  const latin = toWesternNumberSeparators(toLatinDigits(text));
  if (locale === 'ar' || locale === 'he') return isolateLtr(latin);
  return latin;
}

/** Always English months + Latin digits. For call sites without Locale. */
export function formatDateLatn(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  return toLatinDigits(
    new Intl.DateTimeFormat(DATE_LOCALE, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      numberingSystem: 'latn',
    }).format(date),
  );
}

/** Calendar dates always render in English (e.g. 5 Aug 2026), even in ar/he UI. */
export function formatDate(locale: Locale, value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  const raw = new Intl.DateTimeFormat(DATE_LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    numberingSystem: 'latn',
  }).format(date);
  return finalizeNumericText(locale, raw);
}

export function formatDateTime(locale: Locale, value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  const raw = new Intl.DateTimeFormat(DATE_LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    numberingSystem: 'latn',
  }).format(date);
  return finalizeNumericText(locale, raw);
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

/** JOD — Jordanian Dinar (shared ERP currency). Always Western separators. */
export function formatCurrency(locale: Locale, value: number, currency = DEFAULT_CURRENCY): string {
  const raw = new Intl.NumberFormat(NUMBER_LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
    numberingSystem: 'latn',
  }).format(value);
  return finalizeNumericText(locale, raw);
}
