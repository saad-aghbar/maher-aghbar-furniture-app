import { defaultLocale, locales } from '@maher/i18n';
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: [...locales],
  defaultLocale,
});
