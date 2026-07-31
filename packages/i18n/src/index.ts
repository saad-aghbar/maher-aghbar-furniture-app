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
  | 'validation';

export type Messages = Record<MessageNamespace, Record<string, string>>;

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

export function flattenMessages(messages: Messages): Record<string, Record<string, string>> {
  return Object.fromEntries(
    Object.entries(messages).map(([namespace, entries]) => [namespace, entries]),
  );
}
