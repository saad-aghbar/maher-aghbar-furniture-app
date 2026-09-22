import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';
import { toneInk, toneSoft, type BoardTone } from './tone';

export interface StampProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BoardTone;
  /** With children renders a chip; without, an 8px ink dot. */
  children?: ReactNode;
  size?: 'sm' | 'md';
  /** Soft breathing animation for live states (running timer, in transit). */
  pulse?: boolean;
}

/**
 * Stamp — the tone mark. A bare dot before a heading, or a chip with a label.
 * Replaces AttentionChip pills and colored rails.
 */
export function Stamp({ tone, children, size = 'md', pulse, className, style, ...props }: StampProps) {
  const ink = tone ? toneInk(tone) : 'var(--board-ink, var(--maher-brand))';
  const soft = tone ? toneSoft(tone) : 'var(--board-soft, var(--maher-brand-soft))';
  if (children == null) {
    return (
      <span
        aria-hidden
        className={cn('inline-block h-2 w-2 shrink-0 rounded-full', pulse && 'maher-stamp-pulse', className)}
        style={{ background: ink, boxShadow: `0 0 0 3px ${soft}`, ...style } as CSSProperties}
        {...props}
      />
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium tabular-nums whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[11px] leading-4' : 'px-2.5 py-1 text-xs leading-4',
        className,
      )}
      style={{ background: soft, color: ink, ...style } as CSSProperties}
      {...props}
    >
      <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', pulse && 'maher-stamp-pulse')} style={{ background: ink }} />
      {children}
    </span>
  );
}
