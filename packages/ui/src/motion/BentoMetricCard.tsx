'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { AppLinkComponent } from '../AppLinkComponent';
import { cn } from '../cn';

export type BentoTone = 'neutral' | 'brand' | 'success' | 'warning' | 'error' | 'info' | 'accent';

const toneAccent: Record<BentoTone, string> = {
  neutral: 'var(--maher-brand)',
  brand: 'var(--maher-brand)',
  success: 'var(--maher-success)',
  warning: 'var(--maher-warning)',
  error: 'var(--maher-error)',
  info: 'var(--maher-info)',
  accent: 'var(--maher-accent)',
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
  LinkComponent?: AppLinkComponent;
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
  trailingIcon,
  LinkComponent,
}: BentoMetricCardProps) {
  const className = cn(
    'maher-floor-board maher-press group relative block h-full overflow-hidden rounded-[20px] border border-[var(--maher-border-strong)] bg-[var(--maher-surface)] shadow-[var(--maher-shadow-sm)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--maher-brand)]/30',
    featured ? 'min-h-[148px]' : 'min-h-[132px]',
  );
  const style = { animationDelay: `${delayMs}ms` };

  const body = (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 start-0 w-[3px] opacity-55"
        style={{ background: toneAccent[tone] } satisfies CSSProperties}
      />
      <div className="relative flex h-full flex-col justify-between gap-4 px-5 py-5 ps-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-[var(--maher-text-secondary)]">{label}</p>
            {hint ? <p className="text-xs text-[var(--maher-text-tertiary)]">{hint}</p> : null}
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--maher-surface-muted)] text-[var(--maher-text-secondary)]">
            {icon}
          </span>
        </div>
        <div className="flex items-end justify-between gap-3">
          <p
            className={cn(
              'font-semibold tabular-nums tracking-tight text-[var(--maher-text-primary)]',
              featured ? 'text-3xl sm:text-4xl' : 'text-2xl',
            )}
          >
            {value}
          </p>
          {trailingIcon ? (
            <span className="flex h-8 w-8 items-center justify-center text-[var(--maher-text-tertiary)]">
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
      <Comp href={href} className={className} style={style}>
        {body}
      </Comp>
    );
  }

  return (
    <a href={href} className={className} style={style}>
      {body}
    </a>
  );
}
