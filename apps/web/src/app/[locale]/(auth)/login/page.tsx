'use client';

import { BrandMark } from '@/components/brand-mark';
import { LoginGlassBackdrop } from '@/components/login-glass-backdrop';
import { LoginForm } from '@/components/login-form';
import { LanguageSwitcher } from '@/components/language-switcher';
import { AppThemeToggle } from '@/components/theme-toggle';
import { BadgeCheck, Factory, Truck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Suspense } from 'react';

export default function LoginPage() {
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');

  const highlights = [
    { icon: Factory, label: tNav('production') },
    { icon: BadgeCheck, label: tNav('quality') },
    { icon: Truck, label: tNav('deliveries') },
  ];

  return (
    <div className="grid min-h-screen bg-[var(--maher-background)] lg:grid-cols-[1.1fr_1fr]">
      <div className="fixed end-4 top-4 z-50 flex items-center gap-2 sm:end-6 sm:top-6">
        <AppThemeToggle />
        <LanguageSwitcher />
      </div>
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[var(--maher-surface)] p-12 text-[var(--maher-text-primary)] lg:flex">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 start-0 w-[3px] bg-[var(--maher-brand)] opacity-55"
        />
        <LoginGlassBackdrop />
        <div className="relative flex items-center gap-3">
          <BrandMark size="xl" variant="lockup" animated />
        </div>

        <div className="relative max-w-md">
          <h2 className="text-4xl font-semibold leading-tight">{t('loginTitle')}</h2>
          <p className="mt-4 text-base leading-relaxed text-[var(--maher-text-secondary)]">
            {t('loginSubtitle')}
          </p>
          <ul className="mt-10 space-y-3">
            {highlights.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm text-[var(--maher-text-secondary)]">
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--maher-border)] bg-[var(--maher-surface-muted)] text-[var(--maher-brand)]">
                  <Icon className="h-4 w-4" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-[var(--maher-text-tertiary)]">
          © {new Date().getFullYear()} {tCommon('appNameFull')}
        </p>
      </div>

      <div className="flex items-center justify-center bg-[var(--maher-background)] px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark size="lg" variant="lockup" animated />
          </div>
          <div className="relative overflow-hidden rounded-[20px] border border-[var(--maher-border-strong)] bg-[var(--maher-surface)] p-8 ps-9 shadow-[var(--maher-shadow-sm)]">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 start-0 w-[3px] bg-[var(--maher-brand)] opacity-55"
            />
            <h1 className="text-2xl font-semibold text-[var(--maher-text-primary)]">{t('login')}</h1>
            <p className="mt-1.5 text-sm text-[var(--maher-text-secondary)]">{t('unifiedLoginHint')}</p>
            <div className="mt-6">
              <Suspense fallback={null}>
                <LoginForm />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
