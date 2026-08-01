import type { ReactNode } from 'react';
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

const toneClasses: Record<MetricTone, { icon: string; accent: string }> = {
  neutral: {
    icon: 'bg-[var(--maher-surface-muted)] text-[var(--maher-text-secondary)]',
    accent: 'bg-[var(--maher-border-strong)]',
  },
  brand: {
    icon: 'bg-[var(--maher-brand-soft)] text-[var(--maher-brand)]',
    accent: 'bg-[var(--maher-brand)]',
  },
  success: {
    icon: 'bg-[var(--maher-success-soft)] text-[var(--maher-success)]',
    accent: 'bg-[var(--maher-success)]',
  },
  warning: {
    icon: 'bg-[var(--maher-warning-soft)] text-[var(--maher-warning)]',
    accent: 'bg-[var(--maher-warning)]',
  },
  error: {
    icon: 'bg-[var(--maher-error-soft)] text-[var(--maher-error)]',
    accent: 'bg-[var(--maher-error)]',
  },
  info: {
    icon: 'bg-[var(--maher-info-soft)] text-[var(--maher-info)]',
    accent: 'bg-[var(--maher-info)]',
  },
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
  const tones = toneClasses[tone];

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-[var(--maher-radius-lg)] border border-[var(--maher-border)] bg-[var(--maher-surface)] p-5',
        'shadow-[var(--maher-shadow-sm)] transition-shadow duration-200 hover:shadow-[var(--maher-shadow-md)]',
        className,
      )}
    >
      <span className={cn('absolute inset-y-0 start-0 w-1', tones.accent)} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-[var(--maher-text-secondary)]">{label}</p>
        {icon ? (
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--maher-radius-md)]',
              tones.icon,
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="text-3xl font-semibold tracking-tight text-[var(--maher-text-primary)]">
          {value}
        </p>
        {trend ? <div className="text-sm text-[var(--maher-text-secondary)]">{trend}</div> : null}
      </div>
      {hint ? <p className="mt-1 text-xs text-[var(--maher-text-tertiary)]">{hint}</p> : null}
    </div>
  );
}
