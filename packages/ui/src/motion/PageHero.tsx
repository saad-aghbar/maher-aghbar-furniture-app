import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export interface PageHeroProps extends HTMLAttributes<HTMLElement> {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  /** Kept for callers; every hero is a parchment floor board. */
  tone?: 'dark' | 'soft';
}

export function PageHero({
  title,
  description,
  actions,
  eyebrow: _eyebrow,
  meta,
  tone: _tone,
  className,
  children,
  ...props
}: PageHeroProps) {
  return (
    <section
      className={cn(
        'maher-page-hero maher-floor-board relative overflow-hidden rounded-[20px] border border-[var(--maher-border-strong)] bg-[var(--maher-surface)] shadow-[var(--maher-shadow-sm)]',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 start-0 w-[3px] bg-[var(--maher-brand)] opacity-55"
      />
      <div className="relative flex flex-col gap-4 px-5 py-5 ps-6 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-6 sm:ps-7">
        <div className="min-w-0 max-w-2xl space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--maher-text-primary)] sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="max-w-xl text-sm leading-relaxed text-[var(--maher-text-secondary)]">
              {description}
            </p>
          ) : null}
          {meta ? <div className="pt-1">{meta}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="relative px-5 pb-5 ps-6 sm:px-6 sm:pb-6 sm:ps-7">{children}</div> : null}
    </section>
  );
}
