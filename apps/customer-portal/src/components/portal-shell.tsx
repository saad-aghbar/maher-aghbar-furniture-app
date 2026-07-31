'use client';

import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@maher/ui';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

const items = [
  { href: '/dashboard', key: 'dashboard' },
  { href: '/quotations', key: 'myQuotes' },
  { href: '/quotations/request', key: 'requestQuote' },
  { href: '/orders', key: 'orders' },
  { href: '/invoices', key: 'invoices' },
  { href: '/statement', key: 'statement' },
] as const;

export function PortalShell({ children }: { children: ReactNode }) {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-bold text-brand">{tCommon('appName')}</p>
            <p className="text-xs text-[var(--maher-text-secondary)]">Customer Portal</p>
          </div>
          <nav className="flex flex-wrap gap-2">
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'rounded-md px-3 py-2 text-sm font-medium',
                    active ? 'bg-brand/10 text-brand' : 'text-[var(--maher-text-secondary)]',
                  )}
                >
                  {t(item.key)}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
