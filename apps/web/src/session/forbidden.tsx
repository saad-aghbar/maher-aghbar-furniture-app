'use client';

import { Link } from '@/i18n/navigation';
import { Button, PageHeader } from '@maher/ui';
import { useTranslations } from 'next-intl';

export function ForbiddenView({ homeHref = '/' }: { homeHref?: string }) {
  const t = useTranslations('common');
  const tAuth = useTranslations('auth');
  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <PageHeader title={tAuth('accountDisabled')} />
      <p className="text-sm text-[var(--text-secondary)]">{t('noResults')}</p>
      <Link href={homeHref}>
        <Button type="button">{t('home')}</Button>
      </Link>
    </div>
  );
}
