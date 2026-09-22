'use client';

import { Link } from '@/i18n/navigation';
import { allNavItems, canSeeNav } from '@/components/nav-items';
import { useAuthMe } from '@/hooks/use-auth-me';
import { Board, cn } from '@maher/ui';
import { ArrowUpRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

/**
 * Dense two-column jump rows to the modules this user can open.
 * Elastic: fills the column's slack so the desk ends flush.
 */
export function QuickJumpsBoard({
  className,
  title,
  description,
}: {
  className?: string;
  title?: string;
  description?: string;
}) {
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const me = useAuthMe();
  const permissions = me.data?.permissions;
  const jumps = useMemo(
    () =>
      allNavItems.filter(
        (item) => item.href !== '/admin/dashboard' && canSeeNav(item, permissions ?? []),
      ),
    [permissions],
  );

  if (!jumps.length) return null;

  return (
    <Board tone="neutral" className={cn('xl:flex-1', className)}>
      <Board.Header
        stamp={false}
        title={title ?? tCommon('quickActions')}
        description={description ?? tCommon('dashboardQuickHint')}
      />
      <Board.Body padding="tight" grow>
        <ul className="m-0 grid h-full list-none auto-rows-fr grid-cols-1 gap-x-2 p-0 sm:grid-cols-2">
          {jumps.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href} className="m-0">
                <Link
                  href={item.href}
                  className="maher-press group/jump flex min-h-[44px] items-center gap-3 rounded-[10px] px-2.5 py-2 text-sm text-[var(--maher-text-primary)] transition-colors hover:bg-[var(--maher-surface-muted)]"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[var(--maher-surface-muted)] text-[var(--maher-text-secondary)] transition-colors group-hover/jump:bg-[var(--maher-brand-soft)] group-hover/jump:text-[var(--maher-brand)]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{tNav(item.key as never)}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--maher-text-tertiary)] opacity-0 transition-opacity group-hover/jump:opacity-100 rtl:-scale-x-100" />
                </Link>
              </li>
            );
          })}
        </ul>
      </Board.Body>
    </Board>
  );
}
