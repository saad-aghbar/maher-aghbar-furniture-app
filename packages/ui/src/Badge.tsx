import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export type BadgeVariant = 'default' | 'brand' | 'success' | 'warning' | 'error' | 'info';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  default:
    'bg-[var(--maher-surface-muted)] text-[var(--maher-text-secondary)] border-[var(--maher-border)]',
  brand:
    'bg-[var(--maher-brand-soft)] text-[var(--maher-brand)] border-[var(--maher-brand-border)]',
  success:
    'bg-[var(--maher-success-soft)] text-[var(--maher-success)] border-[var(--maher-success)]/20',
  warning:
    'bg-[var(--maher-warning-soft)] text-[var(--maher-warning)] border-[var(--maher-warning)]/20',
  error: 'bg-[var(--maher-error-soft)] text-[var(--maher-error)] border-[var(--maher-error)]/20',
  info: 'bg-[var(--maher-info-soft)] text-[var(--maher-info)] border-[var(--maher-info)]/20',
};

export function Badge({ className, variant = 'default', dot, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'maher-animate-bounce-in inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium',
        'transition-colors duration-200 ease-out',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {dot ? (
        <span
          className="h-1.5 w-1.5 rounded-full bg-current opacity-70"
          style={{ animation: 'maher-pulse-soft 2s ease-in-out infinite' }}
          aria-hidden="true"
        />
      ) : null}
      {children}
    </span>
  );
}
