import type { ReactNode } from 'react';
import { cn } from '../cn';

export interface CalendarLegendItem {
  id: string;
  label: ReactNode;
  /** A CSS colour or a `data-tone` swatch key (`light`, `half`, `busy`, `closed`). */
  swatch: 'light' | 'half' | 'busy' | 'closed' | 'confirmed' | 'proposed' | 'attention' | 'selected' | 'today' | string;
}

const SWATCH: Record<string, string> = {
  light: 'bg-[color-mix(in_oklab,var(--maher-brand)_10%,var(--maher-surface))] border-[var(--maher-border)]',
  half: 'bg-[color-mix(in_oklab,var(--maher-brand)_26%,var(--maher-surface))] border-transparent',
  busy: 'bg-[color-mix(in_oklab,var(--maher-brand)_48%,var(--maher-surface))] border-transparent',
  closed: 'bg-[repeating-linear-gradient(135deg,transparent_0_3px,var(--maher-border-strong)_3px_4px)] border-[var(--maher-border)]',
  confirmed: 'bg-[var(--maher-success)] border-transparent rounded-full !h-2 !w-2',
  proposed: 'bg-[var(--maher-brand)] border-transparent rounded-full !h-2 !w-2',
  attention: 'bg-[var(--maher-warning)] border-transparent rounded-full !h-2 !w-2',
  selected: 'bg-[var(--maher-brand)] border-transparent',
  today: 'bg-transparent border-[var(--maher-brand)]',
};

/** Legend row under a MonthCalendar. Swatches mirror the day cell paint exactly. */
export function CalendarLegend({ items, className }: { items: CalendarLegendItem[]; className?: string }) {
  return (
    <ul className={cn('m-0 flex flex-wrap items-center gap-x-4 gap-y-1.5 p-0 text-[12px] text-[var(--maher-text-secondary)]', className)}>
      {items.map((item) => {
        const preset = SWATCH[item.swatch];
        return (
          <li key={item.id} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn('inline-block h-3.5 w-3.5 rounded-[4px] border', preset)}
              style={preset ? undefined : { background: item.swatch, borderColor: 'transparent' }}
            />
            {item.label}
          </li>
        );
      })}
    </ul>
  );
}
