'use client';

import { DealerMonthCalendar } from '@/components/dealer-month-calendar';
import { Link } from '@/i18n/navigation';
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
import {
  Card,
  EmptyState,
  ErrorState,
  Ltr,
  PageHeader,
  Skeleton,
  StatusBadge,
} from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

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

function DeliveryCard({ row }: { row: DealerDeliveryDto }) {
  const locale = useLocale();
  const td = useTranslations('production.dealerDelivery');
  const line = dateLine(row, locale, td);
  return (
    <Link href={`/orders/${row.salesOrderId}`} className="block">
      <Card className="maher-list-card p-4 transition hover:border-brand/40">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-text-primary">{productName(row, locale)}</p>
            <p className="mt-0.5 text-xs text-text-secondary">
              <Ltr>{row.salesOrderNumber}</Ltr>
            </p>
            {line ? <p className="mt-2 text-sm text-text-secondary">{line}</p> : null}
            {row.customerStatus === 'MAY_BE_DELAYED' || row.customerStatus === 'DELAYED' ? (
              <p className="mt-1 text-xs text-text-secondary">{td('productionDelay')}</p>
            ) : null}
            {(row.customerStatus === 'MAY_BE_DELAYED' || row.customerStatus === 'DELAYED') &&
            (row.scheduleUpdating || !row.projectedDeliveryDate) ? (
              <p className="mt-1 text-xs text-text-secondary">{td('scheduleUpdating')}</p>
            ) : row.customerStatus !== 'MAY_BE_DELAYED' &&
              row.customerStatus !== 'DELAYED' &&
              row.customerSafeReason ? (
              <p className="mt-1 text-xs text-text-secondary">{td('scheduleUpdating')}</p>
            ) : null}
          </div>
          <StatusBadge status={row.customerStatus} />
        </div>
      </Card>
    </Link>
  );
}

export default function DeliveriesPage() {
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const td = useTranslations('production.dealerDelivery');
  const locale = useLocale();
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
  const rows = query.data?.data ?? [];
  const groups = useMemo(
    () => groupUpcomingByCalendarDate(upcomingQuery.data?.data ?? [], today),
    [upcomingQuery.data?.data, today],
  );
  const dayMeta = useMemo(() => selectDealerCalendarDayMeta(rows), [rows]);
  const dayRows = useMemo(() => ordersOnCalendarDay(rows, selectedDay), [rows, selectedDay]);
  const unconfirmedOnly =
    dayRows.length > 0 && dayRows.every((row) => row.customerStatus === 'AWAITING_CONFIRMATION');

  return (
    <div className="space-y-6">
      <PageHeader title={tNav('schedule')} description={tCommon('deliveriesSubtitle')} />

      <div className="flex gap-2">
        {(['upcoming', 'calendar'] as const).map((key) => {
          const selected = segment === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSegment(key)}
              className={
                selected
                  ? 'rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white'
                  : 'rounded-full border border-border px-4 py-2 text-sm text-text-secondary'
              }
            >
              {td(key === 'upcoming' ? 'modeUpcoming' : 'modeCalendar')}
            </button>
          );
        })}
      </div>

      {query.isLoading && !query.data ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : query.isError && !query.data ? (
        <ErrorState
          title={tNav('schedule')}
          description={tCommon('loadFailed')}
          onRetry={() => void query.refetch()}
          retryLabel={tCommon('retry')}
        />
      ) : segment === 'upcoming' ? (
        <div className="space-y-6">
          {GROUPS.map(({ key, titleKey }) => (
            <section key={key} className="space-y-3">
              <h2 className="text-sm font-semibold text-text-primary">{td(titleKey)}</h2>
              {groups[key].length === 0 ? (
                <EmptyState title={tCommon('noDeliveries')} description={tCommon('noDeliveriesHint')} />
              ) : (
                <div className="grid gap-3">
                  {groups[key].map((row) => (
                    <DeliveryCard key={row.salesOrderId} row={row} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <Card className="p-4">
            <DealerMonthCalendar
              cursor={cursor}
              selectedDay={selectedDay}
              todayYmd={today}
              dayMeta={dayMeta}
              onSelect={setSelectedDay}
              onMonthChange={(next) => {
                setCursor(next);
                setSelectedDay(monthRangeYmd(next).from);
              }}
            />
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-text-secondary">
              <span>{td('legendConfirmed')}</span>
              <span>{td('legendExpected')}</span>
              <span>{td('legendMayBeDelayed')}</span>
              <span>{td('legendDelivered')}</span>
            </div>
          </Card>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-text-primary">
              {td('dayHeading', {
                date: formatPortalDate(locale, selectedDay),
                count: dayRows.length,
              })}
            </h2>
            {unconfirmedOnly ? (
              <p className="text-xs text-text-secondary">{td('notConfirmed')}</p>
            ) : null}
            {dayRows.length === 0 ? (
              <EmptyState title={td('emptyDayTitle')} description={td('emptyDayBody')} />
            ) : (
              <div className="grid gap-3">
                {dayRows.map((row) => (
                  <DeliveryCard key={row.salesOrderId} row={row} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
