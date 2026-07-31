import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  children?: ReactNode;
}

const variantClasses: Record<AlertVariant, string> = {
  info: 'border-sky-200 bg-sky-50 text-[var(--maher-info)]',
  success: 'border-emerald-200 bg-emerald-50 text-[var(--maher-success)]',
  warning: 'border-amber-200 bg-amber-50 text-[var(--maher-warning)]',
  error: 'border-red-200 bg-red-50 text-[var(--maher-error)]',
};

export function Alert({ variant = 'info', title, children, className, ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn('rounded-[var(--maher-radius-md)] border px-4 py-3 text-sm', variantClasses[variant], className)}
      {...props}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? 'mt-1 opacity-90' : undefined}>{children}</div> : null}
    </div>
  );
}
