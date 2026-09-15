'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export interface FilterChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  children: ReactNode;
}

/** Sheet/filter chip: selected = brand wash + 3px start rail. */
export function FilterChip({ selected, className, children, type = 'button', ...props }: FilterChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected || undefined}
      className={cn(
        'maher-press relative inline-flex min-h-10 items-center rounded-[var(--maher-radius-lg)] border px-3 text-sm font-medium',
        selected
          ? 'border-[var(--maher-brand)] bg-[var(--maher-brand-soft)] ps-4 text-[var(--maher-brand)]'
          : 'border-[var(--maher-border)] bg-[var(--maher-surface)] text-[var(--maher-text-primary)] hover:border-[var(--maher-border-strong)]',
        className,
      )}
      {...props}
    >
      {selected ? (
        <span
          aria-hidden
          className="absolute inset-y-0 start-0 w-[3px] bg-[var(--maher-brand)]"
        />
      ) : null}
      {children}
    </button>
  );
}
