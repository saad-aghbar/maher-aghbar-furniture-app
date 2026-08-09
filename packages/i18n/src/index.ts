import type { Direction, Locale } from '@maher/types';
import { LOCALE_DIRECTION } from '@maher/types';

import arCommon from './messages/ar/common.json';
import arAuth from './messages/ar/auth.json';
import arCustomers from './messages/ar/customers.json';
import arQuotations from './messages/ar/quotations.json';
import arSales from './messages/ar/sales.json';
import arProduction from './messages/ar/production.json';
import arInventory from './messages/ar/inventory.json';
import arAccounting from './messages/ar/accounting.json';
import arNavigation from './messages/ar/navigation.json';
import arValidation from './messages/ar/validation.json';
import arUsers from './messages/ar/users.json';
import arStatuses from './messages/ar/statuses.json';
import arCatalog from './messages/ar/catalog.json';
import arMobile from './messages/ar/mobile.json';
import arErrors from './messages/ar/errors.json';

import enCommon from './messages/en/common.json';
import enAuth from './messages/en/auth.json';
import enCustomers from './messages/en/customers.json';
import enQuotations from './messages/en/quotations.json';
import enSales from './messages/en/sales.json';
import enProduction from './messages/en/production.json';
import enInventory from './messages/en/inventory.json';
import enAccounting from './messages/en/accounting.json';
import enNavigation from './messages/en/navigation.json';
import enValidation from './messages/en/validation.json';
import enUsers from './messages/en/users.json';
import enStatuses from './messages/en/statuses.json';
import enCatalog from './messages/en/catalog.json';
import enMobile from './messages/en/mobile.json';
import enErrors from './messages/en/errors.json';

import heCommon from './messages/he/common.json';
import heAuth from './messages/he/auth.json';
import heCustomers from './messages/he/customers.json';
import heQuotations from './messages/he/quotations.json';
import heSales from './messages/he/sales.json';
import heProduction from './messages/he/production.json';
import heInventory from './messages/he/inventory.json';
import heAccounting from './messages/he/accounting.json';
import heNavigation from './messages/he/navigation.json';
import heValidation from './messages/he/validation.json';
import heUsers from './messages/he/users.json';
import heStatuses from './messages/he/statuses.json';
import heCatalog from './messages/he/catalog.json';
import heMobile from './messages/he/mobile.json';
import heErrors from './messages/he/errors.json';

export const locales = ['ar', 'en', 'he'] as const satisfies readonly Locale[];
export const defaultLocale: Locale = 'ar';

export type MessageNamespace =
  | 'common'
  | 'auth'
  | 'customers'
  | 'quotations'
  | 'sales'
  | 'production'
  | 'inventory'
  | 'accounting'
  | 'navigation'
  | 'validation'
  | 'users'
  | 'statuses'
  | 'catalog'
  | 'mobile'
  | 'errors';

export type MessageValue = string | { [key: string]: MessageValue };
export type Messages = Record<MessageNamespace, Record<string, MessageValue>>;

const messagesByLocale: Record<Locale, Messages> = {
  ar: {
    common: arCommon,
    auth: arAuth,
    customers: arCustomers,
    quotations: arQuotations,
    sales: arSales,
    production: arProduction,
    inventory: arInventory,
    accounting: arAccounting,
    navigation: arNavigation,
    validation: arValidation,
    users: arUsers,
    statuses: arStatuses,
    catalog: arCatalog,
    mobile: arMobile,
    errors: arErrors,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    customers: enCustomers,
    quotations: enQuotations,
    sales: enSales,
    production: enProduction,
    inventory: enInventory,
    accounting: enAccounting,
    navigation: enNavigation,
    validation: enValidation,
    users: enUsers,
    statuses: enStatuses,
    catalog: enCatalog,
    mobile: enMobile,
    errors: enErrors,
  },
  he: {
    common: heCommon,
    auth: heAuth,
    customers: heCustomers,
    quotations: heQuotations,
    sales: heSales,
    production: heProduction,
    inventory: heInventory,
    accounting: heAccounting,
    navigation: heNavigation,
    validation: heValidation,
    users: heUsers,
    statuses: heStatuses,
    catalog: heCatalog,
    mobile: heMobile,
    errors: heErrors,
  },
};

export function getDirection(locale: Locale): Direction {
  return LOCALE_DIRECTION[locale];
}

export function getMessages(locale: Locale): Messages {
  return messagesByLocale[locale] ?? messagesByLocale[defaultLocale];
}

export function isValidLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function flattenMessages(messages: Messages): Record<string, Record<string, MessageValue>> {
  return Object.fromEntries(
    Object.entries(messages).map(([namespace, entries]) => [namespace, entries]),
  );
}

export type LocalizedNamed = {
  name?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
  titleAr?: string | null;
  titleEn?: string | null;
  titleHe?: string | null;
  bodyAr?: string | null;
  bodyEn?: string | null;
  bodyHe?: string | null;
};

/** Pick the display name for the active locale. Codes/SKUs stay Latin; only human labels localize. */
export function localizedName(
  locale: string,
  row: LocalizedNamed | null | undefined,
  fallback = '—',
): string {
  if (!row) return fallback || '—';
  if (locale === 'ar') {
    return (
      row.nameAr ||
      row.titleAr ||
      row.name ||
      fallback ||
      row.nameEn ||
      row.titleEn ||
      row.nameHe ||
      row.titleHe ||
      '—'
    );
  }
  if (locale === 'he') {
    return (
      row.nameHe ||
      row.titleHe ||
      row.name ||
      fallback ||
      row.nameEn ||
      row.titleEn ||
      row.nameAr ||
      row.titleAr ||
      '—'
    );
  }
  // English (and unknown): prefer English fields, then caller fallback, before other locales.
  return (
    row.nameEn ||
    row.titleEn ||
    row.name ||
    fallback ||
    row.nameAr ||
    row.titleAr ||
    row.nameHe ||
    row.titleHe ||
    '—'
  );
}

export function localizedBody(
  locale: string,
  row: LocalizedNamed | null | undefined,
  fallback = '',
): string {
  if (!row) return fallback;
  if (locale === 'ar') return row.bodyAr || row.bodyEn || row.bodyHe || fallback;
  if (locale === 'he') return row.bodyHe || row.bodyEn || row.bodyAr || fallback;
  return row.bodyEn || row.bodyAr || row.bodyHe || fallback;
}

export function statusLabel(locale: string, status: string): string {
  const typed = isValidLocale(locale) ? locale : defaultLocale;
  const map = getMessages(typed).statuses;
  const value = map[status];
  return typeof value === 'string' ? value : status.replace(/_/g, ' ');
}

/** Translate an API error code for the active locale (falls back to English message). */
export function translateErrorCode(
  locale: string,
  code: string | null | undefined,
  fallbackMessage?: string | null,
): string {
  const typed = isValidLocale(locale) ? locale : defaultLocale;
  const map = getMessages(typed).errors;
  if (code) {
    const value = map[code];
    if (typeof value === 'string' && value.trim()) return value;
  }
  if (fallbackMessage?.trim()) return fallbackMessage;
  const generic = map.REQUEST_FAILED;
  return typeof generic === 'string' ? generic : 'Request failed';
}

/**
 * Resolve a thrown API/client error to a localized user-facing string.
 * Prefers `error.code` from the API body; otherwise uses message / fallback.
 * When fieldErrors are present, appends the first detail(s) so validation
 * failures are actionable (e.g. forbidden property / missing field).
 */
export function translateApiError(
  locale: string,
  error: unknown,
  fallback?: string,
): string {
  const typed = isValidLocale(locale) ? locale : defaultLocale;
  const requestFailed = translateErrorCode(typed, 'REQUEST_FAILED', fallback);

  if (error && typeof error === 'object') {
    const maybe = error as {
      body?: {
        code?: string;
        message?: string;
        fieldErrors?: Record<string, string[]> | Array<{ field?: string; message?: string }>;
      };
      code?: string;
      message?: string;
      fieldErrors?: Record<string, string[]> | Array<{ field?: string; message?: string }>;
    };
    const code = maybe.body?.code ?? maybe.code;
    const message = maybe.body?.message ?? maybe.message;
    const fieldErrors = maybe.body?.fieldErrors ?? maybe.fieldErrors;
    const details = formatFieldErrorDetails(fieldErrors);
    if (code || message) {
      const base = translateErrorCode(typed, code, message ?? requestFailed);
      return details ? `${base} ${details}` : base;
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return requestFailed;
}

function formatFieldErrorDetails(
  fieldErrors:
    | Record<string, string[]>
    | Array<{ field?: string; message?: string }>
    | undefined,
): string | null {
  if (!fieldErrors) return null;
  const parts: string[] = [];
  if (Array.isArray(fieldErrors)) {
    for (const err of fieldErrors.slice(0, 3)) {
      const msg = err.message?.trim();
      if (msg) parts.push(msg);
    }
  } else {
    for (const [field, messages] of Object.entries(fieldErrors)) {
      for (const msg of messages.slice(0, 2)) {
        const text = String(msg).trim();
        if (!text) continue;
        parts.push(field === '_' ? text : `${field}: ${text}`);
        if (parts.length >= 3) break;
      }
      if (parts.length >= 3) break;
    }
  }
  return parts.length ? `(${parts.join('; ')})` : null;
}

/** Best-effort locale from explicit value, runtime override, or `<html lang>`. */
let runtimeUiLocale: Locale | null = null;

export function setRuntimeUiLocale(locale: Locale) {
  runtimeUiLocale = locale;
}

export function detectUiLocale(preferred?: string | null): Locale {
  if (preferred && isValidLocale(preferred)) return preferred;
  if (runtimeUiLocale) return runtimeUiLocale;
  try {
    const doc = (globalThis as { document?: { documentElement?: { lang?: string } } }).document;
    const lang = doc?.documentElement?.lang?.slice(0, 2);
    if (lang && isValidLocale(lang)) return lang;
  } catch {
    /* non-DOM runtime */
  }
  return defaultLocale;
}
