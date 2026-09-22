'use client';

import { useKitCopy } from '@/lib/kit-copy';
import { useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import {
  formatPortalDate,
  groupUpcomingByCalendarDate,
  monthRangeYmd,
  ordersOnCalendarDay,
  selectDealerCalendarDayMeta,
  todayYmd,
  toYmdSlice,
  type CalendarCursor,
  type DealerDeliveryDto,
  type OwnDeliveriesResponse,
  type UpcomingGroupKey,
} from '@/lib/dealer-schedule';
import { localizedName } from '@maher/i18n';
import { Board, BoardSkeleton, CalendarLegend, ErrorBoard, Figure, ListRow, ListRows, Ltr, MonthCalendar, Ribbon, SegmentedControl, Stamp, type BoardTone } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

function statusTone(status: string): BoardTone {
  switch (status) {
    case 'DELIVERED':
      return 'success';
    case 'CONFIRMED':
    case 'ON_TRACK':
    case 'SHIPPED':
    case 'IN_TRANSIT':
      return 'brand';
    case 'AWAITING_CONFIRMATION':
    case 'REQUESTED':
      return 'info';
    case 'MAY_BE_DELAYED':
    case 'DELAYED':
      return 'warning';
    case 'CANCELLED':
      return 'error';
    default:
      return 'neutral';
  }
}

const GROUPS: Array<{ key: UpcomingGroupKey; titleKey: 'groupToday' | 'groupThisWeek' | 'groupLater' }> = [
  { key: 'today', titleKey: 'groupToday' },
  { key: 'thisWeek', titleKey: 'groupThisWeek' },
  { key: 'later', titleKey: 'groupLater' },
];

function productName(row: DealerDeliveryDto, locale: string) {
  return localizedName(locale, row.productName ?? {}, row.productName?.name || row.salesOrderNumber);
}

function dateLine(row: DealerDeliveryDto, locale: string, td: ReturnType<typeof useTranslations>) {
  const requested = toYmdSlice(row.requestedDeliveryDate);
  const planned = toYmdSlice(row.plannedDeliveryDate);
  const suggested = toYmdSlice(row.projectedDeliveryDate ?? row.suggestedDeliveryDate);
  const committed = toYmdSlice(row.committedDeliveryDate);
  const projected = toYmdSlice(row.projectedDeliveryDate);
  const delayed = row.customerStatus === 'MAY_BE_DELAYED' || row.customerStatus === 'DELAYED';
  const fmt = (value: string) => formatPortalDate(locale, value);
  if (row.compactDates && committed && !delayed) {
    return td('compactOnTrack', { date: fmt(committed) });
  }
  if (planned && !committed) {
    return `${td('planned')} ${fmt(planned)} · ${td('notConfirmed')}`;
  }
  if (row.customerStatus === 'AWAITING_CONFIRMATION') {
    if (planned) return `${td('planned')} ${fmt(planned)} · ${td('notConfirmed')}`;
    if (suggested) return `${td('expected')} ${fmt(suggested)} · ${td('notConfirmed')}`;
    if (requested) return `${td('requested')} ${fmt(requested)} · ${td('notConfirmed')}`;
    return td('notConfirmed');
  }
  if (committed && projected && projected !== committed) {
    return `${td('confirmed')} ${fmt(committed)} · ${td('currentExpected')} ${fmt(projected)}`;
  }
  if (committed) return `${td('confirmed')} ${fmt(committed)}`;
  return row.calendarDate ? fmt(row.calendarDate) : null;
}

function DeliveryRow({ row }: { row: DealerDeliveryDto }) {
  const locale = useLocale();
  const td = useTranslations('production.dealerDelivery');
  const tStatus = useTranslations('statuses');
  const router = useRouter();
  const line = dateLine(row, locale, td);
  const delayed = row.customerStatus === 'MAY_BE_DELAYED' || row.customerStatus === 'DELAYED';
  const note = delayed ? (row.scheduleUpdating || !row.projectedDeliveryDate ? td('scheduleUpdating') : td('productionDelay')) : row.customerSafeReason ? td('scheduleUpdating') : null;
  const label = (() => {
    try {
      return tStatus(row.customerStatus as 'PENDING');
    } catch {
      return row.customerStatus.replaceAll('_', ' ').toLowerCase();
    }
  })();
  return (
    <ListRow
      tone={statusTone(row.customerStatus)}
      title={productName(row, locale)}
      meta={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <Ltr>{row.salesOrderNumber}</Ltr>
          {line ? <span>· {line}</span> : null}
          {note ? <span className="text-[var(--maher-warning)]">· {note}</span> : null}
        </span>
      }
      trailing={<Stamp tone={statusTone(row.customerStatus)} size="sm">{label}</Stamp>}
      onClick={() => router.push(`/dealer/orders/${row.salesOrderId}`)}
    />
  );
}

export default function DeliveriesPage() {
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const td = useTranslations('production.dealerDelivery');
  const locale = useLocale();
  const kit = useKitCopy();
  const [segment, setSegment] = useState<'upcoming' | 'calendar'>('upcoming');
  const initial = todayYmd();
  const [cursor, setCursor] = useState<CalendarCursor>(() => {
    const [y, m] = initial.split('-').map(Number);
    return { y: y ?? 2026, m: (m ?? 8) - 1 };
  });
  const [selectedDay, setSelectedDay] = useState(initial);
  const monthRange = monthRangeYmd(cursor);

  const upcomingQuery = useQuery({
    queryKey: ['customer-own-deliveries', 'upcoming'],
    queryFn: () => apiFetch<OwnDeliveriesResponse>('/api/v1/scheduling/own-deliveries'),
  });
  const calendarQuery = useQuery({
    queryKey: ['customer-own-deliveries', monthRange.from, monthRange.to],
    queryFn: () =>
      apiFetch<OwnDeliveriesResponse>(
        `/api/v1/scheduling/own-deliveries?from=${monthRange.from}&to=${monthRange.to}`,
      ),
    enabled: segment === 'calendar',
  });

  const query = segment === 'calendar' ? calendarQuery : upcomingQuery;
  const today = query.data?.todayYmd ?? upcomingQuery.data?.todayYmd ?? initial;
  const rows = useMemo(() => query.data?.data ?? [], [query.data?.data]);
  const groups = useMemo(
    () => groupUpcomingByCalendarDate(upcomingQuery.data?.data ?? [], today),
    [upcomingQuery.data?.data, today],
  );
  const dayMeta = useMemo(() => selectDealerCalendarDayMeta(rows), [rows]);
  const dayRows = useMemo(() => ordersOnCalendarDay(rows, selectedDay), [rows, selectedDay]);
  const unconfirmedOnly =
    dayRows.length > 0 && dayRows.every((row) => row.customerStatus === 'AWAITING_CONFIRMATION');

  const allRows = upcomingQuery.data?.data ?? [];
  const live = allRows.filter((r) => r.customerStatus !== 'CANCELLED' && r.customerStatus !== 'DELIVERED');
  const counts = {
    confirmed: live.filter((r) => ['CONFIRMED', 'ON_TRACK', 'SHIPPED', 'IN_TRANSIT'].includes(r.customerStatus)).length,
    awaiting: live.filter((r) => ['AWAITING_CONFIRMATION', 'REQUESTED'].includes(r.customerStatus)).length,
    delayed: live.filter((r) => ['MAY_BE_DELAYED', 'DELAYED'].includes(r.customerStatus)).length,
    delivered: allRows.filter((r) => r.customerStatus === 'DELIVERED').length,
  };
  const heroTone: BoardTone = counts.delayed ? 'warning' : counts.confirmed ? 'brand' : 'neutral';

  return (
    <div className="maher-stagger space-y-5">
      <Board tone={heroTone} wash="top" as="section">
        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{tNav('schedule')}</h1>
              <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{tCommon('deliveriesSubtitle')}</p>
            </div>
            <SegmentedControl<'upcoming' | 'calendar'>
              value={segment}
              onChange={setSegment}
              options={[
                { value: 'upcoming', label: td('modeUpcoming') },
                { value: 'calendar', label: td('modeCalendar') },
              ]}
            />
          </div>
          <div className="min-w-0">
            <Ribbon
              size="sm"
              segments={[
                { key: 'confirmed', label: td('legendConfirmed'), value: counts.confirmed, tone: 'brand' },
                { key: 'awaiting', label: td('legendExpected'), value: counts.awaiting, tone: 'info' },
                { key: 'delayed', label: td('legendMayBeDelayed'), value: counts.delayed, tone: 'warning' },
                { key: 'delivered', label: td('legendDelivered'), value: counts.delivered, tone: 'success' },
              ]}
            />
            <div className="mt-3 grid grid-cols-3 gap-4">
              <Figure size="sm" value={groups.today.length} label={td('groupToday')} tone={groups.today.length ? 'brand' : 'neutral'} />
              <Figure size="sm" value={groups.thisWeek.length} label={td('groupThisWeek')} />
              <Figure size="sm" value={counts.delayed} label={td('legendMayBeDelayed')} tone={counts.delayed ? 'warning' : 'neutral'} />
            </div>
          </div>
        </div>
      </Board>

      {query.isLoading && !query.data ? (
        <BoardSkeleton rows={6} />
      ) : query.isError && !query.data ? (
        <ErrorBoard title={tNav('schedule')} description={tCommon('loadFailed')} onRetry={() => void query.refetch()} retryLabel={tCommon('retry')} />
      ) : segment === 'upcoming' ? (
        <div className="maher-stagger grid gap-5 xl:grid-cols-12">
          {GROUPS.map(({ key, titleKey }) => (
            <Board key={key} tone={key === 'today' ? 'brand' : 'neutral'} className={key === 'later' ? 'xl:col-span-12' : 'xl:col-span-6'}>
              <Board.Header title={td(titleKey)} meta={<Stamp tone={groups[key].length ? (key === 'today' ? 'brand' : 'neutral') : 'neutral'} size="sm">{groups[key].length}</Stamp>} />
              {groups[key].length === 0 ? (
                <Board.Empty title={tCommon('noDeliveries')} description={key === 'today' ? tCommon('noDeliveriesHint') : undefined} />
              ) : (
                <ListRows>
                  {groups[key].map((row) => (
                    <DeliveryRow key={row.salesOrderId} row={row} />
                  ))}
                </ListRows>
              )}
            </Board>
          ))}
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-12">
          <Board tone="brand" className="xl:col-span-7">
            <Board.Body>
              <MonthCalendar
                embedded
                variant="dealer"
                locale={locale}
                monthCursor={cursor}
                onMonthChange={(next) => {
                  setCursor(next);
                  setSelectedDay(monthRangeYmd(next).from);
                }}
                value={selectedDay}
                onSelect={setSelectedDay}
                dayMeta={dayMeta}
                prevLabel={kit.date.prevMonth}
                nextLabel={kit.date.nextMonth}
                footer={
                  <CalendarLegend
                    className="pt-3"
                    items={[
                      { id: 'confirmed', label: td('legendConfirmed'), swatch: 'confirmed' },
                      { id: 'proposed', label: td('legendExpected'), swatch: 'proposed' },
                      { id: 'attention', label: td('legendMayBeDelayed'), swatch: 'attention' },
                      { id: 'today', label: tCommon('today'), swatch: 'today' },
                    ]}
                  />
                }
              />
            </Board.Body>
          </Board>
          <Board tone={dayRows.length ? 'brand' : 'neutral'} className="xl:col-span-5">
            <Board.Header
              title={<Ltr>{formatPortalDate(locale, selectedDay)}</Ltr>}
              description={unconfirmedOnly ? td('notConfirmed') : undefined}
              meta={<Stamp tone={dayRows.length ? 'brand' : 'neutral'} size="sm">{dayRows.length}</Stamp>}
            />
            {dayRows.length === 0 ? (
              <Board.Empty title={td('emptyDayTitle')} description={td('emptyDayBody')} />
            ) : (
              <ListRows>
                {dayRows.map((row) => (
                  <DeliveryRow key={row.salesOrderId} row={row} />
                ))}
              </ListRows>
            )}
          </Board>
        </div>
      )}
    </div>
  );
}
