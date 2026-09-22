'use client';

import { createContext, useContext, useId, type ReactNode } from 'react';
import { cn } from '../cn';

type FieldContextValue = { id: string; describedBy?: string; invalid: boolean };
const FieldContext = createContext<FieldContextValue | null>(null);

/** Read the ids wired by the nearest `Field` (for custom controls). */
export function useFieldContext() {
  return useContext(FieldContext);
}

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  /** Text at the end of the label row (char count, "optional"). */
  trailing?: ReactNode;
  children: ReactNode | ((ctx: FieldContextValue) => ReactNode);
  className?: string;
  id?: string;
}

/**
 * Field — label, hint and error wiring for any control. Children may be a
 * render function receiving `{ id, describedBy, invalid }`.
 */
export function Field({ label, hint, error, required, trailing, children, className, id: idProp }: FieldProps) {
  const auto = useId();
  const id = idProp ?? auto;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const ctx: FieldContextValue = {
    id,
    describedBy: [errorId, hintId].filter(Boolean).join(' ') || undefined,
    invalid: Boolean(error),
  };

  return (
    <FieldContext.Provider value={ctx}>
      <div className={cn('group/field flex flex-col gap-1.5', className)}>
        {label || trailing ? (
          <div className="flex items-baseline justify-between gap-3">
            {label ? (
              <label
                htmlFor={id}
                className="text-[13px] font-medium leading-5 text-[var(--maher-text-primary)] transition-colors group-focus-within/field:text-[var(--maher-brand)]"
              >
                {label}
                {required ? (
                  <span aria-hidden className="ms-0.5 text-[var(--maher-brand)]">
                    *
                  </span>
                ) : null}
              </label>
            ) : (
              <span />
            )}
            {trailing ? <span className="text-[12px] leading-5 text-[var(--maher-text-tertiary)]">{trailing}</span> : null}
          </div>
        ) : null}
        {typeof children === 'function' ? children(ctx) : children}
        {hint && !error ? (
          <p id={hintId} className="text-[12px] leading-4 text-[var(--maher-text-secondary)]">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} role="alert" className="maher-animate-drop text-[12px] leading-4 text-[var(--maher-error)]">
            {error}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

/** Shared control chrome so inputs, selects, comboboxes and date fields match. */
export const controlClassName =
  'h-10 w-full rounded-[10px] border border-[var(--maher-border)] bg-[var(--maher-surface)] px-3 text-sm text-[var(--maher-text-primary)] placeholder:text-[var(--maher-text-tertiary)] hover:border-[var(--maher-border-strong)] focus:border-[var(--maher-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--maher-brand)]/20 disabled:cursor-not-allowed disabled:bg-[var(--maher-surface-muted)] disabled:opacity-60 aria-[invalid=true]:border-[var(--maher-error)] aria-[invalid=true]:focus:ring-[var(--maher-error)]/20';
