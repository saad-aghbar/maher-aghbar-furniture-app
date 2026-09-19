'use client';

import { buildMonthCells, chunk, toYmd, type CalendarCursor, type DayMeta } from '@/lib/dealer-schedule';
import { cn } from '@maher/ui';
import { useLocale, useTranslations } from 'next-intl';

const WEEKDAY_KEYS = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'] as const;

type Props = {
  cursor: CalendarCursor;
  selectedDay: string;
  todayYmd: string;
  dayMeta: Record<string, DayMeta>;
  onSelect: (ymd: string) => void;
  onMonthChange: (cursor: CalendarCursor) => void;
};

export function DealerMonthCalendar({
  cursor,
  selectedDay,
  todayYmd,
  dayMeta,
  onSelect,
  onMonthChange,
}: Props) {
  const locale = useLocale();
  const tCal = useTranslations('mobile.calendar');
  const tOrders = useTranslations('mobile.orders');
  const isRtl = locale === 'ar' || locale === 'he';
  const cells = chunk(buildMonthCells(cursor.y, cursor.m), 7);
  const monthLabel = new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : locale === 'he' ? 'he' : 'en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(cursor.y, cursor.m, 1));

  return (
    <div className="space-y-3" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="rounded-full border border-border px-3 py-1 text-sm text-text-secondary hover:border-brand"
          onClick={() => onMonthChange({ y: cursor.m === 0 ? cursor.y - 1 : cursor.y, m: cursor.m === 0 ? 11 : cursor.m - 1 })}
        >
          {tCal('prevMonth')}
        </button>
        <p className="text-sm font-semibold text-text-primary">{monthLabel}</p>
        <button
          type="button"
          className="rounded-full border border-border px-3 py-1 text-sm text-text-secondary hover:border-brand"
          onClick={() => onMonthChange({ y: cursor.m === 11 ? cursor.y + 1 : cursor.y, m: cursor.m === 11 ? 0 : cursor.m + 1 })}
        >
          {tCal('nextMonth')}
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-wide text-text-tertiary">
        {WEEKDAY_KEYS.map((key) => (
          <span key={key}>{tCal(`weekdays.${key}`)}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.flat().map((day, index) => {
          if (!day) return <div key={`pad-${index}`} className="h-11" />;
          const ymd = toYmd(cursor.y, cursor.m, day);
          const meta = dayMeta[ymd];
          const selected = ymd === selectedDay;
          const isToday = ymd === todayYmd;
          const label = meta?.count
            ? tOrders('a11yDay', { date: ymd, count: meta.count })
            : ymd;
          return (
            <button
              key={ymd}
              type="button"
              aria-label={label}
              aria-pressed={selected}
              onClick={() => onSelect(ymd)}
              className={cn(
                'flex h-11 flex-col items-center justify-center rounded-xl border text-sm',
                selected
                  ? 'border-brand bg-brand text-white'
                  : isToday
                    ? 'border-brand/40 bg-[var(--maher-surface-muted)] text-text-primary'
                    : 'border-transparent text-text-primary hover:border-border',
              )}
            >
              <span>{day}</span>
              {meta?.markers?.length ? (
                <span className="mt-0.5 flex gap-0.5">
                  {meta.markers.slice(0, 3).map((marker) => (
                    <span
                      key={marker}
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        marker === 'attention'
                          ? 'bg-amber-500'
                          : marker === 'proposed'
                            ? 'bg-brand'
                            : 'bg-emerald-500',
                        selected && 'bg-white',
                      )}
                    />
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
