'use client';

import { LoginForm } from '@/components/login-form';
import { Card } from '@maher/ui';
import { useTranslations } from 'next-intl';

export default function LoginPage() {
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  return (
    <Card className="w-full max-w-md" title={t('loginTitle')}>
      <p className="mb-4 text-center text-xl font-bold text-brand">{tCommon('appName')}</p>
      <LoginForm />
    </Card>
  );
}
