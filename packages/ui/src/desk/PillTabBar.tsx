'use client';

import type { ReactNode } from 'react';
import { cn } from '../cn';

export type PillTabItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: number | string;
};

export interface PillTabBarProps {
  items: PillTabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  size?: 'sm' | 'md';
}

const WOOD = ['#8a7354', '#7a6248', '#776245'];

/** Desktop pill / wood-bubble tab bar. Selected = brand wash fill. */
export function PillTabBar({ items, value, onChange, className, size = 'md' }: PillTabBarProps) {
  const index = Math.max(
    0,
    items.findIndex((item) => item.id === value),
  );
  const fill = WOOD[Math.min(index, WOOD.length - 1)] ?? WOOD[0];
  const height = size === 'sm' ? 'h-9' : 'h-10';

  return (
    <div
      role="tablist"
      className={cn(
        'relative flex overflow-hidden rounded-full border border-[var(--maher-border)] bg-[var(--maher-surface-muted)] p-0.5',
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-0.5 bottom-0.5 rounded-full transition-[inset-inline-start,width,background-color] duration-200"
        style={{
          width: `calc(${100 / Math.max(items.length, 1)}% - 4px)`,
          insetInlineStart: `calc(${(index * 100) / Math.max(items.length, 1)}% + 2px)`,
          backgroundColor: fill,
        }}
      />
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
              'maher-press relative z-[1] flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-sm font-medium',
              height,
              selected ? 'text-white' : 'text-[var(--maher-text-secondary)] hover:text-[var(--maher-text-primary)]',
            )}
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
            {item.badge != null && item.badge !== 0 && item.badge !== '0' ? (
              <span
                className={cn(
                  'rounded-full px-1.5 text-[10px] font-medium',
                  selected ? 'bg-white/20' : 'bg-[var(--maher-brand-soft)] text-[var(--maher-brand)]',
                )}
              >
                {item.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export type InboxCellItem = {
  id: string;
  label: string;
  icon?: ReactNode;
};

/** Five-way inbox (3 + 2). Selected = brand wash + 3px bottom bar. */
export function InboxCellGrid({
  items,
  value,
  onChange,
  className,
}: {
  items: InboxCellItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const first = items.slice(0, 3);
  const rest = items.slice(3);
  const row = (rowItems: InboxCellItem[]) => (
    <div className="flex gap-2">
      {rowItems.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              'maher-press relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 rounded-[var(--maher-radius-lg)] border px-2 py-2',
              selected
                ? 'border-[var(--maher-brand)] bg-[var(--maher-brand-soft)] text-[var(--maher-brand)]'
                : 'border-[var(--maher-border)] bg-[var(--maher-surface)] text-[var(--maher-text-secondary)]',
            )}
          >
            {item.icon}
            <span className="text-center text-[11px] font-medium">{item.label}</span>
            {selected ? (
              <span aria-hidden className="absolute inset-x-2 bottom-0 h-[3px] bg-[var(--maher-brand)]" />
            ) : null}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className={cn('space-y-2', className)}>
      {row(first)}
      {rest.length ? row(rest) : null}
    </div>
  );
}
