import type { ReactNode } from 'react';
import { cn } from './cn';

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  trend?: ReactNode;
  className?: string;
}

export function MetricCard({ label, value, hint, trend, className }: MetricCardProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--maher-radius-lg)] border border-[var(--maher-border)] bg-[var(--maher-surface)] p-5 shadow-[var(--maher-shadow-sm)]',
        className,
      )}
    >
      <p className="text-sm font-medium text-[var(--maher-text-secondary)]">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="text-2xl font-semibold text-[var(--maher-text-primary)]">{value}</p>
        {trend ? <div className="text-sm text-[var(--maher-text-secondary)]">{trend}</div> : null}
      </div>
      {hint ? <p className="mt-1 text-xs text-[var(--maher-text-secondary)]">{hint}</p> : null}
    </div>
  );
}
