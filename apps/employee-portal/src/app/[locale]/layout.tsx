import { ConditionalShell } from '@/components/conditional-shell';
import { getFontClass, getPrimaryFontFamily } from '@/lib/fonts';
import { QueryProvider } from '@/providers/query-provider';
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
  if (!isValidLocale(locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} dir={getDirection(locale)} className={getFontClass(locale)}>
      <body style={{ fontFamily: getPrimaryFontFamily(locale) }}>
        <NextIntlClientProvider messages={messages}>
          <QueryProvider>
            <ConditionalShell>{children}</ConditionalShell>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
