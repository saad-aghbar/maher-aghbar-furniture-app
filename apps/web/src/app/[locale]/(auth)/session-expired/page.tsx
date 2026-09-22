'use client';

import { AuthPanelLayout } from '@/components/auth/auth-panel-layout';
import { Link } from '@/i18n/navigation';
import { Button } from '@maher/ui';
import { useTranslations } from 'next-intl';

export default function SessionExpiredPage() {
  const t = useTranslations('auth');
  return (
    <AuthPanelLayout title={t('sessionExpired')} hint={t('sessionExpiredHint')} panelTitle={t('signInAgain')} stamp={{ label: t('sessionExpired'), tone: 'warning' }}>
      <p className="text-sm leading-6 text-[var(--maher-text-secondary)]">{t('sessionExpiredHint')}</p>
      <Link href="/login" className="mt-6 block">
        <Button type="button" size="lg" className="w-full">
          {t('signInAgain')}
        </Button>
      </Link>
    </AuthPanelLayout>
  );
}
