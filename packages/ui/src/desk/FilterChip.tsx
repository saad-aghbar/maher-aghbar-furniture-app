'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export interface FilterChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  children: ReactNode;
  /** Trailing count. */
  count?: number | null;
}

/** Filter chip: paper pill; selected = brand wash + brand ink. No rails. */
export function FilterChip({ selected, className, children, count, type = 'button', ...props }: FilterChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected || undefined}
      className={cn(
        'maher-press inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors',
        selected
          ? 'border-[color:color-mix(in_oklab,var(--maher-brand)_35%,transparent)] bg-[var(--maher-brand-soft)] text-[var(--maher-brand)]'
          : 'border-[var(--maher-border)] bg-[var(--maher-surface)] text-[var(--maher-text-primary)] hover:border-[var(--maher-border-strong)]',
        className,
      )}
      {...props}
    >
      {children}
      {count != null ? (
        <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums leading-4', selected ? 'bg-[rgba(30,26,27,0.08)]' : 'bg-[var(--maher-surface-muted)] text-[var(--maher-text-tertiary)]')} dir="ltr">
          {count}
        </span>
      ) : null}
    </button>
  );
}
