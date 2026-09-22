'use client';

import { AuthPanelLayout } from '@/components/auth/auth-panel-layout';
import { LoginForm } from '@/components/login-form';
import { BadgeCheck, Factory, Truck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Suspense } from 'react';

export default function LoginPage() {
  const t = useTranslations('auth');
  const tNav = useTranslations('navigation');
  const highlights = [
    { icon: Factory, label: tNav('production') },
    { icon: BadgeCheck, label: tNav('quality') },
    { icon: Truck, label: tNav('deliveries') },
  ];

  return (
    <AuthPanelLayout
      panelTitle={t('login')}
      footer={
        <div className="flex flex-wrap items-center justify-center gap-3">
          {highlights.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 rounded-full border border-[var(--maher-border)] bg-[var(--maher-surface)]/70 px-3 py-2 text-sm text-[var(--maher-text-secondary)] backdrop-blur-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--maher-surface-muted)] text-[var(--maher-brand)]">
                <Icon className="h-4 w-4" />
              </span>
              <span className="font-medium">{label}</span>
            </div>
          ))}
        </div>
      }
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthPanelLayout>
  );
}
