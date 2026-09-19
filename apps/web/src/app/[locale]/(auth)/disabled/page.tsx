'use client';

import { Link } from '@/i18n/navigation';
import { Button } from '@maher/ui';
import { useTranslations } from 'next-intl';

export default function DisabledAccountPage() {
  const t = useTranslations('auth');
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">{t('accountDisabled')}</h1>
      <Link href="/login">
        <Button type="button">{t('login')}</Button>
      </Link>
    </div>
  );
}
