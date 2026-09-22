'use client';

import { BrandMark } from '@/components/brand-mark';
import { LoginGlassBackdrop } from '@/components/login-glass-backdrop';
import { LoginWatermarkField } from '@/components/login-watermark-field';
import { LanguageSwitcher } from '@/components/language-switcher';
import { AppThemeToggle } from '@/components/theme-toggle';
import { Stamp, useTheme, type BoardTone } from '@maher/ui';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

const LoginShaderWash = dynamic(() => import('@/components/login-shader-wash').then((mod) => mod.LoginShaderWash), { ssr: false });

export interface AuthPanelLayoutProps {
  /** Headline over the panel (defaults to the login title). */
  title?: ReactNode;
  /** Sentence under the headline. */
  hint?: ReactNode;
  /** Panel heading. */
  panelTitle: ReactNode;
  /** Small stamp beside the panel heading (e.g. "Step 2 of 2"). */
  stamp?: { label: ReactNode; tone?: BoardTone };
  children: ReactNode;
  /** Pills under the panel (login highlights). */
  footer?: ReactNode;
}

/**
 * AuthPanelLayout — the login atmosphere (shader wash, watermark field, glass
 * backdrop) with one paper panel board. Every auth page renders inside it.
 */
export function AuthPanelLayout({ title, hint, panelTitle, stamp, children, footer }: AuthPanelLayoutProps) {
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundColor: dark ? '#0a0a0c' : '#f5f5f3' }}>
      <div className="pointer-events-none absolute inset-0" style={{ backgroundColor: dark ? '#1e1a1b' : '#e1dfd3', opacity: 0.97 }} />
      <div className="pointer-events-none absolute inset-0">
        <LoginShaderWash />
        <LoginWatermarkField />
        {dark ? <LoginGlassBackdrop /> : null}
      </div>

      <div className="fixed end-4 top-4 z-50 flex items-center gap-2 sm:end-6 sm:top-6">
        <LanguageSwitcher />
        <AppThemeToggle />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-between px-6 py-10 sm:py-14">
        <div className="flex flex-col items-center text-center">
          <BrandMark size="xl" variant="lockup" className="h-24 max-w-[20rem] sm:h-32 sm:max-w-[24rem]" />
          <h1 className="mt-6 max-w-[16ch] text-balance text-3xl font-medium leading-snug tracking-normal text-[var(--maher-text-primary)] sm:text-4xl">{title ?? t('loginTitle')}</h1>
          <p className="mt-2 text-sm text-[var(--maher-text-secondary)]">{hint ?? t('unifiedLoginHint')}</p>
        </div>

        <div className="maher-auth-panel maher-board relative w-full max-w-lg overflow-hidden rounded-[18px] border border-[var(--maher-border)] bg-[var(--maher-surface)] p-8">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-2xl font-medium tracking-normal text-[var(--maher-text-primary)]">{panelTitle}</h2>
            {stamp ? <Stamp tone={stamp.tone ?? 'brand'} size="sm">{stamp.label}</Stamp> : null}
          </div>
          <div className="mt-6">{children}</div>
        </div>

        <div className="flex w-full flex-col items-center gap-5">
          {footer}
          <p className="text-xs text-[var(--maher-text-tertiary)]">
            © {new Date().getFullYear()} {tCommon('appNameFull')}
          </p>
        </div>
      </div>
    </div>
  );
}
