'use client';

import type { AdminScheduleStat, ScheduleFocusKey } from '@/lib/scheduling-board';
import { cn, Skeleton } from '@maher/ui';
import { AlertTriangle, CalendarDays, GitCompare, Hourglass, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

const ICONS: Record<ScheduleFocusKey, ReactNode> = {
  today: <Sun className="h-4 w-4" />,
  week: <CalendarDays className="h-4 w-4" />,
  awaitingApproval: <Hourglass className="h-4 w-4" />,
  atRisk: <AlertTriangle className="h-4 w-4" />,
  conflicts: <GitCompare className="h-4 w-4" />,
};

export function StatChips({
  stats,
  loading,
  focus,
  onSelect,
}: {
  stats: AdminScheduleStat[];
  loading?: boolean;
  focus: ScheduleFocusKey | null;
  onSelect: (key: ScheduleFocusKey) => void;
}) {
  const t = useTranslations('mobile.adminScheduling');

  if (loading && stats.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] w-full rounded-[var(--maher-radius-lg)]" />
        ))}
      </div>
    );
  }

  return (
    <div className="maher-stagger grid grid-cols-2 gap-3 lg:grid-cols-5">
      {stats.map((stat) => {
        const hot = stat.value > 0 && stat.tone !== 'neutral';
        const active = focus === stat.key;
        const accent =
          stat.tone === 'danger'
            ? 'text-[var(--maher-error)]'
            : stat.tone === 'warning'
              ? 'text-[var(--maher-warning)]'
              : 'text-text-primary';
        const iconWrap = hot
          ? stat.tone === 'danger'
            ? 'bg-[var(--maher-error)] text-white'
            : 'bg-[var(--maher-warning)] text-white'
          : 'bg-[var(--maher-brand-soft)] text-brand';
        const wash = active
          ? 'border-brand bg-[var(--maher-brand-soft)]/50'
          : hot && stat.tone === 'danger'
            ? 'border-[var(--maher-error)]/40 bg-[var(--maher-error-soft)]'
            : hot && stat.tone === 'warning'
              ? 'border-[var(--maher-warning)]/40 bg-[var(--maher-warning-soft)]'
              : 'border-border bg-surface hover:border-border-strong';

        return (
          <button
            key={stat.key}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(stat.key)}
            className={cn(
              'maher-lift rounded-[var(--maher-radius-lg)] border p-3 text-start shadow-[var(--maher-shadow-sm)] transition',
              wash,
              active ? 'border-2' : '',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--maher-radius-md)]',
                  iconWrap,
                )}
              >
                {ICONS[stat.key]}
              </span>
              <p className={cn('text-2xl font-semibold tabular-nums tracking-tight', accent)} dir="ltr">
                {stat.value}
              </p>
            </div>
            <p className="mt-2 text-xs font-medium leading-snug text-text-secondary">
              {t(`stats.${stat.key}`)}
            </p>
          </button>
        );
      })}
    </div>
  );
}
