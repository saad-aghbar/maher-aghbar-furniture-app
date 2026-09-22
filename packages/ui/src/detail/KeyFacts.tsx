import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export interface KeyFact {
  label: ReactNode;
  value: ReactNode;
  ltr?: boolean;
  /** Spans the full row (addresses, notes). */
  wide?: boolean;
  muted?: boolean;
}

export interface KeyFactsProps extends HTMLAttributes<HTMLDListElement> {
  facts: KeyFact[];
  columns?: 2 | 3 | 4;
}

/** KeyFacts — a label-over-value grid for the descriptive facts of a record. */
export function KeyFacts({ facts, columns = 3, className, ...props }: KeyFactsProps) {
  return (
    <dl
      className={cn(
        'grid gap-x-6 gap-y-4',
        columns === 2 && 'grid-cols-1 sm:grid-cols-2',
        columns === 3 && 'grid-cols-2 sm:grid-cols-3',
        columns === 4 && 'grid-cols-2 sm:grid-cols-4',
        className,
      )}
      {...props}
    >
      {facts.map((f, i) => (
        <div key={i} className={cn('min-w-0', f.wide && 'col-span-full')}>
          <dt className="text-[12px] leading-4 text-[var(--maher-text-tertiary)]">{f.label}</dt>
          <dd
            className={cn('mt-0.5 break-words text-[14px] leading-5', f.muted ? 'text-[var(--maher-text-secondary)]' : 'font-medium text-[var(--maher-text-primary)]', f.ltr && 'tabular-nums')}
            dir={f.ltr ? 'ltr' : undefined}
          >
            {f.value ?? '—'}
          </dd>
        </div>
      ))}
    </dl>
  );
}
