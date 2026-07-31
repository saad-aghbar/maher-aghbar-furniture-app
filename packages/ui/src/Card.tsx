import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function Card({ className, title, description, actions, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--maher-radius-lg)] border border-[var(--maher-border)] bg-[var(--maher-surface)] shadow-[var(--maher-shadow-sm)]',
        className,
      )}
      {...props}
    >
      {(title || description || actions) && (
        <div className="flex items-start justify-between gap-4 border-b border-[var(--maher-border)] px-5 py-4">
          <div>
            {title ? (
              <h3 className="text-base font-semibold text-[var(--maher-text-primary)]">{title}</h3>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm text-[var(--maher-text-secondary)]">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
