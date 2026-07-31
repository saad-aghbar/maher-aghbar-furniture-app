'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

export function EmployeeShell({ children }: { children: ReactNode }) {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-4">
        <p className="text-lg font-bold text-brand">{tCommon('appName')}</p>
        <p className="text-xs text-[var(--maher-text-secondary)]">Production Floor</p>
        <nav className="mt-3">
          <Link href="/tasks" className="text-sm font-medium text-brand">
            {t('tasks')}
          </Link>
        </nav>
      </header>
      <main className="p-4 pb-24">{children}</main>
    </div>
  );
}
