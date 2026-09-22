'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { cn } from './cn';
import { Field, controlClassName } from './form/Field';
import { Popover } from './overlay/Popover';
import { Sheet } from './overlay/Sheet';
import { useMediaQuery } from './overlay/use-presence';
import { MonthCalendar } from './calendar/MonthCalendar';
import { formatYmd } from './calendar/DateField';
import {
  cursorFromYmd,
  nextDateRange,
  presetRange,
  shiftMonth,
  todayYmd,
  type CalendarCursor,
  type RangePreset,
} from './calendar/calendar-math';

export interface DateRangeCopy {
  placeholder?: string;
  apply?: string;
  clear?: string;
  close?: string;
  presets?: Partial<Record<RangePreset, string>>;
  prevMonth?: string;
  nextMonth?: string;
}

export type DateRangeFieldProps = {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Presets shown as a rail beside the calendar. */
  presets?: RangePreset[];
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
  locale?: string;
  copy?: DateRangeCopy;
  className?: string;
  id?: string;
  presentation?: 'auto' | 'popover' | 'sheet';
  /** Compact trigger (toolbar) instead of a full-width field. */
  size?: 'md' | 'sm';
  /* Deprecated two-input API kept so old call sites compile. */
  fromLabel?: string;
  toLabel?: string;
  onFromChange?: (value: string) => void;
  onToChange?: (value: string) => void;
};

const DEFAULT_PRESETS: RangePreset[] = ['today', 'week', 'month', 'last30', 'last90'];
const PRESET_LABEL: Record<RangePreset, string> = {
  today: 'Today',
  week: 'This week',
  month: 'This month',
  last7: 'Last 7 days',
  last30: 'Last 30 days',
  last90: 'Last 90 days',
  ytd: 'Year to date',
};

/**
 * DateRangeField — one trigger, one calendar, two taps. Presets on the side,
 * live hover preview of the strip, two months on wide screens.
 */
export function DateRangeField({
  from,
  to,
  onChange,
  onFromChange,
  onToChange,
  label,
  hint,
  error,
  presets = DEFAULT_PRESETS,
  minDate,
  maxDate,
  disabled,
  locale = 'en',
  copy,
  className,
  id,
  presentation = 'auto',
  size = 'md',
}: DateRangeFieldProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [draft, setDraft] = useState({ start: from, end: to });
  const [hover, setHover] = useState<string | null>(null);
  const [cursor, setCursor] = useState<CalendarCursor>(() => cursorFromYmd(from || todayYmd()));
  const wide = useMediaQuery('(min-width: 900px)');
  const useSheet = presentation === 'sheet' || (presentation === 'auto' && !wide);

  useEffect(() => {
    if (open) {
      setDraft({ start: from, end: to });
      setCursor(cursorFromYmd(from || todayYmd()));
    }
  }, [open, from, to]);

  const display = useMemo(() => {
    if (!from && !to) return '';
    const f = formatYmd(from, locale, { day: 'numeric', month: 'short', year: 'numeric' });
    const t = formatYmd(to, locale, { day: 'numeric', month: 'short', year: 'numeric' });
    if (f && t) return `${f} – ${t}`;
    return f || t;
  }, [from, to, locale]);

  function commit(range: { start: string; end: string }) {
    const next = { from: range.start, to: range.end || range.start };
    onChange(next);
    onFromChange?.(next.from);
    onToChange?.(next.to);
    setOpen(false);
  }

  const activePreset = presets.find((p) => {
    const r = presetRange(p);
    return r.from === draft.start && r.to === draft.end;
  });

  const grid = (months: number) => (
    <div className={cn('grid gap-4', months === 2 && 'grid-cols-2')}>
      {Array.from({ length: months }).map((_, i) => (
        <MonthCalendar
          key={i}
          monthCursor={i === 0 ? cursor : shiftMonth(cursor, 1)}
          onMonthChange={(c) => setCursor(i === 0 ? c : shiftMonth(c, -1))}
          rangeStart={draft.start || undefined}
          rangeEnd={draft.end || undefined}
          hoverEnd={hover ?? undefined}
          onHoverDay={setHover}
          onSelect={(ymd) => setDraft(nextDateRange(draft.start, draft.end, ymd))}
          minDate={minDate}
          maxDate={maxDate}
          locale={locale}
          embedded
          compact
          prevLabel={copy?.prevMonth}
          nextLabel={copy?.nextMonth}
        />
      ))}
    </div>
  );

  const body = (
    <div className={cn('flex gap-4', useSheet ? 'flex-col' : 'flex-row')}>
      {presets.length ? (
        <div className={cn('flex gap-1.5', useSheet ? 'flex-row flex-wrap' : 'w-36 shrink-0 flex-col')}>
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              className={cn(
                'maher-press rounded-[10px] px-3 py-1.5 text-start text-[13px] font-medium',
                activePreset === p
                  ? 'bg-[var(--maher-text-primary)] text-[var(--maher-background)]'
                  : 'text-[var(--maher-text-secondary)] hover:bg-[var(--maher-surface-muted)] hover:text-[var(--maher-text-primary)]',
              )}
              onClick={() => {
                const r = presetRange(p);
                setDraft({ start: r.from, end: r.to });
                setCursor(cursorFromYmd(r.from));
              }}
            >
              {copy?.presets?.[p] ?? PRESET_LABEL[p]}
            </button>
          ))}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        {grid(useSheet ? 1 : 2)}
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--maher-border)] pt-3">
          <p className="min-w-0 truncate text-[13px] text-[var(--maher-text-secondary)]" dir="ltr">
            {draft.start ? `${draft.start}${draft.end ? ` → ${draft.end}` : ' → …'}` : '—'}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="maher-press rounded-full px-3 py-1.5 text-[13px] font-medium text-[var(--maher-text-secondary)] hover:bg-[var(--maher-surface-muted)]"
              onClick={() => {
                setDraft({ start: '', end: '' });
                onChange({ from: '', to: '' });
                onFromChange?.('');
                onToChange?.('');
                setOpen(false);
              }}
            >
              {copy?.clear ?? 'Clear'}
            </button>
            <button
              type="button"
              disabled={!draft.start}
              className="maher-press rounded-full bg-[var(--maher-text-primary)] px-3.5 py-1.5 text-[13px] font-semibold text-[var(--maher-background)] disabled:opacity-40"
              onClick={() => commit(draft)}
            >
              {copy?.apply ?? 'Apply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Field label={label} hint={hint} error={error} id={id} className={className}>
      {(ctx) => (
        <>
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
            className={cn(controlClassName, 'maher-press flex items-center gap-2.5 text-start', size === 'sm' && 'h-9 w-auto text-[13px]', !display && 'text-[var(--maher-text-tertiary)]')}
          >
            <svg viewBox="0 0 20 20" className="h-[18px] w-[18px] shrink-0 text-[var(--maher-brand)]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="4.5" width="14" height="12" rx="2.5" />
              <path d="M3 8.5h14M7 2.5v3M13 2.5v3" />
            </svg>
            <span className={cn('min-w-0 flex-1 truncate', display && 'text-[var(--maher-text-primary)]')}>{display || copy?.placeholder || 'Any dates'}</span>
          </button>
          {useSheet ? (
            <Sheet open={open} onClose={() => setOpen(false)} title={typeof label === 'string' ? label : copy?.placeholder ?? 'Dates'} side="bottom" closeLabel={copy?.close}>
              {body}
            </Sheet>
          ) : (
            <Popover open={open} onClose={() => setOpen(false)} anchor={anchor} className="w-[min(760px,calc(100vw-32px))] p-4" role="dialog" aria-label={typeof label === 'string' ? label : undefined}>
              {body}
            </Popover>
          )}
        </>
      )}
    </Field>
  );
}
