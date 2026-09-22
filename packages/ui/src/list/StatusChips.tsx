'use client';

import type { ReactNode } from 'react';
import { cn } from '../cn';
import type { BoardTone } from '../board/tone';
import { toneInk, toneSoft } from '../board/tone';

export interface StatusChipItem<T extends string = string> {
  id: T;
  label: ReactNode;
  count?: number | null;
  tone?: BoardTone;
  icon?: ReactNode;
}

export interface StatusChipsProps<T extends string = string> {
  items: StatusChipItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
  'aria-label'?: string;
  /** Allow horizontal scrolling on compact instead of wrapping. */
  scroll?: boolean;
}

/**
 * StatusChips — lifecycle filter row (all / preparing / in production …).
 * Paper pills with count; selected pill takes the tone's soft wash and ink.
 */
export function StatusChips<T extends string = string>({ items, value, onChange, className, scroll = true, ...aria }: StatusChipsProps<T>) {
  return (
    <div
      role="radiogroup"
      className={cn('flex gap-2', scroll ? 'overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : 'flex-wrap', className)}
      {...aria}
    >
      {items.map((item) => {
        const selected = item.id === value;
        const tone = item.tone ?? 'brand';
        const count = item.count ?? null;
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(item.id)}
            className={cn(
              'maher-press inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors',
              selected
                ? 'border-transparent'
                : 'border-[var(--maher-border)] bg-[var(--maher-surface)] text-[var(--maher-text-secondary)] hover:border-[var(--maher-border-strong)] hover:text-[var(--maher-text-primary)]',
            )}
            style={selected ? { background: toneSoft(tone), color: toneInk(tone), borderColor: `color-mix(in oklab, ${toneInk(tone)} 30%, transparent)` } : undefined}
          >
            {item.icon}
            {item.label}
            {count != null ? (
              <span
                className={cn('rounded-full px-1.5 text-[11px] tabular-nums leading-4', selected ? 'bg-[rgba(30,26,27,0.08)]' : 'bg-[var(--maher-surface-muted)] text-[var(--maher-text-tertiary)]')}
                dir="ltr"
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
