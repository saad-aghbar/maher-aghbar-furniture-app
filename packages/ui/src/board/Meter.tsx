import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';
import { toneInk, type BoardTone } from './tone';

export interface MeterProps extends HTMLAttributes<HTMLSpanElement> {
  value: number;
  max: number;
  /** Optional target tick, in the same unit as `value`. */
  target?: number;
  tone?: BoardTone;
  label?: ReactNode;
  /** Trailing value text; defaults to `value` when omitted and `showValue`. */
  valueLabel?: ReactNode;
  showValue?: boolean;
  size?: 'sm' | 'md';
}

/** Meter — a horizontal fill against a ceiling, with an optional target tick. Renders spans so it can sit inside links and rows. */
export function Meter({
  value,
  max,
  target,
  tone = 'brand',
  label,
  valueLabel,
  showValue = true,
  size = 'md',
  className,
  ...props
}: MeterProps) {
  const safeMax = max > 0 ? max : 1;
  const pct = Math.max(0, Math.min(100, (value / safeMax) * 100));
  const targetPct =
    target != null ? Math.max(0, Math.min(100, (target / safeMax) * 100)) : null;
  return (
    <span className={cn('block min-w-0', className)} {...props}>
      {label || showValue ? (
        <span className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px] leading-5">
          <span className="truncate text-[var(--maher-text-secondary)]">{label}</span>
          {showValue ? (
            <span className="shrink-0 font-medium tabular-nums text-[var(--maher-text-primary)]" dir="ltr">
              {valueLabel ?? value.toLocaleString('en-JO')}
            </span>
          ) : null}
        </span>
      ) : null}
      <span
        className={cn(
          'relative block w-full overflow-hidden rounded-full bg-[var(--maher-surface-muted)]',
          size === 'sm' ? 'h-1.5' : 'h-2',
        )}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={value}
      >
        <span
          className="maher-meter-fill absolute inset-y-0 start-0 rounded-full"
          style={
            {
              width: `${pct}%`,
              background: `linear-gradient(90deg, color-mix(in oklab, ${toneInk(tone)} 78%, var(--maher-surface)), ${toneInk(tone)})`,
            } as CSSProperties
          }
        />
        {targetPct != null ? (
          <span
            aria-hidden
            className="absolute inset-y-[-2px] w-px bg-[var(--maher-text-primary)] opacity-60"
            style={{ insetInlineStart: `${targetPct}%` } as CSSProperties}
          />
        ) : null}
      </span>
    </span>
  );
}
