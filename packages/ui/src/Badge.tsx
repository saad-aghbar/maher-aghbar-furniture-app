import type { HTMLAttributes } from 'react';
import { Stamp } from './board/Stamp';
import type { BoardTone } from './board/tone';

export type BadgeVariant = 'default' | 'brand' | 'success' | 'warning' | 'error' | 'info';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

/**
 * @deprecated Prefer `Stamp` from `@maher/ui`. `Badge` now renders as a Stamp chip
 * (tone-colored ink on soft wash) so legacy pills match the Board recipe.
 */
export function Badge({ className, variant = 'default', dot, children, ...props }: BadgeProps) {
  const tone: BoardTone = variant === 'default' ? 'neutral' : variant;
  void dot;
  return (
    <Stamp tone={tone} size="sm" className={className} {...props}>
      {children}
    </Stamp>
  );
}
