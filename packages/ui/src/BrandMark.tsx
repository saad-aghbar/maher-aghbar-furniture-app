import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export interface BrandMarkProps extends HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'md' | 'lg';
}

const sizeClass = {
  sm: 'h-8 w-8',
  md: 'h-9 w-9',
  lg: 'h-12 w-12',
} as const;

const iconClass = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
} as const;

export function BrandMark({ className, size = 'md', ...props }: BrandMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-[var(--maher-radius-md)] bg-brand text-white shadow-[var(--maher-shadow-sm)]',
        sizeClass[size],
        className,
      )}
      {...props}
    >
      <svg
        viewBox="0 0 24 24"
        className={iconClass[size]}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 11V8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5V11" />
        <path d="M3 11h18a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1Z" />
        <path d="M5 17v2m14-2v2" />
      </svg>
    </span>
  );
}
