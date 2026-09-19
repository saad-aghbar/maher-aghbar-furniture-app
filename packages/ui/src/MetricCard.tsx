import type { CSSProperties, ReactNode } from 'react';
import { cn } from './cn';

export type MetricTone = 'neutral' | 'brand' | 'success' | 'warning' | 'error' | 'info';

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  trend?: ReactNode;
  icon?: ReactNode;
  tone?: MetricTone;
  className?: string;
}

const toneAccent: Record<MetricTone, string> = {
  neutral: 'var(--maher-brand)',
  brand: 'var(--maher-brand)',
  success: 'var(--maher-success)',
  warning: 'var(--maher-warning)',
  error: 'var(--maher-error)',
  info: 'var(--maher-info)',
};

export function MetricCard({
  label,
  value,
  hint,
  trend,
  icon,
  tone = 'neutral',
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        'maher-floor-board relative overflow-hidden rounded-[20px] border border-[var(--maher-border-strong)] bg-[var(--maher-surface)] p-5 ps-6 shadow-[var(--maher-shadow-sm)]',
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 start-0 w-[3px] opacity-55"
        style={{ background: toneAccent[tone] } satisfies CSSProperties}
      />
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-[var(--maher-text-secondary)]">{label}</p>
        {icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--maher-surface-muted)] text-[var(--maher-text-secondary)]">
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="text-3xl font-semibold tracking-tight text-[var(--maher-text-primary)] tabular-nums">
          {value}
        </p>
        {trend ? <div className="text-sm text-[var(--maher-text-secondary)]">{trend}</div> : null}
      </div>
      {hint ? <p className="mt-1 text-xs text-[var(--maher-text-tertiary)]">{hint}</p> : null}
    </div>
  );
}
