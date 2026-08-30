'use client';

import { cn } from '@maher/ui';
import { useTranslations } from 'next-intl';

export type ProductionHubTab = 'overview' | 'materials' | 'wip' | 'quality' | 'stages';

type Props = {
  active: ProductionHubTab;
  onChange: (tab: ProductionHubTab) => void;
  className?: string;
};

const TABS: ProductionHubTab[] = ['overview', 'materials', 'wip', 'quality', 'stages'];

function tabLabel(tab: ProductionHubTab, tp: ReturnType<typeof useTranslations>): string {
  switch (tab) {
    case 'overview':
      return tp('hubOverview');
    case 'materials':
      return tp('materials');
    case 'wip':
      return tp('hubWip');
    case 'quality':
      return tp('hubQuality');
    case 'stages':
      return tp('hubStages');
  }
}

export function ProductionHubNav({ active, onChange, className }: Props) {
  const tp = useTranslations('production');

  return (
    <nav
      className={cn(
        'sticky top-0 z-20 -mx-1 flex flex-wrap gap-1 rounded-[var(--maher-radius-lg)] border border-border bg-[var(--maher-surface)] p-1 shadow-sm',
        className,
      )}
      aria-label={tp('hubNavLabel')}
    >
      {TABS.map((tab) => {
        const selected = active === tab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={cn(
              'min-h-9 flex-1 rounded-[var(--maher-radius-md)] px-3 py-2 text-sm font-medium transition-colors',
              selected
                ? 'bg-[var(--maher-brand-soft)] text-[var(--maher-brand)]'
                : 'text-text-secondary hover:bg-[var(--maher-surface-muted)]',
            )}
            aria-current={selected ? 'page' : undefined}
          >
            {tabLabel(tab, tp)}
          </button>
        );
      })}
    </nav>
  );
}
