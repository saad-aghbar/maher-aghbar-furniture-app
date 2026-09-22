'use client';

import { forwardRef, useCallback, useEffect, useRef, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  /**
   * Grow with the content (min `rows`, max `maxRows`) instead of a fixed box
   * with an inner scrollbar. Ideal for notes fields.
   */
  autoGrow?: boolean;
  /** Upper bound for `autoGrow` before the field scrolls. Default 12. */
  maxRows?: number;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className, label, error, id, autoGrow, maxRows = 12, rows, onChange, value, ...props }, ref) => {
    const inputId = id ?? (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined);
    const inner = useRef<HTMLTextAreaElement | null>(null);

    const setRef = useCallback(
      (node: HTMLTextAreaElement | null) => {
        inner.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    const fit = useCallback(() => {
      const el = inner.current;
      if (!el || !autoGrow) return;
      const style = window.getComputedStyle(el);
      const line = parseFloat(style.lineHeight) || 20;
      const pad = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const minRows = rows ?? 3;
      el.style.height = 'auto';
      const max = line * maxRows + pad;
      const next = Math.min(Math.max(el.scrollHeight, line * minRows + pad), max);
      el.style.height = `${next}px`;
      el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
    }, [autoGrow, maxRows, rows]);

    // Re-fit when the value changes programmatically (hydration, reset).
    useEffect(() => {
      fit();
    }, [fit, value]);

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
          ref={setRef}
          id={inputId}
          rows={rows ?? (autoGrow ? 3 : undefined)}
          value={value}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            onChange?.(e);
            if (autoGrow) fit();
          }}
          className={cn(
            'w-full rounded-[var(--maher-radius-md)] border border-[var(--maher-border)] bg-[var(--maher-surface)] px-3 py-2 text-sm leading-5 text-[var(--maher-text-primary)]',
            autoGrow ? 'resize-none transition-[height] duration-150 ease-out' : 'min-h-[100px]',
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
