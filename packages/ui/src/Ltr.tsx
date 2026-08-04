import type { HTMLAttributes } from 'react';
import { cn } from './cn';

/** Inline LTR wrapper for codes, money, phones, and dates inside RTL layouts. */
export function Ltr({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      dir="ltr"
      className={cn('inline-block whitespace-nowrap tabular-nums', className)}
      {...props}
    />
  );
}
