import { defaultLocale } from '@maher/i18n';
import { resolveWebHomePath } from '@maher/permissions';
import { redirect } from 'next/navigation';
import { loadSessionUser } from '@/session/load-session';

export default async function LegacyDashboardRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await loadSessionUser();
  redirect(`/${locale || defaultLocale}${user ? resolveWebHomePath(user) : '/login'}`);
}
