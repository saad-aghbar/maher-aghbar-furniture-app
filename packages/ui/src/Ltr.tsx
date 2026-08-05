import type { HTMLAttributes } from 'react';
import { cn } from './cn';

/**
 * Inline LTR wrapper for codes, money, phones, and dates inside RTL layouts.
 * Isolates digit/code order without forcing left layout alignment —
 * when stretched to full width, text still follows the parent (RTL → right).
 */
export function Ltr({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      dir="ltr"
      className={cn(
        'inline-block max-w-full whitespace-nowrap tabular-nums [unicode-bidi:isolate] [text-align:match-parent]',
        className,
      )}
      {...props}
    />
  );
}
