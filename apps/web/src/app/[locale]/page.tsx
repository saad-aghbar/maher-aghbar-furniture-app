import { defaultLocale } from '@maher/i18n';
import { resolveWebHomePath } from '@maher/permissions';
import { redirect } from 'next/navigation';
import { loadSessionUser } from '@/session/load-session';

export default async function LocaleIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale = locale || defaultLocale;
  const user = await loadSessionUser();
  if (user) {
    redirect(`/${safeLocale}${resolveWebHomePath(user)}`);
  }
  redirect(`/${safeLocale}/login`);
}
