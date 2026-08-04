'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';
import { useCardMotion } from './useCardMotion';

export interface SurfaceCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Pointer-tilt like dashboard cards */
  tilt?: boolean;
  maxTilt?: number;
  sheen?: boolean;
  interactive?: boolean;
}

export function SurfaceCard({
  children,
  className,
  tilt = false,
  maxTilt = 7,
  sheen = true,
  interactive = true,
  style,
  onMouseMove,
  onMouseLeave,
  ...props
}: SurfaceCardProps) {
  const motion = useCardMotion<HTMLDivElement>(maxTilt);

  return (
    <div
      ref={tilt ? motion.ref : undefined}
      onMouseMove={
        tilt
          ? (e) => {
              motion.onMove(e);
              onMouseMove?.(e);
            }
          : onMouseMove
      }
      onMouseLeave={
        tilt
          ? (e) => {
              motion.onLeave();
              onMouseLeave?.(e);
            }
          : onMouseLeave
      }
      className={cn(
        'maher-animate-rise overflow-hidden rounded-[var(--maher-radius-xl)] border border-border bg-surface shadow-card',
        interactive && 'maher-lift',
        sheen && 'maher-sheen',
        tilt && 'maher-dash-card maher-press',
        className,
      )}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}
