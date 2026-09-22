import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export interface LtrProps extends HTMLAttributes<HTMLSpanElement> {
  /** Render as a block (own line) instead of inline. */
  block?: boolean;
  /** Allow wrapping for long codes. */
  wrap?: boolean;
}

/**
 * Inline LTR wrapper for codes, money, phones, and dates inside RTL layouts.
 * Isolates digit/code order without forcing left layout alignment —
 * when stretched to full width, text still follows the parent (RTL → right).
 */
export function Ltr({ className, block, wrap, ...props }: LtrProps) {
  return (
    <span
      dir="ltr"
      className={cn(
        block ? 'block' : 'inline-block',
        'max-w-full tabular-nums [unicode-bidi:isolate] [text-align:match-parent]',
        !wrap && 'whitespace-nowrap',
        className,
      )}
      {...props}
    />
  );
}
