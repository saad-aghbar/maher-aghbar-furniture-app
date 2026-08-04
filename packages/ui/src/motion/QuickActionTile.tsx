'use client';

import type { ElementType, ReactNode } from 'react';
import { cn } from '../cn';
import { useCardMotion } from './useCardMotion';

export interface QuickActionTileProps {
  href: string;
  label: string;
  icon: ReactNode;
  delayMs?: number;
  /** Pass next-intl / next Link to keep client navigation */
  LinkComponent?: ElementType;
  trailingIcon?: ReactNode;
}

export function QuickActionTile({
  href,
  label,
  icon,
  delayMs = 0,
  LinkComponent,
  trailingIcon,
}: QuickActionTileProps) {
  const { ref, onMove, onLeave } = useCardMotion<HTMLAnchorElement>(9);
  const className =
    'maher-dash-action maher-press maher-sheen group relative flex min-w-[132px] flex-col items-start gap-3 overflow-hidden rounded-[var(--maher-radius-xl)] border border-border bg-surface p-4 shadow-card';
  const style = { animationDelay: `${delayMs}ms` };

  const body = (
    <>
      <span className="maher-dash-icon relative z-[1] flex h-10 w-10 items-center justify-center rounded-[var(--maher-radius-md)] bg-brand-soft text-brand">
        {icon}
      </span>
      <span className="maher-dash-label relative z-[1] text-sm font-semibold text-text-primary">
        {label}
      </span>
      {trailingIcon ? (
        <span className="maher-dash-arrow absolute end-3 top-3 z-[1] opacity-0">{trailingIcon}</span>
      ) : null}
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
