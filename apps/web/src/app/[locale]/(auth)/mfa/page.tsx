'use client';

import { LoginForm } from '@/components/login-form';
import { useTranslations } from 'next-intl';

export default function MfaPage() {
  const t = useTranslations('auth');
  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <div className="w-full space-y-4 rounded-[var(--maher-radius-xl)] border border-border bg-surface p-8">
        <h1 className="text-2xl font-semibold">{t('mfaSetup')}</h1>
        <p className="text-sm text-[var(--text-secondary)]">{t('mfaRequired')}</p>
        <LoginForm />
      </div>
    </div>
  );
}
