import {
  defaultLocale,
  flattenMessages,
  getMessages,
  isValidLocale,
} from '@maher/i18n';
import type { Locale } from '@maher/types';
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !isValidLocale(locale)) {
    locale = defaultLocale;
  }

  const typedLocale = locale as Locale;

  return {
    locale: typedLocale,
    messages: flattenMessages(getMessages(typedLocale)),
  };
});
