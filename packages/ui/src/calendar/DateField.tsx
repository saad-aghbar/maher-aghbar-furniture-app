'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { cn } from '../cn';
import { Field, controlClassName } from '../form/Field';
import { Popover } from '../overlay/Popover';
import { Sheet } from '../overlay/Sheet';
import { useMediaQuery } from '../overlay/use-presence';
import { MonthCalendar, type MonthCalendarProps } from './MonthCalendar';
import { cursorFromYmd, todayYmd, ymdToDate, type CalendarCursor, type DayMeta } from './calendar-math';

export interface DateFieldCopy {
  placeholder?: string;
  clear?: string;
  today?: string;
  close?: string;
  prevMonth?: string;
  nextMonth?: string;
}

export interface DateFieldProps {
  /** YYYY-MM-DD or empty. */
  value: string;
  onChange: (ymd: string) => void;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  minDate?: string;
  maxDate?: string;
  dayMeta?: Record<string, DayMeta>;
  variant?: MonthCalendarProps['variant'];
  disabled?: boolean;
  clearable?: boolean;
  locale?: string;
  copy?: DateFieldCopy;
  className?: string;
  id?: string;
  name?: string;
  /** Force sheet or popover; default auto (sheet below 900px). */
  presentation?: 'auto' | 'popover' | 'sheet';
  /** Legend/footer under the grid. */
  calendarFooter?: ReactNode;
  /** Show a "Today" shortcut. */
  todayShortcut?: boolean;
}

export function formatYmd(ymd: string, locale = 'en', options?: Intl.DateTimeFormatOptions): string {
  const d = ymdToDate(ymd);
  if (!d) return '';
  try {
    return new Intl.DateTimeFormat(locale, options ?? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  } catch {
    return ymd;
  }
}

function CalendarGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4.5" width="14" height="12" rx="2.5" />
      <path d="M3 8.5h14M7 2.5v3M13 2.5v3" />
    </svg>
  );
}

/**
 * DateField — a button-styled field that opens the MonthCalendar in a popover
 * (desktop) or a bottom sheet (compact). Replaces `input[type=date]`.
 */
export function DateField({
  value,
  onChange,
  label,
  hint,
  error,
  required,
  minDate,
  maxDate,
  dayMeta,
  variant,
  disabled,
  clearable = true,
  locale = 'en',
  copy,
  className,
  id,
  name,
  presentation = 'auto',
  calendarFooter,
  todayShortcut = true,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [cursor, setCursor] = useState<CalendarCursor>(() => cursorFromYmd(value || todayYmd()));
  const wide = useMediaQuery('(min-width: 900px)');
  const useSheet = presentation === 'sheet' || (presentation === 'auto' && !wide);
  const display = useMemo(() => formatYmd(value, locale), [value, locale]);

  useEffect(() => {
    if (open) setCursor(cursorFromYmd(value || todayYmd()));
  }, [open, value]);

  const calendar = (
    <MonthCalendar
      value={value}
      onSelect={(ymd) => {
        onChange(ymd);
        setOpen(false);
      }}
      monthCursor={cursor}
      onMonthChange={setCursor}
      minDate={minDate}
      maxDate={maxDate}
      dayMeta={dayMeta}
      variant={variant}
      disableUnavailable={Boolean(dayMeta)}
      locale={locale}
      embedded
      compact={!useSheet}
      prevLabel={copy?.prevMonth}
      nextLabel={copy?.nextMonth}
      footer={
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="min-w-0 flex-1">{calendarFooter}</div>
          <div className="flex items-center gap-1">
            {todayShortcut ? (
              <button
                type="button"
                className="maher-press rounded-full px-2.5 py-1 text-[12px] font-medium text-[var(--maher-brand)] hover:bg-[var(--maher-brand-soft)]"
                onClick={() => {
                  const t = todayYmd();
                  if ((minDate && t < minDate) || (maxDate && t > maxDate)) {
                    setCursor(cursorFromYmd(t));
                    return;
                  }
                  onChange(t);
                  setOpen(false);
                }}
              >
                {copy?.today ?? 'Today'}
              </button>
            ) : null}
            {clearable && value ? (
              <button
                type="button"
                className="maher-press rounded-full px-2.5 py-1 text-[12px] font-medium text-[var(--maher-text-secondary)] hover:bg-[var(--maher-surface-muted)]"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                {copy?.clear ?? 'Clear'}
              </button>
            ) : null}
          </div>
        </div>
      }
    />
  );

  return (
    <Field label={label} hint={hint} error={error} required={required} id={id} className={className}>
      {(ctx) => (
        <>
          {name ? <input type="hidden" name={name} value={value} /> : null}
          <button
            ref={setAnchor}
            id={ctx.id}
            type="button"
            disabled={disabled}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-invalid={ctx.invalid || undefined}
            aria-describedby={ctx.describedBy}
            onClick={() => setOpen((v) => !v)}
            className={cn(controlClassName, 'maher-press flex items-center gap-2.5 text-start', !value && 'text-[var(--maher-text-tertiary)]')}
          >
            <CalendarGlyph className="h-[18px] w-[18px] shrink-0 text-[var(--maher-brand)]" />
            <span className={cn('min-w-0 flex-1 truncate', value && 'text-[var(--maher-text-primary)]')}>
              {display || copy?.placeholder || 'Pick a date'}
            </span>
            {value ? (
              <span className="text-[12px] tabular-nums text-[var(--maher-text-tertiary)]" dir="ltr">
                {value}
              </span>
            ) : null}
          </button>
          {useSheet ? (
            <Sheet open={open} onClose={() => setOpen(false)} title={typeof label === 'string' ? label : copy?.placeholder ?? 'Pick a date'} side="bottom" closeLabel={copy?.close}>
              {calendar}
            </Sheet>
          ) : (
            <Popover open={open} onClose={() => setOpen(false)} anchor={anchor} className="w-[308px] p-3" role="dialog" aria-label={typeof label === 'string' ? label : undefined}>
              {calendar}
            </Popover>
          )}
        </>
      )}
    </Field>
  );
}
