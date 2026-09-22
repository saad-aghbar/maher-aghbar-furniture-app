import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';
import { toneInk, type BoardTone } from './tone';

export interface RibbonSegment {
  key: string;
  value: number;
  label: ReactNode;
  tone?: BoardTone;
}

export interface RibbonProps extends HTMLAttributes<HTMLDivElement> {
  segments: RibbonSegment[];
  legend?: boolean;
  size?: 'sm' | 'md';
}

const FALLBACK_TONES: BoardTone[] = ['brand', 'info', 'success', 'warning', 'error', 'neutral'];

/** Ribbon — one bar split into proportional segments, joined by soft gradients. */
export function Ribbon({ segments, legend = true, size = 'md', className, ...props }: RibbonProps) {
  const live = segments.filter((s) => s.value > 0);
  const total = live.reduce((s, x) => s + x.value, 0);
  return (
    <div className={cn('min-w-0', className)} {...props}>
      <div
        className={cn(
          'flex w-full overflow-hidden rounded-full bg-[var(--maher-surface-muted)]',
          size === 'sm' ? 'h-2' : 'h-2.5',
        )}
        role="img"
      >
        {total > 0
          ? live.map((seg, i) => {
              const ink = toneInk(seg.tone ?? FALLBACK_TONES[i % FALLBACK_TONES.length]);
              const next = live[i + 1];
              const nextInk = next
                ? toneInk(next.tone ?? FALLBACK_TONES[(i + 1) % FALLBACK_TONES.length])
                : ink;
              return (
                <span
                  key={seg.key}
                  className="maher-ribbon-seg h-full"
                  style={
                    {
                      width: `${(seg.value / total) * 100}%`,
                      background: `linear-gradient(90deg, ${ink} 0%, ${ink} 82%, color-mix(in oklab, ${ink} 55%, ${nextInk}) 100%)`,
                      animationDelay: `${i * 60}ms`,
                    } as CSSProperties
                  }
                />
              );
            })
          : null}
      </div>
      {legend ? (
        <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] leading-5">
          {segments.map((seg, i) => {
            const ink = toneInk(seg.tone ?? FALLBACK_TONES[i % FALLBACK_TONES.length]);
            const muted = seg.value <= 0;
            return (
              <li
                key={seg.key}
                className={cn('flex items-center gap-1.5', muted && 'opacity-55')}
              >
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: ink }} />
                <span className="text-[var(--maher-text-secondary)]">{seg.label}</span>
                <span className="font-medium tabular-nums text-[var(--maher-text-primary)]" dir="ltr">
                  {seg.value.toLocaleString('en-JO')}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
