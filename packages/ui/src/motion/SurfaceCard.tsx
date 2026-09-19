'use client';

import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export interface SurfaceCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  tilt?: boolean;
  maxTilt?: number;
  sheen?: boolean;
  interactive?: boolean;
}

export function SurfaceCard({
  children,
  className,
  tilt: _tilt,
  maxTilt: _maxTilt,
  sheen: _sheen,
  interactive = true,
  style,
  ...props
}: SurfaceCardProps) {
  return (
    <div
      className={cn(
        'maher-floor-board relative overflow-hidden rounded-[20px] border border-[var(--maher-border-strong)] bg-[var(--maher-surface)] shadow-[var(--maher-shadow-sm)]',
        interactive && 'maher-press',
        className,
      )}
      style={style}
      {...props}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 start-0 w-[3px] opacity-55"
        style={{ background: 'var(--maher-brand)' } satisfies CSSProperties}
      />
      {children}
    </div>
  );
}
