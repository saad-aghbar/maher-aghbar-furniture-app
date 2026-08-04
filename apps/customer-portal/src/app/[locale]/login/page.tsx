'use client';

import { BrandMark } from '@maher/ui';
import { LoginForm } from '@/components/login-form';
import { LanguageSwitcher } from '@/components/language-switcher';
import { AppThemeToggle } from '@/components/theme-toggle';
import { FileText, Package, Receipt, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function LoginPage() {
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');

  const highlights = [
    { icon: FileText, label: tNav('myQuotes') },
    { icon: Package, label: tNav('trackOrder') },
    { icon: Receipt, label: tNav('invoices') },
  ];

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-[1.1fr_1fr]">
      <div className="fixed end-4 top-4 z-50 flex items-center gap-2 sm:end-6 sm:top-6">
        <AppThemeToggle />
        <LanguageSwitcher />
      </div>
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
        <div
          className="maher-animate-spotlight pointer-events-none absolute -start-10 top-8 h-52 w-52 rounded-full bg-[var(--maher-brand)]/30 blur-3xl"
          aria-hidden
        />
        <div
          className="maher-animate-drift pointer-events-none absolute -end-8 bottom-10 h-44 w-44 rounded-full bg-[var(--maher-accent)]/35 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute end-16 top-24 h-2 w-2 rounded-full bg-white/50 maher-animate-orbit"
          aria-hidden
        />

        <div className="relative flex items-center gap-3 maher-animate-rise">
          <BrandMark size="lg" animated />
          <span className="text-base font-semibold">{tCommon('appNameFull')}</span>
        </div>

        <div className="relative max-w-md">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/85 backdrop-blur-sm maher-animate-fade">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--maher-brand)] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--maher-brand)]" />
            </span>
            {tCommon('portalCustomer')}
            <Sparkles className="h-3.5 w-3.5 text-white/70" />
          </div>
          <h2 className="maher-animate-rise text-4xl font-bold leading-tight">{t('loginTitle')}</h2>
          <p
            className="maher-animate-rise mt-4 text-base leading-relaxed text-white/75"
            style={{ animationDelay: '80ms' }}
          >
            {t('loginSubtitle')}
          </p>
          <ul className="maher-auth-highlights mt-10 space-y-3">
            {highlights.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm text-white/85">
                <span className="flex h-9 w-9 items-center justify-center rounded-[var(--maher-radius-md)] bg-white/10 ring-1 ring-inset ring-white/15 transition-transform duration-300 hover:scale-110">
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
        <div className="maher-auth-panel w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark size="lg" animated />
            <div>
              <p className="text-base font-semibold text-text-primary">{tCommon('appName')}</p>
              <p className="text-xs text-text-tertiary">{tCommon('portalCustomer')}</p>
            </div>
          </div>
          <div className="maher-sheen rounded-[var(--maher-radius-xl)] border border-border bg-surface p-8 shadow-elevated">
            <h1 className="maher-animate-in-start text-2xl font-bold text-text-primary">
              {t('login')}
            </h1>
            <p
              className="maher-animate-in-start mt-1.5 text-sm text-text-secondary"
              style={{ animationDelay: '60ms' }}
            >
              {t('unifiedLoginHint')}
            </p>
            <div className="mt-6">
              <LoginForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
