import type { ReactNode } from 'react';
import { cn } from './cn';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'maher-animate-rise flex flex-col items-center justify-center rounded-[var(--maher-radius-lg)] border border-dashed border-[var(--maher-border-strong)] bg-[var(--maher-surface)] px-6 py-16 text-center',
        'transition-colors duration-300 hover:border-[var(--maher-brand-border)]',
        className,
      )}
    >
      <div className="maher-animate-float mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--maher-surface-muted)] text-[var(--maher-text-tertiary)]">
        {icon ?? (
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z" />
            <path d="M3 7.5 12 12m0 0 9-4.5M12 12v9" />
          </svg>
        )}
      </div>
      <h3 className="text-base font-semibold text-[var(--maher-text-primary)]">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-md text-sm text-[var(--maher-text-secondary)]">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
