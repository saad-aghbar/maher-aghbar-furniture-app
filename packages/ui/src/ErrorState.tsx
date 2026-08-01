import type { ReactNode } from 'react';
import { cn } from './cn';
import { Button } from './Button';

export interface ErrorStateProps {
  title: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = 'Retry',
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[var(--maher-radius-lg)] border border-[var(--maher-error)]/20 bg-[var(--maher-error-soft)] px-6 py-14 text-center',
        className,
      )}
      role="alert"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--maher-surface)] text-[var(--maher-error)] shadow-[var(--maher-shadow-sm)]">
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 8v5m0 3h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-[var(--maher-error)]">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-md text-sm text-[var(--maher-text-secondary)]">{description}</p>
      ) : null}
      {(onRetry || action) && (
        <div className="mt-5 flex gap-2">
          {onRetry ? (
            <Button variant="secondary" onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
          {action}
        </div>
      )}
    </div>
  );
}
