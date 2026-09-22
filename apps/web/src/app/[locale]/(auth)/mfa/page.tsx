'use client';

import { AuthPanelLayout } from '@/components/auth/auth-panel-layout';
import { LoginForm } from '@/components/login-form';
import { useTranslations } from 'next-intl';
import { Suspense } from 'react';

export default function MfaPage() {
  const t = useTranslations('auth');
  return (
    <AuthPanelLayout title={t('mfaSetup')} hint={t('mfaRequired')} panelTitle={t('mfaCode')} stamp={{ label: t('mfaStep'), tone: 'info' }}>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthPanelLayout>
  );
}
