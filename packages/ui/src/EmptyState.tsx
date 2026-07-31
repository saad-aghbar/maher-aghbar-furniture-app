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
        'flex flex-col items-center justify-center rounded-[var(--maher-radius-lg)] border border-dashed border-[var(--maher-border)] bg-[var(--maher-surface)] px-6 py-12 text-center',
        className,
      )}
    >
      {icon ? <div className="mb-4 text-[var(--maher-text-secondary)]">{icon}</div> : null}
      <h3 className="text-base font-semibold text-[var(--maher-text-primary)]">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-[var(--maher-text-secondary)]">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
