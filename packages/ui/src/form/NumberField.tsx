'use client';

import { forwardRef, useEffect, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../cn';
import { Field, controlClassName } from './Field';

export interface NumberFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'prefix' | 'size'> {
  value: number | null;
  onChange: (value: number | null) => void;
  /** Unit at the end (`cm`, `kg`, `%`). */
  unit?: ReactNode;
  /** Text at the start (currency code). */
  prefix?: ReactNode;
  decimals?: number;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  /** Size of the figure; `lg` for money heroes. */
  size?: 'md' | 'lg';
}

function format(n: number | null, decimals: number) {
  if (n == null || Number.isNaN(n)) return '';
  return decimals > 0 ? n.toFixed(Math.min(decimals, 6)).replace(/\.?0+$/, (m) => (m.startsWith('.') ? '' : m)) : String(Math.round(n));
}

function parse(raw: string): number | null {
  const cleaned = raw
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[,\s]/g, '')
    .replace(/[^\d.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * NumberField — LTR tabular numerals with a unit suffix or currency prefix.
 * Accepts Arabic-Indic digits and thousands separators on input.
 */
export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(
  ({ value, onChange, unit, prefix, decimals = 0, label, hint, error, required, size = 'md', className, min, max, step, id, ...props }, ref) => {
    const [text, setText] = useState(format(value, decimals));
    const [focused, setFocused] = useState(false);

    useEffect(() => {
      if (!focused) setText(format(value, decimals));
    }, [value, decimals, focused]);

    const control = (ctx: { id: string; describedBy?: string; invalid: boolean }) => (
      <div className="relative flex items-center">
        {prefix ? (
          <span className="pointer-events-none absolute start-3 text-[13px] text-[var(--maher-text-tertiary)]" dir="ltr">
            {prefix}
          </span>
        ) : null}
        <input
          ref={ref}
          id={ctx.id}
          type="text"
          inputMode={decimals > 0 ? 'decimal' : 'numeric'}
          dir="ltr"
          value={text}
          aria-invalid={ctx.invalid || undefined}
          aria-describedby={ctx.describedBy}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            let n = parse(text);
            if (n != null) {
              if (typeof min === 'number' && n < min) n = min;
              if (typeof max === 'number' && n > max) n = max;
              if (step && typeof step === 'number' && step > 0) n = Math.round(n / step) * step;
            }
            onChange(n);
            setText(format(n, decimals));
            props.onBlur?.(e);
          }}
          onChange={(e) => {
            setText(e.target.value);
            const n = parse(e.target.value);
            onChange(n);
          }}
          className={cn(
            controlClassName,
            'tabular-nums [text-align:start]',
            size === 'lg' && 'h-12 text-[18px] font-semibold',
            prefix ? 'ps-11' : null,
            unit ? 'pe-12' : null,
            className,
          )}
          {...props}
        />
        {unit ? (
          <span className="pointer-events-none absolute end-3 text-[12px] font-medium text-[var(--maher-text-tertiary)]" dir="ltr">
            {unit}
          </span>
        ) : null}
      </div>
    );

    return (
      <Field label={label} hint={hint} error={error} required={required} id={id}>
        {control}
      </Field>
    );
  },
);
NumberField.displayName = 'NumberField';

export interface MoneyFieldProps extends Omit<NumberFieldProps, 'unit' | 'prefix' | 'decimals'> {
  currency: string;
}

/** MoneyField — 2-decimal NumberField with the currency code at the start. */
export const MoneyField = forwardRef<HTMLInputElement, MoneyFieldProps>(({ currency, ...props }, ref) => (
  <NumberField ref={ref} decimals={2} prefix={currency} {...props} />
));
MoneyField.displayName = 'MoneyField';
