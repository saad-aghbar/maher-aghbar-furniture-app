import { ConditionalShell } from '@/components/conditional-shell';
import { DeskToolsI18n } from '@/providers/desk-tools-i18n';
import { QueryProvider } from '@/providers/query-provider';
import { StatusI18nProvider } from '@/providers/status-i18n-provider';
import { loadSessionUser } from '@/session/load-session';
import { SessionProvider } from '@/session/session-provider';
import { isValidLocale } from '@maher/i18n';
import { ThemeProvider } from '@maher/ui';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

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
  const sessionUser = await loadSessionUser();

  return (
    <NextIntlClientProvider messages={messages}>
      <ThemeProvider>
        <StatusI18nProvider>
          <QueryProvider>
            <DeskToolsI18n>
              <SessionProvider user={sessionUser}>
                <ConditionalShell>{children}</ConditionalShell>
              </SessionProvider>
            </DeskToolsI18n>
          </QueryProvider>
        </StatusI18nProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
