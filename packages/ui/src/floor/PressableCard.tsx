import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../cn';

export function PressableCard({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'w-full text-start transition-transform duration-150 ease-out motion-reduce:transition-none',
        'active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--maher-brand)]',
        className,
      )}
      {...props}
    />
  );
}
