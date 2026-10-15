'use client';

import { getPrimaryFontFamily } from '@/lib/fonts';
import { getDirection, isValidLocale } from '@maher/i18n';
import { useLocale } from 'next-intl';
import { useLayoutEffect } from 'react';

/** Root `<html>` is not patched on client navigations, so sync direction here. */
export function DocumentLocale() {
  const locale = useLocale();

  useLayoutEffect(() => {
    if (!isValidLocale(locale)) return;
    const root = document.documentElement;
    root.lang = locale;
    root.dir = getDirection(locale);
    document.body.style.fontFamily = getPrimaryFontFamily(locale);
  }, [locale]);

  return null;
}
