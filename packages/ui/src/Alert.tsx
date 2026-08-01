import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  icon?: ReactNode;
  children?: ReactNode;
}

const variantClasses: Record<AlertVariant, string> = {
  info: 'border-[var(--maher-info)]/20 bg-[var(--maher-info-soft)] text-[var(--maher-info)]',
  success:
    'border-[var(--maher-success)]/20 bg-[var(--maher-success-soft)] text-[var(--maher-success)]',
  warning:
    'border-[var(--maher-warning)]/20 bg-[var(--maher-warning-soft)] text-[var(--maher-warning)]',
  error: 'border-[var(--maher-error)]/20 bg-[var(--maher-error-soft)] text-[var(--maher-error)]',
};

const iconPaths: Record<AlertVariant, ReactNode> = {
  info: <path d="M10 9v5m0-8h.01M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />,
  success: <path d="m6.5 10.5 2.5 2.5 4.5-5M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />,
  warning: <path d="M10 7.5v3.5m0 3h.01M8.6 3.2 2.3 14.1A1.6 1.6 0 0 0 3.7 16.5h12.6a1.6 1.6 0 0 0 1.4-2.4L11.4 3.2a1.6 1.6 0 0 0-2.8 0Z" />,
  error: <path d="M10 6.5v4m0 3h.01M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />,
};

export function Alert({ variant = 'info', title, icon, children, className, ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-[var(--maher-radius-md)] border px-4 py-3 text-sm',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      <span className="mt-0.5 shrink-0">
        {icon ?? (
          <svg
            viewBox="0 0 20 20"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {iconPaths[variant]}
          </svg>
        )}
      </span>
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? 'mt-1 opacity-90' : undefined}>{children}</div> : null}
      </div>
    </div>
  );
}
