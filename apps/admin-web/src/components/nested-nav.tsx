'use client';

import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@maher/ui';
import { useTranslations } from 'next-intl';
import { nestedNavGroups } from './nav-items';

export function NestedNav() {
  const pathname = usePathname();
  const t = useTranslations('navigation');

  const group = nestedNavGroups.find((g) =>
    g.matchPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)),
  );
  if (!group) return null;

  const items = group.items;

  if (items.length < 2) return null;

  return (
    <nav
      aria-label={t('groupOperations')}
      className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3"
    >
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== group.parentHref && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition',
              active
                ? 'bg-surface-muted text-text-primary shadow-sm'
                : 'text-text-secondary hover:bg-surface-muted/70 hover:text-text-primary',
            )}
          >
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}
