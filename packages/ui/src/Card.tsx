import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  footer?: ReactNode;
  padded?: boolean;
}

export function Card({
  className,
  title,
  description,
  actions,
  icon,
  footer,
  padded = true,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[var(--maher-radius-lg)] border border-[var(--maher-border)] bg-[var(--maher-surface)] shadow-[var(--maher-shadow-sm)]',
        className,
      )}
      {...props}
    >
      {(title || description || actions) && (
        <div className="flex items-start justify-between gap-4 border-b border-[var(--maher-border)] px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            {icon ? (
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--maher-radius-md)] bg-[var(--maher-brand-soft)] text-[var(--maher-brand)]">
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              {title ? (
                <h3 className="truncate text-base font-semibold text-[var(--maher-text-primary)]">
                  {title}
                </h3>
              ) : null}
              {description ? (
                <p className="mt-0.5 text-sm text-[var(--maher-text-secondary)]">{description}</p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      )}
      <div className={padded ? 'p-5' : undefined}>{children}</div>
      {footer ? (
        <div className="border-t border-[var(--maher-border)] bg-[var(--maher-surface-muted)] px-5 py-3">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
