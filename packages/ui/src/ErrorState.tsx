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
        'flex flex-col items-center justify-center rounded-[var(--maher-radius-lg)] border border-red-200 bg-red-50 px-6 py-12 text-center',
        className,
      )}
      role="alert"
    >
      <h3 className="text-base font-semibold text-[var(--maher-error)]">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-[var(--maher-text-secondary)]">{description}</p>
      ) : null}
      <div className="mt-4 flex gap-2">
        {onRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : null}
        {action}
      </div>
    </div>
  );
}
