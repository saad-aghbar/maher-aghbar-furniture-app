'use client';

import type { ReactNode } from 'react';
import { cn } from '../cn';

export type PeriodCellItem = {
  id: string;
  label: string;
  caption?: string;
  icon?: ReactNode;
};

export interface PeriodCellsProps {
  items: PeriodCellItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  uppercase?: boolean;
}

/** Equal period cells. Selected = brand wash + 3px bottom bar. */
export function PeriodCells({ items, value, onChange, className, uppercase = false }: PeriodCellsProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'grid gap-px overflow-hidden rounded-[var(--maher-radius-xl)] border border-[var(--maher-border)] bg-[var(--maher-border)]',
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}
    >
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.id)}
            className={cn(
              'maher-press relative flex min-h-12 flex-col items-center justify-center gap-0.5 bg-[var(--maher-surface)] px-2 py-2 text-center',
              selected && 'bg-[var(--maher-brand-soft)]',
            )}
          >
            {item.icon ? (
              <span className="text-[var(--maher-brand)] opacity-80">{item.icon}</span>
            ) : null}
            <span
              className={cn(
                'text-[11px] font-medium text-[var(--maher-text-primary)]',
                uppercase && 'tracking-[0.45px]',
                uppercase && 'uppercase',
              )}
            >
              {item.label}
            </span>
            {item.caption ? (
              <span className="text-[10px] text-[var(--maher-text-secondary)]">{item.caption}</span>
            ) : null}
            {selected ? (
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-[3px] bg-[var(--maher-brand)]"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
