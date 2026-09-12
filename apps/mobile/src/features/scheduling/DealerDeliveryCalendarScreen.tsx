import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { AppText } from '@/components/AppText';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useNetwork } from '@/components/network/NetworkProvider';
import {
  initialCursorFromValue,
  monthRangeYmd,
  todayYmd,
  type CalendarCursor,
} from '@/components/calendar';
import { DealerEmptyState, DealerSearchBar } from '@/features/dealer-ui';
import { DealerDeliveryCard } from '@/features/sales-orders/components/DealerDeliveryCard';
import { OrdersListSkeleton } from '@/features/sales-orders/components/OrdersListSkeleton';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import {
  DealerBoardEmpty,
  DealerCappedNestedScroll,
  DealerDeliveryOrdersBoard,
} from './components/DealerDeliveryOrdersBoard';
import { DealerMonthBoard } from './components/DealerMonthBoard';
import { DealerScheduleHubBoard } from './components/DealerScheduleHubBoard';
import {
  DealerScheduleRail,
  type DealerScheduleSegment,
} from './components/DealerScheduleRail';
import {
  filterBySummaryTile,
  groupUpcomingByCalendarDate,
  matchDealerDeliverySearch,
  ordersOnCalendarDay,
  selectDealerCalendarDayMeta,
  type DealerSummaryTileKey,
  type UpcomingGroupKey,
} from './selectDealerDeliveries';
import { useOwnDeliveriesQuery } from './query';
import type { DealerDeliveryDto } from '@/api/modules/scheduling';

const BACK_FALLBACK = '/(app)/(customer)/(tabs)/account' as Href;
const ORDER_HREF = (id: string) => `/(app)/(customer)/orders/${id}` as Href;

const UPCOMING_GROUPS: Array<{ key: UpcomingGroupKey; titleKey: string }> = [
  { key: 'today', titleKey: 'mobile.orders.groupToday' },
  { key: 'thisWeek', titleKey: 'mobile.orders.groupThisWeek' },
  { key: 'later', titleKey: 'mobile.orders.groupLater' },
];

const EMPTY_SUMMARY = {
  upcoming: 0,
  thisWeek: 0,
  awaitingConfirmation: 0,
  mayBeDelayed: 0,
};

function ScheduleScreenTitle({ variant }: { variant: 'tab' | 'account' }) {
  const { t, isRTL, locale } = useLocale();
  const { theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const leadSize = theme.sizes.touch.min;

  return (
    <View style={{ minHeight: leadSize, justifyContent: 'center' }}>
      {variant === 'account' ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            zIndex: 1,
            justifyContent: 'center',
          }}
        >
          <ScreenBackLead fallback={BACK_FALLBACK} />
        </View>
      ) : null}
      <AppText
        variant="largeTitle"
        weight={titleWeight}
        align="center"
        numberOfLines={1}
        style={{ paddingHorizontal: leadSize + theme.spacing.sm }}
      >
        {t('mobile.tabs.schedule')}
      </AppText>
    </View>
  );
}

function applyDeskFilters(
  rows: DealerDeliveryDto[],
  opts: {
    selectedTile: DealerSummaryTileKey | null;
    q: string;
    locale: string;
    today: string;
  },
): DealerDeliveryDto[] {
  let next = rows;
  if (opts.selectedTile) next = filterBySummaryTile(next, opts.selectedTile, opts.today);
  if (opts.q) next = next.filter((row) => matchDealerDeliverySearch(row, opts.q, opts.locale));
  return next;
}

export function DealerDeliveryCalendarScreen({
  variant = 'account',
}: {
  variant?: 'tab' | 'account';
}) {
  const { t, formatDate, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const [segment, setSegment] = useState<DealerScheduleSegment>('upcoming');
  const [cursor, setCursor] = useState<CalendarCursor>(() => initialCursorFromValue(todayYmd()));
  const [selectedDay, setSelectedDay] = useState(todayYmd());
  const [ordersExpanded, setOrdersExpanded] = useState(false);
  const [selectedTile, setSelectedTile] = useState<DealerSummaryTileKey | null>(null);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const monthRange = monthRangeYmd(cursor);
  const upcomingQuery = useOwnDeliveriesQuery(undefined, true);
  const calendarQuery = useOwnDeliveriesQuery(monthRange, segment === 'calendar');
  const query = segment === 'calendar' ? calendarQuery : upcomingQuery;
  const today = query.data?.todayYmd ?? upcomingQuery.data?.todayYmd ?? todayYmd();
  const todayCursor = initialCursorFromValue(today);
  const summary = upcomingQuery.data?.summary ?? EMPTY_SUMMARY;

  const filterOpts = useMemo(
    () => ({ selectedTile, q, locale, today }),
    [selectedTile, q, locale, today],
  );

  const upcomingRows = useMemo(
    () => applyDeskFilters(upcomingQuery.data?.data ?? [], filterOpts),
    [upcomingQuery.data?.data, filterOpts],
  );
  const calendarRows = useMemo(
    () => applyDeskFilters(calendarQuery.data?.data ?? [], filterOpts),
    [calendarQuery.data?.data, filterOpts],
  );
  const dayMeta = useMemo(() => selectDealerCalendarDayMeta(calendarRows), [calendarRows]);
  const dayRows = useMemo(
    () => ordersOnCalendarDay(calendarRows, selectedDay),
    [calendarRows, selectedDay],
  );
  const upcomingGroups = useMemo(
    () => groupUpcomingByCalendarDate(upcomingRows, today),
    [upcomingRows, today],
  );
  const upcomingTotal =
    upcomingGroups.today.length + upcomingGroups.thisWeek.length + upcomingGroups.later.length;
  const filtersActive = Boolean(selectedTile) || q.length > 0;
  const listTitle = t('mobile.orders.dayDeliveriesCount', {
    date: formatDate(selectedDay),
    count: dayRows.length,
  });
  const awayFromToday =
    selectedDay !== today || cursor.y !== todayCursor.y || cursor.m !== todayCursor.m;
  const unconfirmedOnly =
    dayRows.length > 0 && dayRows.every((row) => row.customerStatus === 'AWAITING_CONFIRMATION');

  const openOrder = (salesOrderId: string) => {
    router.push(ORDER_HREF(salesOrderId));
  };

  const jumpToday = () => {
    setSelectedDay(today);
    setCursor(initialCursorFromValue(today));
    setOrdersExpanded(false);
  };

  const refresh = (
    <RefreshControl
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      tintColor={colors.brand}
    />
  );

  return (
    <AppScreen edges={{ top: true, bottom: false }}>
      {showOfflineBanner ? <OfflineBanner /> : null}
      {query.isError && !query.data ? (
        <View style={{ flex: 1, gap: theme.spacing.md }}>
          <ScheduleScreenTitle variant={variant} />
          <ErrorState
            title={t('mobile.orders.errorTitle')}
            description={t('mobile.orders.errorBody')}
            retryLabel={t('mobile.orders.retry')}
            onRetry={() => void query.refetch()}
          />
        </View>
      ) : (
        <ScrollView
          refreshControl={refresh}
          contentContainerStyle={{
            gap: theme.spacing.md,
            paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
          }}
        >
          <ScheduleScreenTitle variant={variant} />

          <DealerScheduleHubBoard
            summary={summary}
            selectedTile={selectedTile}
            onSelectTile={setSelectedTile}
          />

          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
              overflow: 'hidden',
              ...orderBoardShadow(colorScheme),
            }}
          >
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                ...(isRTL ? { right: 0 } : { left: 0 }),
                width: 3,
                backgroundColor: colors.brand,
                opacity: 0.55,
              }}
            />
            <View
              style={{
                padding: theme.spacing.md,
                gap: theme.spacing.md,
                ...(isRTL
                  ? { paddingRight: theme.spacing.md + 4 }
                  : { paddingLeft: theme.spacing.md + 4 }),
              }}
            >
              <DealerSearchBar
                value={search}
                onChangeText={setSearch}
                placeholder={t('mobile.orders.searchDeliveries')}
              />
              <DealerScheduleRail value={segment} onChange={setSegment} />
            </View>
          </View>

          {query.isLoading && !query.data ? (
            <OrdersListSkeleton />
          ) : segment === 'upcoming' ? (
            filtersActive && upcomingTotal === 0 ? (
              <DealerEmptyState
                title={t('mobile.orders.emptyFilter')}
                body={t('mobile.orders.emptyFilterHint')}
              />
            ) : (
              UPCOMING_GROUPS.map(({ key, titleKey }) => {
                const groupRows = upcomingGroups[key];
                return (
                  <DealerDeliveryOrdersBoard
                    key={key}
                    title={t(titleKey)}
                    count={groupRows.length}
                    expanded={ordersExpanded}
                    onToggleExpand={() => setOrdersExpanded((open) => !open)}
                  >
                    {groupRows.length === 0 ? (
                      <DealerBoardEmpty
                        title={t('mobile.orders.emptyDeliveriesTitle')}
                        description={t('mobile.orders.emptyDeliveriesBody')}
                      />
                    ) : (
                      <DealerCappedNestedScroll
                        itemCount={groupRows.length}
                        expanded={ordersExpanded}
                      >
                        {groupRows.map((row, index) => (
                          <DealerDeliveryCard
                            key={row.salesOrderId}
                            row={row}
                            index={index}
                            flush
                            onPress={() => openOrder(row.salesOrderId)}
                            onReviewDate={() => openOrder(row.salesOrderId)}
                          />
                        ))}
                      </DealerCappedNestedScroll>
                    )}
                  </DealerDeliveryOrdersBoard>
                );
              })
            )
          ) : (
            <>
              <DealerMonthBoard
                selectedDay={selectedDay}
                cursor={cursor}
                onCursorChange={(next) => {
                  setCursor(next);
                  const range = monthRangeYmd(next);
                  setSelectedDay(range.from);
                  setOrdersExpanded(false);
                }}
                dayMeta={dayMeta}
                onSelectDay={(ymd) => {
                  setSelectedDay(ymd);
                  setOrdersExpanded(false);
                }}
                showToday={awayFromToday}
                onJumpToday={jumpToday}
              />

              <DealerDeliveryOrdersBoard
                title={listTitle}
                count={dayRows.length}
                caption={unconfirmedOnly ? t('mobile.orders.notConfirmed') : undefined}
                expanded={ordersExpanded}
                onToggleExpand={() => setOrdersExpanded((open) => !open)}
              >
                {dayRows.length === 0 ? (
                  <DealerBoardEmpty
                    title={
                      filtersActive
                        ? t('mobile.orders.emptyFilter')
                        : t('mobile.orders.emptyDayTitle')
                    }
                    description={
                      filtersActive
                        ? t('mobile.orders.emptyFilterHint')
                        : t('mobile.orders.emptyDayBody')
                    }
                  />
                ) : (
                  <DealerCappedNestedScroll itemCount={dayRows.length} expanded={ordersExpanded}>
                    {dayRows.map((row, index) => (
                      <DealerDeliveryCard
                        key={row.salesOrderId}
                        row={row}
                        index={index}
                        flush
                        onPress={() => openOrder(row.salesOrderId)}
                        onReviewDate={() => openOrder(row.salesOrderId)}
                      />
                    ))}
                  </DealerCappedNestedScroll>
                )}
              </DealerDeliveryOrdersBoard>
            </>
          )}
        </ScrollView>
      )}
    </AppScreen>
  );
}
