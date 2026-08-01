import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export interface PageHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5',
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        <h1 className="maher-animate-in-start text-2xl font-bold tracking-tight text-text-primary">
          {title}
        </h1>
        {description ? (
          <p
            className="maher-animate-in-start mt-1.5 max-w-2xl text-sm text-text-secondary"
            style={{ animationDelay: '70ms' }}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="maher-animate-in-end flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
