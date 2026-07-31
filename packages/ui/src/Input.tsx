import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined);

    return (
      <div className="flex flex-col gap-1">
        {label ? (
          <label htmlFor={inputId} className="text-sm font-medium text-[var(--maher-text-primary)]">
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={cn(
            'h-10 w-full rounded-[var(--maher-radius-md)] border border-[var(--maher-border)] bg-[var(--maher-surface)] px-3 text-sm text-[var(--maher-text-primary)]',
            'placeholder:text-[var(--maher-text-secondary)] focus:border-[var(--maher-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--maher-brand)]/20',
            error && 'border-[var(--maher-error)]',
            className,
          )}
          {...props}
        />
        {hint && !error ? (
          <p id={`${inputId}-hint`} className="text-xs text-[var(--maher-text-secondary)]">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p id={`${inputId}-error`} role="alert" className="text-xs text-[var(--maher-error)]">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = 'Input';
