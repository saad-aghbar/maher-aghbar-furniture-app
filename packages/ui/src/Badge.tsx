import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export type BadgeVariant = 'default' | 'brand' | 'success' | 'warning' | 'error' | 'info';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-[var(--maher-background)] text-[var(--maher-text-primary)] border-[var(--maher-border)]',
  brand: 'bg-[var(--maher-brand)]/10 text-[var(--maher-brand)] border-[var(--maher-brand)]/20',
  success: 'bg-emerald-50 text-[var(--maher-success)] border-emerald-200',
  warning: 'bg-amber-50 text-[var(--maher-warning)] border-amber-200',
  error: 'bg-red-50 text-[var(--maher-error)] border-red-200',
  info: 'bg-sky-50 text-[var(--maher-info)] border-sky-200',
};

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
