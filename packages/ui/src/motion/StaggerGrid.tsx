import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export interface StaggerGridProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Use maher-stagger for child entrance cascade */
  stagger?: boolean;
}

export function StaggerGrid({
  children,
  className,
  stagger = true,
  ...props
}: StaggerGridProps) {
  return (
    <div className={cn(stagger && 'maher-stagger', className)} {...props}>
      {children}
    </div>
  );
}
