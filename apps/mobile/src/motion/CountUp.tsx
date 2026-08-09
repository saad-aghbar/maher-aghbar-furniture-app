import { useEffect, useRef, useState } from 'react';
import { AppText } from '@/components/AppText';
import { toLatinDigits } from '@/i18n/format';
import { useReducedMotion } from '@/motion/useReducedMotion';
import { durations, withMotionDuration } from '@/motion/presets';

type CountUpProps = {
  value: number;
  /** Format the integer display value (e.g. currency). */
  format?: (n: number) => string;
  accessibilityLabel?: string;
  color?: string;
  variant?: 'heading' | 'largeTitle' | 'title';
};

/**
 * Animates numeric display only when `value` changes after the first paint.
 * Respects Reduce Motion (snaps immediately). Always Latin digits + LTR run.
 */
export function CountUp({
  value,
  format,
  accessibilityLabel,
  color,
  variant = 'heading',
}: CountUpProps) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const prevRef = useRef<number | null>(null);

  useEffect(() => {
    const safe = Number.isFinite(value) ? value : 0;

    if (prevRef.current === null) {
      prevRef.current = safe;
      setDisplay(safe);
      return;
    }

    if (prevRef.current === safe) return;

    const from = prevRef.current;
    prevRef.current = safe;

    if (reduce) {
      setDisplay(safe);
      return;
    }

    const durationMs = withMotionDuration(durations.cardEnter, reduce);
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (safe - from) * eased;
      setDisplay(format ? next : Math.round(next));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduce, format]);

  const text = toLatinDigits(format ? format(display) : String(Math.round(display)));

  return (
    <AppText
      variant={variant}
      weight="semibold"
      dir="ltr"
      accessibilityLabel={accessibilityLabel ?? text}
      style={{ fontVariant: ['tabular-nums'], ...(color ? { color } : null) }}
    >
      {text}
    </AppText>
  );
}
