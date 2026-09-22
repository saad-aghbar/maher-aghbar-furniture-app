'use client';

import { AuthPanelLayout } from '@/components/auth/auth-panel-layout';
import { Link } from '@/i18n/navigation';
import { Button } from '@maher/ui';
import { useTranslations } from 'next-intl';

export default function DisabledAccountPage() {
  const t = useTranslations('auth');
  return (
    <AuthPanelLayout title={t('accountDisabled')} hint={t('disabledHint')} panelTitle={t('login')} stamp={{ label: t('accountDisabled'), tone: 'error' }}>
      <p className="text-sm leading-6 text-[var(--maher-text-secondary)]">{t('disabledHint')}</p>
      <Link href="/login" className="mt-6 block">
        <Button type="button" size="lg" variant="secondary" className="w-full">
          {t('login')}
        </Button>
      </Link>
    </AuthPanelLayout>
  );
}
