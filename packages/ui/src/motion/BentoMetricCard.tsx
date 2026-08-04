'use client';

import type { ElementType, ReactNode } from 'react';
import { cn } from '../cn';
import { useCardMotion } from './useCardMotion';

export type BentoTone = 'neutral' | 'brand' | 'success' | 'warning' | 'error' | 'info' | 'accent';

const toneStyles: Record<
  BentoTone,
  { icon: string; accent: string; soft: string; glow: string }
> = {
  neutral: {
    icon: 'bg-[var(--maher-surface-muted)] text-[var(--maher-text-secondary)]',
    accent: 'bg-[var(--maher-border-strong)]',
    soft: 'from-transparent to-transparent',
    glow: 'rgba(154, 147, 140, 0.18)',
  },
  brand: {
    icon: 'bg-[var(--maher-brand-soft)] text-[var(--maher-brand)]',
    accent: 'bg-[var(--maher-brand)]',
    soft: 'from-[var(--maher-brand-soft)]/80 to-transparent',
    glow: 'rgba(217, 58, 43, 0.22)',
  },
  success: {
    icon: 'bg-[var(--maher-success-soft)] text-[var(--maher-success)]',
    accent: 'bg-[var(--maher-success)]',
    soft: 'from-[var(--maher-success-soft)]/80 to-transparent',
    glow: 'rgba(23, 112, 90, 0.2)',
  },
  warning: {
    icon: 'bg-[var(--maher-warning-soft)] text-[var(--maher-warning)]',
    accent: 'bg-[var(--maher-warning)]',
    soft: 'from-[var(--maher-warning-soft)]/80 to-transparent',
    glow: 'rgba(154, 106, 6, 0.2)',
  },
  error: {
    icon: 'bg-[var(--maher-error-soft)] text-[var(--maher-error)]',
    accent: 'bg-[var(--maher-error)]',
    soft: 'from-[var(--maher-error-soft)]/80 to-transparent',
    glow: 'rgba(192, 47, 34, 0.22)',
  },
  info: {
    icon: 'bg-[var(--maher-info-soft)] text-[var(--maher-info)]',
    accent: 'bg-[var(--maher-info)]',
    soft: 'from-[var(--maher-info-soft)]/80 to-transparent',
    glow: 'rgba(28, 84, 144, 0.2)',
  },
  accent: {
    icon: 'bg-[var(--maher-accent-soft)] text-[var(--maher-accent)]',
    accent: 'bg-[var(--maher-accent)]',
    soft: 'from-[var(--maher-accent-soft)]/90 to-transparent',
    glow: 'rgba(138, 90, 43, 0.22)',
  },
};

export interface BentoMetricCardProps {
  href: string;
  label: string;
  value: ReactNode;
  hint?: string;
  icon: ReactNode;
  tone?: BentoTone;
  featured?: boolean;
  delayMs?: number;
  animateValue?: boolean;
  trailingIcon?: ReactNode;
  /** Pass next-intl / next Link to keep client navigation */
  LinkComponent?: ElementType;
}

export function BentoMetricCard({
  href,
  label,
  value,
  hint,
  icon,
  tone = 'brand',
  featured,
  delayMs = 0,
  animateValue = true,
  trailingIcon,
  LinkComponent,
}: BentoMetricCardProps) {
  const styles = toneStyles[tone];
  const { ref, onMove, onLeave } = useCardMotion<HTMLAnchorElement>(featured ? 6 : 8);
  const className = cn(
    'maher-dash-card maher-press maher-sheen group relative block h-full overflow-hidden rounded-[var(--maher-radius-xl)] border border-border bg-surface shadow-card',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--maher-brand)]/30',
    featured ? 'min-h-[180px] sm:min-h-[200px]' : 'min-h-[148px]',
  );
  const style = { animationDelay: `${delayMs}ms` };

  const body = (
    <>
      <div
        className={cn(
          'pointer-events-none absolute inset-0 z-0 bg-gradient-to-br opacity-90 transition-opacity duration-500 group-hover:opacity-100',
          styles.soft,
        )}
      />
      <div
        className="maher-dash-glow pointer-events-none absolute -end-8 -top-10 z-0 h-28 w-28 rounded-full opacity-80 blur-2xl"
        style={{ background: styles.glow }}
        aria-hidden
      />
      <span
        className={cn('maher-dash-rail absolute inset-y-0 start-0 z-[3] w-1', styles.accent)}
        aria-hidden
      />
      <div className="relative z-[3] flex h-full flex-col justify-between gap-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-text-secondary transition-colors duration-300 group-hover:text-text-primary">
              {label}
            </p>
            {hint ? (
              <p className="text-xs text-text-tertiary transition-opacity duration-300 group-hover:opacity-90">
                {hint}
              </p>
            ) : null}
          </div>
          <span
            className={cn(
              'maher-dash-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--maher-radius-lg)] shadow-sm',
              styles.icon,
            )}
          >
            {icon}
          </span>
        </div>
        <div className="flex items-end justify-between gap-3">
          <p
            className={cn(
              'maher-dash-value font-semibold tracking-tight text-text-primary',
              featured ? 'text-4xl sm:text-5xl' : 'text-3xl',
              animateValue && 'maher-animate-bounce-in',
            )}
          >
            {value}
          </p>
          {trailingIcon ? (
            <span className="maher-dash-arrow flex h-8 w-8 items-center justify-center rounded-full bg-surface/80 text-text-tertiary opacity-0 shadow-sm">
              {trailingIcon}
            </span>
          ) : null}
        </div>
      </div>
    </>
  );

  if (LinkComponent) {
    const Comp = LinkComponent;
    return (
      <Comp
        ref={ref}
        href={href}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className={className}
        style={style}
      >
        {body}
      </Comp>
    );
  }

  return (
    <a
      ref={ref}
      href={href}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={className}
      style={style}
    >
      {body}
    </a>
  );
}
