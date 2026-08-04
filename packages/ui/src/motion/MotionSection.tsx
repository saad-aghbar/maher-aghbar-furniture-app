import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export interface MotionSectionProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  /** Entrance style */
  enter?: 'rise' | 'fade' | 'drop' | 'none';
  delayMs?: number;
  as?: 'section' | 'div' | 'article';
}

export function MotionSection({
  children,
  className,
  enter = 'rise',
  delayMs = 0,
  as: Tag = 'section',
  style,
  ...props
}: MotionSectionProps) {
  const enterClass =
    enter === 'rise'
      ? 'maher-animate-rise'
      : enter === 'fade'
        ? 'maher-animate-fade'
        : enter === 'drop'
          ? 'maher-animate-drop'
          : undefined;

  return (
    <Tag
      className={cn(enterClass, className)}
      style={{ animationDelay: delayMs ? `${delayMs}ms` : undefined, ...style }}
      {...props}
    >
      {children}
    </Tag>
  );
}
