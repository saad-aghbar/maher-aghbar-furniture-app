import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id ?? (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined);

    return (
      <div className="group flex flex-col gap-1.5">
        {label ? (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[var(--maher-text-primary)] transition-colors duration-200 group-focus-within:text-[var(--maher-brand)]"
          >
            {label}
          </label>
        ) : null}
        <textarea
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          className={cn(
            'min-h-[100px] w-full rounded-[var(--maher-radius-md)] border border-[var(--maher-border)] bg-[var(--maher-surface)] px-3 py-2 text-sm text-[var(--maher-text-primary)]',
            'placeholder:text-[var(--maher-text-tertiary)] hover:border-[var(--maher-border-strong)]',
            'focus:border-[var(--maher-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--maher-brand)]/20',
            error && 'border-[var(--maher-error)]',
            className,
          )}
          {...props}
        />
        {error ? (
          <p role="alert" className="maher-animate-drop text-xs text-[var(--maher-error)]">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

TextArea.displayName = 'TextArea';
