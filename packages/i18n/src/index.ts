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
import arLifecycle from './messages/ar/lifecycle.json';
import arPurchasing from './messages/ar/purchasing.json';

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
import enLifecycle from './messages/en/lifecycle.json';
import enPurchasing from './messages/en/purchasing.json';

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
import heLifecycle from './messages/he/lifecycle.json';
import hePurchasing from './messages/he/purchasing.json';

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
  | 'errors'
  | 'lifecycle'
  | 'purchasing';

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
    lifecycle: arLifecycle,
    purchasing: arPurchasing,
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
    lifecycle: enLifecycle,
    purchasing: enPurchasing,
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
    lifecycle: heLifecycle,
    purchasing: hePurchasing,
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
      row.nameEn ||
      row.titleEn ||
      row.name ||
      fallback ||
      row.nameHe ||
      row.titleHe ||
      '—'
    );
  }
  if (locale === 'he') {
    return (
      row.nameHe ||
      row.titleHe ||
      row.nameEn ||
      row.titleEn ||
      row.name ||
      fallback ||
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

/** Stage + optional output label for production-setup preview. SKUs stay Latin. */
export function formatProductionPreviewStep(
  locale: string,
  step: {
    stageNameEn: string;
    stageNameAr?: string | null;
    stageNameHe?: string | null;
    produces?: {
      nameEn?: string | null;
      nameAr?: string | null;
      nameHe?: string | null;
    } | null;
  },
): string {
  const stage = localizedName(
    locale,
    {
      nameEn: step.stageNameEn,
      nameAr: step.stageNameAr,
      nameHe: step.stageNameHe,
    },
    step.stageNameEn,
  );
  if (!step.produces) return stage;
  const output = localizedName(locale, step.produces, '');
  return output ? `${stage} → ${output}` : stage;
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

export function lifecycleLabel(locale: string, key: string): string {
  const typed = isValidLocale(locale) ? locale : defaultLocale;
  const parts = key.split('.');
  let cur: MessageValue | undefined = getMessages(typed).lifecycle;
  for (const p of parts) {
    if (typeof cur !== 'object' || cur === null) return key;
    cur = (cur as Record<string, MessageValue>)[p];
  }
  return typeof cur === 'string' ? cur : key;
}

export function statusLabel(locale: string, status: string): string {
  const typed = isValidLocale(locale) ? locale : defaultLocale;
  const map = getMessages(typed).statuses;
  const value = (map as Record<string, string | undefined>)[status];
  if (typeof value === 'string') return value;
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Quotation-only human status. Do not use for invoices/POs (shared APPROVED). */
const QUOTATION_STATUS_PRESENTMENT: Record<string, string> = {
  DRAFT: 'DRAFT',
  INTERNAL_REVIEW: 'READY_TO_SEND',
  APPROVED: 'READY_TO_SEND',
  SENT: 'SENT_WAITING',
  VIEWED: 'SENT_WAITING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  REVISION_REQUESTED: 'REVISION_REQUESTED',
  CANCELLED: 'CANCELLED',
};

const QUOTATION_EXPIRED_FROM = new Set([
  'DRAFT',
  'INTERNAL_REVIEW',
  'APPROVED',
  'SENT',
  'VIEWED',
]);

export function quotationStatusPresentmentKey(
  status: string,
  commerciallyExpired?: boolean,
): string {
  if (commerciallyExpired && QUOTATION_EXPIRED_FROM.has(status)) return 'EXPIRED';
  return QUOTATION_STATUS_PRESENTMENT[status] ?? status;
}

export function presentQuotationStatus(
  locale: string,
  status: string,
  commerciallyExpired?: boolean,
): string {
  const typed = isValidLocale(locale) ? locale : defaultLocale;
  const key = quotationStatusPresentmentKey(status, commerciallyExpired);
  const map = (getMessages(typed).quotations as { statusPresentment?: Record<string, string> })
    .statusPresentment;
  const labeled = map?.[key];
  if (typeof labeled === 'string' && labeled.trim()) return labeled;
  return statusLabel(typed, status);
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

export { allLeafKeys, flattenLeaves, flattenNamespace } from './flatten';
export {
  arabicPluralCategory,
  pickPluralKey,
  pluralAr,
  type ArabicPluralForms,
} from './plural';

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
