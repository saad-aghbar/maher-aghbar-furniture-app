'use client';

import { cn } from '../cn';
import { useCountUp } from './useCountUp';

export interface AnimatedValueProps {
  value: number;
  enabled?: boolean;
  className?: string;
  durationMs?: number;
}

export function AnimatedValue({
  value,
  enabled = true,
  className,
  durationMs,
}: AnimatedValueProps) {
  const n = useCountUp(value, enabled, durationMs);
  return (
    <span
      dir="ltr"
      className={cn(
        'inline-block tabular-nums [unicode-bidi:isolate] [text-align:match-parent]',
        className,
      )}
    >
      {n.toLocaleString()}
    </span>
  );
}
