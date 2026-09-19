import type { HTMLAttributes } from 'react';
import { cn } from '../cn';

export function ListItemEnter({
  index = 0,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { index?: number }) {
  return (
    <div
      className={cn('maher-animate-rise motion-reduce:animate-none', className)}
      style={{ animationDelay: `${Math.min(index, 12) * 16}ms` }}
      {...props}
    />
  );
}
