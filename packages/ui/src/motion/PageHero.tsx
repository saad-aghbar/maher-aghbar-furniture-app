import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export interface PageHeroProps extends HTMLAttributes<HTMLElement> {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  /** Compact branded band for list/hub pages */
  tone?: 'dark' | 'soft';
}

export function PageHero({
  title,
  description,
  actions,
  eyebrow,
  meta,
  tone = 'soft',
  className,
  children,
  ...props
}: PageHeroProps) {
  const dark = tone === 'dark';

  return (
    <section
      className={cn(
        'maher-page-hero relative overflow-hidden rounded-[var(--maher-radius-xl)] border',
        dark
          ? 'border-[#3f342c]/40 bg-[#1c1612] text-white shadow-float'
          : 'border-border bg-surface shadow-card',
        className,
      )}
      {...props}
      data-header-contrast={dark ? 'dark' : undefined}
    >
      {dark ? (
        <>
          <div
            className="pointer-events-none absolute inset-0 opacity-90"
            style={{
              background:
                'radial-gradient(ellipse 80% 70% at 10% 20%, rgba(217,58,43,0.28), transparent 55%), radial-gradient(ellipse 60% 50% at 90% 80%, rgba(138,90,43,0.32), transparent 50%), linear-gradient(135deg, #241c16 0%, #1a1410 45%, #2a2018 100%)',
            }}
            aria-hidden
          />
          <div
            className="maher-animate-spotlight pointer-events-none absolute -start-8 top-0 h-40 w-40 rounded-full bg-[var(--maher-brand)]/20 blur-3xl"
            aria-hidden
          />
          <div
            className="maher-animate-drift pointer-events-none absolute -end-6 bottom-0 h-36 w-36 rounded-full bg-[var(--maher-accent)]/30 blur-3xl"
            aria-hidden
          />
        </>
      ) : (
        <>
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--maher-brand-soft)]/70 via-transparent to-[var(--maher-accent-soft)]/50"
            aria-hidden
          />
          <div
            className="maher-animate-spotlight pointer-events-none absolute -start-10 -top-8 h-44 w-44 rounded-full bg-[var(--maher-brand)]/15 blur-3xl"
            aria-hidden
          />
          <div
            className="maher-animate-drift pointer-events-none absolute -end-8 -bottom-10 h-40 w-40 rounded-full bg-[var(--maher-accent)]/20 blur-3xl"
            aria-hidden
          />
          <div className="maher-page-hero__rail" aria-hidden />
        </>
      )}

      <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div className="maher-animate-rise min-w-0 max-w-2xl space-y-2">
          {eyebrow ? (
            <div
              className={cn(
                'inline-flex items-center gap-2 text-xs font-medium',
                dark ? 'text-white/70' : 'text-text-tertiary',
              )}
            >
              {eyebrow}
            </div>
          ) : null}
          <h1
            className={cn(
              'text-2xl font-bold tracking-tight sm:text-3xl',
              dark ? 'text-white' : 'text-text-primary',
            )}
          >
            {title}
          </h1>
          {description ? (
            <p
              className={cn(
                'maher-animate-fade max-w-xl text-sm leading-relaxed',
                dark ? 'text-white/70' : 'text-text-secondary',
              )}
              style={{ animationDelay: '80ms' }}
            >
              {description}
            </p>
          ) : null}
          {meta ? <div className="pt-1">{meta}</div> : null}
        </div>
        {actions ? (
          <div className="maher-animate-in-end flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {children ? <div className="relative px-5 pb-5 sm:px-6 sm:pb-6">{children}</div> : null}
    </section>
  );
}
