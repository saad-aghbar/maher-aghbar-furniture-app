import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  footer?: ReactNode;
  padded?: boolean;
  /** Adds hover lift + stronger elevation for cards that behave like controls. */
  interactive?: boolean;
}

export function Card({
  className,
  title,
  description,
  actions,
  icon,
  footer,
  padded = true,
  interactive,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'maher-floor-board group relative overflow-hidden rounded-[20px] border border-[var(--maher-border-strong)] bg-[var(--maher-surface)] shadow-[var(--maher-shadow-sm)]',
        interactive && 'maher-press cursor-pointer hover:shadow-[var(--maher-shadow-md)]',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 start-0 w-[3px] opacity-55"
        style={{ background: 'var(--maher-brand)' } satisfies CSSProperties}
      />
      {(title || description || actions) && (
        <div className="flex items-start justify-between gap-4 border-b border-[var(--maher-border)] bg-[var(--maher-surface-muted)] px-5 py-3 ps-6">
          <div className="flex min-w-0 items-start gap-3">
            {icon ? (
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--maher-brand-soft)] text-[var(--maher-brand)]">
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
      <div className={cn(padded && 'p-5', 'ps-6')}>{children}</div>
      {footer ? (
        <div className="border-t border-[var(--maher-border)] bg-[var(--maher-surface-muted)] px-5 py-3 ps-6">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
