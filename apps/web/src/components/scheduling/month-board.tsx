'use client';

import {
  buildMonthCells,
  shiftMonth,
  toYmd,
  todayYmd,
  type LoadTone,
  type MonthDayMeta,
} from '@/lib/scheduling-board';
import { Button, cn, Skeleton, SurfaceCard } from '@maher/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

const WEEKDAY_KEYS = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'] as const;
const LEGEND_KEYS: LoadTone[] = ['empty', 'light', 'half', 'busy', 'closed'];

const TONE_CELL: Record<LoadTone, string> = {
  empty: 'maher-sched-day maher-sched-day--empty',
  light: 'maher-sched-day maher-sched-day--light',
  half: 'maher-sched-day maher-sched-day--half',
  busy: 'maher-sched-day maher-sched-day--busy',
  closed: 'maher-sched-day maher-sched-day--closed',
};

const TONE_SWATCH: Record<LoadTone, string> = {
  empty: 'maher-sched-swatch maher-sched-day--empty',
  light: 'maher-sched-swatch maher-sched-day--light',
  half: 'maher-sched-swatch maher-sched-day--half',
  busy: 'maher-sched-swatch maher-sched-day--busy',
  closed: 'maher-sched-swatch maher-sched-day--closed',
};

export function MonthBoard({
  year,
  monthIndex,
  selectedDay,
  dayMeta,
  loading,
  onSelectDay,
  onMonthChange,
}: {
  year: number;
  monthIndex: number;
  selectedDay: string;
  dayMeta: Record<string, MonthDayMeta>;
  loading?: boolean;
  onSelectDay: (ymd: string) => void;
  onMonthChange: (year: number, monthIndex: number) => void;
}) {
  const locale = useLocale();
  const t = useTranslations('mobile.adminScheduling');
  const tCal = useTranslations('mobile.calendar');
  const today = todayYmd();
  const cells = buildMonthCells(year, monthIndex);
  const monthLabel = new Date(year, monthIndex, 1).toLocaleDateString(
    locale === 'ar' ? 'ar' : locale === 'he' ? 'he' : 'en',
    { month: 'long', year: 'numeric' },
  );

  function step(delta: number) {
    const next = shiftMonth(year, monthIndex, delta);
    onMonthChange(next.y, next.m);
  }

  return (
    <SurfaceCard className="h-fit p-4" interactive={false} tilt={false}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">{t('monthTitle')}</p>
          <h2 className="text-lg font-semibold text-text-primary">{monthLabel}</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => step(-1)} aria-label={tCal('prevMonth')}>
            <ChevronRight className="h-4 w-4 rtl:hidden" />
            <ChevronLeft className="hidden h-4 w-4 rtl:block" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const d = new Date();
              onMonthChange(d.getFullYear(), d.getMonth());
              onSelectDay(today);
            }}
          >
            {t('stats.today')}
          </Button>
          <Button size="icon" variant="ghost" onClick={() => step(1)} aria-label={tCal('nextMonth')}>
            <ChevronLeft className="h-4 w-4 rtl:hidden" />
            <ChevronRight className="hidden h-4 w-4 rtl:block" />
          </Button>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-[280px] w-full rounded-xl" />
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
            {WEEKDAY_KEYS.map((key) => (
              <div key={key} className="py-1">
                {tCal(`weekdays.${key}`)}
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day == null) {
                return <div key={`pad-${i}`} className="min-h-[52px] rounded-lg" />;
              }
              const ymd = toYmd(year, monthIndex, day);
              const meta = dayMeta[ymd];
              const load: LoadTone = meta?.load ?? 'empty';
              const selected = ymd === selectedDay;
              const isToday = ymd === today;
              return (
                <button
                  key={ymd}
                  type="button"
                  onClick={() => onSelectDay(ymd)}
                  aria-pressed={selected}
                  aria-label={ymd}
                  className={cn(
                    'flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-1 text-center text-sm font-semibold transition',
                    TONE_CELL[load],
                    selected ? 'ring-2 ring-brand ring-offset-1 ring-offset-[var(--maher-surface)]' : '',
                    isToday && !selected ? 'outline outline-1 outline-brand/60' : '',
                  )}
                >
                  <span dir="ltr" className="tabular-nums">
                    {day}
                  </span>
                  {meta && meta.orderCount > 0 ? (
                    <span className="text-[10px] font-semibold tabular-nums leading-none opacity-90" dir="ltr">
                      {meta.orderCount}
                    </span>
                  ) : meta && !meta.isWorking ? (
                    <span className="h-1 w-3 rounded-full bg-current opacity-50" />
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-text-secondary">
            {LEGEND_KEYS.map((key) => (
              <span key={key} className="inline-flex items-center gap-1.5">
                <span className={cn('h-3.5 w-3.5 rounded-[4px] border', TONE_SWATCH[key])} />
                {tCal(`legend.${key}`)}
              </span>
            ))}
          </div>
        </>
      )}
    </SurfaceCard>
  );
}
