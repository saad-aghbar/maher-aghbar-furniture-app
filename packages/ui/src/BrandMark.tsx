import type { HTMLAttributes } from 'react';
import { cn } from './cn';
import { BRAND_LOGO_DATA_URI } from './brand-logo-data';

export interface BrandMarkProps extends HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'md' | 'lg';
  /** Soft entrance animation for auth and hero surfaces */
  animated?: boolean;
}

const sizeClass = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
} as const;

/** Inlined PNG data URI — always available, no public-path / cache miss. */
export const BRAND_LOGO_SRC = BRAND_LOGO_DATA_URI;

export function BrandMark({
  className,
  size = 'md',
  animated = false,
  ...props
}: BrandMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--maher-radius-sm)] bg-transparent',
        animated && 'maher-brand-mark',
        sizeClass[size],
        className,
      )}
      {...props}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BRAND_LOGO_SRC}
        alt=""
        className="h-full w-auto max-w-none object-contain"
        draggable={false}
      />
    </span>
  );
}
