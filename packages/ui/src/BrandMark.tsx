import type { HTMLAttributes } from 'react';
import { cn } from './cn';
import {
  BRAND_LOGO_LOCKUP_DARK_URI,
  BRAND_LOGO_LOCKUP_LIGHT_URI,
  BRAND_LOGO_MARK_DARK_URI,
  BRAND_LOGO_MARK_LIGHT_URI,
} from './brand-logo-data';

export interface BrandMarkProps extends HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Soft entrance animation for auth and hero surfaces */
  animated?: boolean;
  /** Compact sofa “M” mark, or full primary lockup (auth heroes). */
  variant?: 'mark' | 'lockup';
  /**
   * Which artwork to show:
   * - `auto` — follow `html[data-theme]` (default)
   * - `on-light` — dark ink on light surfaces
   * - `on-dark` — light ink on Liquorice / dark panels (auth heroes)
   */
  tone?: 'auto' | 'on-light' | 'on-dark';
}

const sizeClass = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
  /** Guideline digital minimum for logomark (~130px) */
  xl: 'h-32 w-32',
} as const;

const lockupSizeClass = {
  sm: 'h-8 w-auto',
  md: 'h-10 w-auto',
  lg: 'h-14 w-auto',
  /** Guideline digital minimum for primary logo (~200px wide) */
  xl: 'h-[4.5rem] w-auto max-w-[14rem] sm:h-28 sm:max-w-[16rem]',
} as const;

/** Default mark (on-light) — always available, no public-path / cache miss. */
export const BRAND_LOGO_SRC = BRAND_LOGO_MARK_LIGHT_URI;

export function BrandMark({
  className,
  size = 'md',
  animated = false,
  variant = 'mark',
  tone = 'auto',
  ...props
}: BrandMarkProps) {
  const lightSrc = variant === 'lockup' ? BRAND_LOGO_LOCKUP_LIGHT_URI : BRAND_LOGO_MARK_LIGHT_URI;
  const darkSrc = variant === 'lockup' ? BRAND_LOGO_LOCKUP_DARK_URI : BRAND_LOGO_MARK_DARK_URI;
  const boxClass = variant === 'lockup' ? lockupSizeClass[size] : sizeClass[size];

  const src =
    tone === 'on-dark' ? darkSrc : tone === 'on-light' ? lightSrc : null;

  return (
    <span
      aria-hidden="true"
      data-tone={tone}
      className={cn(
        'maher-brand-mark-root relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--maher-radius-sm)] bg-transparent',
        animated && 'maher-brand-mark',
        boxClass,
        className,
      )}
      {...props}
    >
      {src ? (
        // Forced tone — single image
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="h-full w-auto max-w-none object-contain"
          draggable={false}
        />
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightSrc}
            alt=""
            className="maher-brand-mark__on-light h-full w-auto max-w-none object-contain"
            draggable={false}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={darkSrc}
            alt=""
            className="maher-brand-mark__on-dark absolute inset-0 m-auto h-full w-auto max-w-none object-contain"
            draggable={false}
          />
        </>
      )}
    </span>
  );
}
