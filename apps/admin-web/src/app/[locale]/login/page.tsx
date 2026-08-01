'use client';

import { BrandMark } from '@/components/brand-mark';
import { LoginForm } from '@/components/login-form';
import { LanguageSwitcher } from '@/components/language-switcher';
import { BadgeCheck, Factory, Truck } from 'lucide-react';
import { useTranslations } from 'next-intl';

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
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <LanguageSwitcher floating />
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#2a1512] p-12 text-white lg:flex">
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 90% at 12% 8%, #d93a2b 0%, rgba(217,58,43,0.35) 38%, transparent 68%), radial-gradient(90% 80% at 95% 100%, #8a5a2b 0%, rgba(138,90,43,0.25) 45%, transparent 72%)',
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />
        <div className="relative flex items-center gap-3">
          <BrandMark />
          <span className="text-base font-semibold">{tCommon('appNameFull')}</span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold leading-tight">{t('loginTitle')}</h2>
          <p className="mt-4 text-base leading-relaxed text-white/75">{t('loginSubtitle')}</p>
          <ul className="mt-10 space-y-3">
            {highlights.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm text-white/85">
                <span className="flex h-9 w-9 items-center justify-center rounded-[var(--maher-radius-md)] bg-white/10 ring-1 ring-inset ring-white/15">
                  <Icon className="h-4 w-4" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">
          © {new Date().getFullYear()} {tCommon('appNameFull')}
        </p>
      </div>

      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark />
            <span className="text-base font-semibold text-text-primary">{tCommon('appName')}</span>
          </div>
          <div className="rounded-[var(--maher-radius-xl)] border border-border bg-surface p-8 shadow-elevated">
            <h1 className="text-2xl font-bold text-text-primary">{t('login')}</h1>
            <p className="mt-1.5 text-sm text-text-secondary">{t('unifiedLoginHint')}</p>
            <div className="mt-6">
              <LoginForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
