import { ConditionalShell } from '@/components/conditional-shell';
import { getFontClass, getPrimaryFontFamily } from '@/lib/fonts';
import { QueryProvider } from '@/providers/query-provider';
import { StatusI18nProvider } from '@/providers/status-i18n-provider';
import { getDirection, isValidLocale } from '@maher/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import '../globals.css';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return [{ locale: 'ar' }, { locale: 'en' }, { locale: 'he' }];
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!isValidLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const dir = getDirection(locale);

  return (
    <html lang={locale} dir={dir} className={getFontClass(locale)}>
      <body style={{ fontFamily: getPrimaryFontFamily(locale) }}>
        <NextIntlClientProvider messages={messages}>
          <StatusI18nProvider>
            <QueryProvider>
              <ConditionalShell>{children}</ConditionalShell>
            </QueryProvider>
          </StatusI18nProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
