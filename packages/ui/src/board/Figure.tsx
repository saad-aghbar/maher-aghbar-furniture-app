'use client';

import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';
import { AnimatedValue } from '../motion/AnimatedValue';
import { toneInk, type BoardTone } from './tone';

export interface FigureProps extends HTMLAttributes<HTMLDivElement> {
  /** Numbers count up; any other node renders as-is (already formatted money, ratios). */
  value: number | ReactNode;
  unit?: ReactNode;
  label?: ReactNode;
  /** Small trailing note: delta, comparison, "of N". */
  delta?: ReactNode;
  tone?: BoardTone;
  size?: 'sm' | 'md' | 'lg';
  /** Disable count-up (reduced motion / static contexts). */
  animate?: boolean;
  /** Pass the active locale; Arabic keeps default tracking. */
  locale?: string;
}

const SIZE = {
  sm: 'text-xl leading-6',
  md: 'text-[28px] leading-8',
  lg: 'text-[40px] leading-[44px]',
} as const;

/** Figure — one number that carries weight. Tabular, tight tracking, tone in the ink. */
export function Figure({
  value,
  unit,
  label,
  delta,
  tone,
  size = 'md',
  animate = true,
  locale,
  className,
  style,
  ...props
}: FigureProps) {
  const tracking = locale === 'ar' ? undefined : '-0.02em';
  const ink = tone && tone !== 'neutral' ? toneInk(tone) : 'var(--maher-text-primary)';
  return (
    <div className={cn('min-w-0', className)} style={style} {...props}>
      {label ? (
        <p className="text-[13px] leading-5 text-[var(--maher-text-secondary)]">{label}</p>
      ) : null}
      <p
        className={cn('flex items-baseline gap-1 font-semibold tabular-nums', SIZE[size])}
        style={{ color: ink, letterSpacing: tracking } as CSSProperties}
      >
        {typeof value === 'number' ? (
          <AnimatedValue value={value} enabled={animate} />
        ) : (
          <span dir="ltr" className="[unicode-bidi:isolate]">
            {value}
          </span>
        )}
        {unit ? (
          <span className="text-sm font-medium text-[var(--maher-text-tertiary)]">{unit}</span>
        ) : null}
      </p>
      {delta ? (
        <p className="mt-0.5 text-xs leading-4 text-[var(--maher-text-tertiary)]">{delta}</p>
      ) : null}
    </div>
  );
}
