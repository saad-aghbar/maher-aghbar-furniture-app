import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export interface PageHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Optional back control or breadcrumb row above the title */
  leading?: ReactNode;
}

/**
 * @deprecated Prefer `DetailHero` (detail pages) or a hero `Board` (list pages).
 * `PageHeader` now renders on the Board recipe so legacy pages match the kit.
 */
export function PageHeader({ title, description, actions, leading, className, ...props }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'maher-board maher-board--wash-top maher-page-header relative overflow-hidden rounded-[18px] border border-[var(--maher-border)] bg-[var(--maher-surface)] px-5 py-5 sm:px-6',
        className,
      )}
      {...props}
    >
      {leading ? <div className="maher-animate-fade mb-2">{leading}</div> : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="maher-animate-in-start text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{title}</h1>
          {description ? (
            <p className="maher-animate-in-start mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]" style={{ animationDelay: '70ms' }}>
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="maher-animate-in-end flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
