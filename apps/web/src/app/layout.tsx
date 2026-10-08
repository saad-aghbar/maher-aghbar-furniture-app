import { getFontClass, getPrimaryFontFamily } from '@/lib/fonts';
import { defaultLocale, getDirection, isValidLocale } from '@maher/i18n';
import { THEME_FOUC_SCRIPT } from '@maher/ui';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import './globals.css';

export default async function RootLayout({ children }: { children: ReactNode }) {
  const headerStore = await headers();
  const requested = headerStore.get('x-next-intl-locale') ?? '';
  const locale = isValidLocale(requested) ? requested : defaultLocale;

  return (
    <html lang={locale} dir={getDirection(locale)} className={getFontClass(locale)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_FOUC_SCRIPT }} />
      </head>
      <body style={{ fontFamily: getPrimaryFontFamily(locale) }}>
        {children}
      </body>
    </html>
  );
}
