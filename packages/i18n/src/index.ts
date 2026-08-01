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
  | 'mobile';

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
  if (!row) return fallback;
  if (locale === 'ar') {
    return (
      row.nameAr ||
      row.titleAr ||
      row.nameEn ||
      row.titleEn ||
      row.nameHe ||
      row.titleHe ||
      row.name ||
      fallback
    );
  }
  if (locale === 'he') {
    return (
      row.nameHe ||
      row.titleHe ||
      row.nameEn ||
      row.titleEn ||
      row.nameAr ||
      row.titleAr ||
      row.name ||
      fallback
    );
  }
  return (
    row.nameEn ||
    row.titleEn ||
    row.nameAr ||
    row.titleAr ||
    row.nameHe ||
    row.titleHe ||
    row.name ||
    fallback
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
