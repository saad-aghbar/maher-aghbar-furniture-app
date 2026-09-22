'use client';

import { useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../cn';
import {
  buildMonthCells,
  chunk,
  monthLabel,
  shiftMonth,
  todayYmd,
  toYmd,
  weekdayLabels,
  ymdInRange,
  type CalendarCursor,
  type DayMeta,
} from './calendar-math';

export type MonthCalendarVariant = 'default' | 'dealer' | 'admin';

export interface MonthCalendarProps {
  /** Selected YYYY-MM-DD (may be empty). Ignored when `rangeStart` is set. */
  value?: string;
  onSelect: (ymd: string) => void;
  monthCursor: CalendarCursor;
  onMonthChange: (cursor: CalendarCursor) => void;
  /** Inclusive range start (YYYY-MM-DD). Enables range highlighting. */
  rangeStart?: string;
  /** Inclusive range end (YYYY-MM-DD). */
  rangeEnd?: string;
  /** Per-day visual meta keyed by YYYY-MM-DD. */
  dayMeta?: Record<string, DayMeta>;
  minDate?: string;
  maxDate?: string;
  /** When true, days marked disabled/unavailable/closed cannot be selected. */
  disableUnavailable?: boolean;
  variant?: MonthCalendarVariant;
  /** Drop outer paper chrome when the grid sits inside another board. */
  embedded?: boolean;
  compact?: boolean;
  locale?: string;
  /** Renders below the grid (legend, footer). */
  footer?: ReactNode;
  className?: string;
  prevLabel?: string;
  nextLabel?: string;
  /** Hovered day for live range preview (controlled by DateRangeField). */
  onHoverDay?: (ymd: string | null) => void;
  hoverEnd?: string;
}

/**
 * MonthCalendar — the shared month grid ported from the mobile app.
 * Brand-filled selected day, today ring, two-tap range strip, load tones,
 * marker dots, Monday-first, RTL-aware, keyboard roving grid.
 */
export function MonthCalendar({
  value = '',
  onSelect,
  monthCursor,
  onMonthChange,
  rangeStart,
  rangeEnd,
  dayMeta = {},
  minDate,
  maxDate,
  disableUnavailable = true,
  variant = 'default',
  embedded = false,
  compact = false,
  locale = 'en',
  footer,
  className,
  prevLabel = 'Previous month',
  nextLabel = 'Next month',
  onHoverDay,
  hoverEnd,
}: MonthCalendarProps) {
  const today = todayYmd();
  const gridRef = useRef<HTMLDivElement>(null);
  const cellH = compact ? 36 : variant === 'admin' ? 52 : 40;
  const cells = useMemo(() => buildMonthCells(monthCursor.y, monthCursor.m), [monthCursor.m, monthCursor.y]);
  const weekdays = useMemo(() => weekdayLabels(locale, compact ? 'narrow' : 'short'), [locale, compact]);
  const rangeActive = Boolean(rangeStart);
  const previewEnd = rangeStart && !rangeEnd ? hoverEnd : rangeEnd;

  function isDisabled(ymd: string, meta: DayMeta | undefined) {
    const outOfRange = (minDate != null && ymd < minDate) || (maxDate != null && ymd > maxDate);
    const toneDisabled =
      disableUnavailable && (meta?.disabled === true || meta?.tone === 'unavailable' || meta?.tone === 'closed');
    return outOfRange || toneDisabled;
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const ymd = target.dataset.ymd;
    if (!ymd) return;
    const day = Number(ymd.slice(8, 10));
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
    let delta = 0;
    if (e.key === 'ArrowRight') delta = rtl ? -1 : 1;
    else if (e.key === 'ArrowLeft') delta = rtl ? 1 : -1;
    else if (e.key === 'ArrowDown') delta = 7;
    else if (e.key === 'ArrowUp') delta = -7;
    else if (e.key === 'PageDown') {
      e.preventDefault();
      onMonthChange(shiftMonth(monthCursor, 1));
      return;
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      onMonthChange(shiftMonth(monthCursor, -1));
      return;
    } else return;
    e.preventDefault();
    const daysInMonth = new Date(monthCursor.y, monthCursor.m + 1, 0).getDate();
    const next = day + delta;
    if (next < 1) {
      onMonthChange(shiftMonth(monthCursor, -1));
      return;
    }
    if (next > daysInMonth) {
      onMonthChange(shiftMonth(monthCursor, 1));
      return;
    }
    gridRef.current?.querySelector<HTMLElement>(`[data-ymd="${toYmd(monthCursor.y, monthCursor.m, next)}"]`)?.focus();
  }

  const focusDay = value || rangeStart || (monthCursor.y === Number(today.slice(0, 4)) && monthCursor.m === Number(today.slice(5, 7)) - 1 ? today : toYmd(monthCursor.y, monthCursor.m, 1));

  return (
    <div
      className={cn(
        !embedded && 'maher-board rounded-[18px] border border-[var(--maher-border)] bg-[var(--maher-surface)]',
        !embedded && (compact ? 'p-3' : 'p-4'),
        'flex flex-col',
        compact ? 'gap-2' : 'gap-3',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="maher-cal__nav" aria-label={prevLabel} onClick={() => onMonthChange(shiftMonth(monthCursor, -1))}>
          <svg viewBox="0 0 20 20" className="h-4 w-4 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m12 5-5 5 5 5" />
          </svg>
        </button>
        <p className="min-w-0 flex-1 truncate text-center text-[14px] font-semibold text-[var(--maher-text-primary)]" aria-live="polite">
          {monthLabel(monthCursor.y, monthCursor.m, locale)}
        </p>
        <button type="button" className="maher-cal__nav" aria-label={nextLabel} onClick={() => onMonthChange(shiftMonth(monthCursor, 1))}>
          <svg viewBox="0 0 20 20" className="h-4 w-4 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m8 5 5 5-5 5" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5" aria-hidden>
        {weekdays.map((label, i) => (
          <span key={i} className="py-0.5 text-center text-[11px] font-medium text-[var(--maher-text-tertiary)]">
            {label}
          </span>
        ))}
      </div>

      <div ref={gridRef} role="grid" className="flex flex-col gap-1.5" onKeyDown={onKeyDown} onMouseLeave={() => onHoverDay?.(null)}>
        {chunk(cells, 7).map((row, rowIdx) => (
          <div key={rowIdx} role="row" className="grid grid-cols-7 gap-1.5">
            {row.map((day, colIdx) => {
              if (day == null) return <span key={`e-${rowIdx}-${colIdx}`} style={{ height: cellH }} />;
              const ymd = toYmd(monthCursor.y, monthCursor.m, day);
              const meta = dayMeta[ymd];
              const isRangeStart = Boolean(rangeStart && ymd === rangeStart);
              const isRangeEnd = Boolean(previewEnd && ymd === previewEnd);
              const inRange =
                Boolean(rangeStart && previewEnd) && ymdInRange(ymd, rangeStart!, previewEnd!) && !isRangeStart && !isRangeEnd;
              const selected = rangeActive ? isRangeStart || Boolean(rangeEnd && isRangeEnd) : value === ymd;
              const isToday = ymd === today;
              const disabled = isDisabled(ymd, meta);
              const tone = meta?.tone === 'unavailable' ? 'busy' : meta?.tone;
              const showTone = tone && tone !== 'empty' && tone !== 'available' && tone !== 'earliest';
              const dots = meta?.markers?.slice(0, 3) ?? [];
              const density = Math.min(meta?.density ?? 0, 3);
              const isFocusable = ymd === focusDay;

              return (
                <button
                  key={ymd}
                  type="button"
                  role="gridcell"
                  data-ymd={ymd}
                  data-selected={selected ? 'true' : undefined}
                  data-in-range={inRange ? 'true' : undefined}
                  data-today={isToday && !selected ? 'true' : undefined}
                  data-tone={showTone && !selected && !inRange ? tone : undefined}
                  data-earliest={meta?.isEarliest ? 'true' : undefined}
                  aria-selected={selected}
                  aria-disabled={disabled || undefined}
                  disabled={disabled}
                  tabIndex={isFocusable ? 0 : -1}
                  title={meta?.count ? `${ymd} · ${meta.count}` : ymd}
                  className={cn('maher-cal__day', meta?.isEarliest && !selected && 'border-[var(--maher-brand)]')}
                  style={{ height: cellH }}
                  onMouseEnter={() => onHoverDay?.(ymd)}
                  onClick={() => !disabled && onSelect(ymd)}
                >
                  <span className={cn(compact ? 'text-[12px]' : 'text-[13px]', (selected || isToday || meta?.isEarliest) && 'font-semibold')}>{day}</span>
                  {variant === 'admin' && meta?.loadPercent != null && !meta.disabled ? (
                    <span className="text-[9px] leading-none opacity-75" dir="ltr">
                      {Math.round(meta.loadPercent)}%
                    </span>
                  ) : null}
                  {!selected && (variant === 'admin' ? meta?.overtime || meta?.conflict : dots.length || density) ? (
                    <span className="flex h-1 items-center gap-0.5" aria-hidden>
                      {variant === 'admin' ? (
                        <>
                          {meta?.conflict ? <span className="h-1 w-1 rounded-full bg-[var(--maher-warning)]" /> : null}
                          {meta?.overtime ? <span className="h-1 w-1 rounded-full bg-[var(--maher-brand)]" /> : null}
                        </>
                      ) : dots.length ? (
                        dots.map((m, i) => (
                          <span
                            key={i}
                            className={cn(
                              'h-1 w-1 rounded-full',
                              m === 'attention' ? 'bg-[var(--maher-warning)]' : m === 'proposed' ? 'bg-[var(--maher-brand)]' : 'bg-[var(--maher-success)]',
                            )}
                          />
                        ))
                      ) : (
                        Array.from({ length: density }).map((_, i) => <span key={i} className="h-1 w-1 rounded-full bg-current opacity-70" />)
                      )}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {footer}
    </div>
  );
}
