import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { AppText } from '@/components/AppText';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useNetwork } from '@/components/network/NetworkProvider';
import {
  MonthCalendar,
  initialCursorFromValue,
  monthRangeYmd,
  todayYmd,
  type CalendarCursor,
} from '@/components/calendar';
import { DealerDeliveryCard } from '@/features/sales-orders/components/DealerDeliveryCard';
import { OrdersListSkeleton } from '@/features/sales-orders/components/OrdersListSkeleton';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import {
  DealerBoardEmpty,
  DealerBoardPill,
  DealerCappedNestedScroll,
  DealerDeliveryOrdersBoard,
} from './components/DealerDeliveryOrdersBoard';
import {
  groupUpcomingByCalendarDate,
  ordersOnCalendarDay,
  selectDealerCalendarDayMeta,
  type UpcomingGroupKey,
} from './selectDealerDeliveries';
import { useOwnDeliveriesQuery } from './query';

const BACK_FALLBACK = '/(app)/(customer)/(tabs)/account' as Href;
const ORDER_HREF = (id: string) => `/(app)/(customer)/orders/${id}` as Href;

type Segment = 'upcoming' | 'calendar';

const UPCOMING_GROUPS: Array<{ key: UpcomingGroupKey; titleKey: string }> = [
  { key: 'today', titleKey: 'mobile.orders.groupToday' },
  { key: 'thisWeek', titleKey: 'mobile.orders.groupThisWeek' },
  { key: 'later', titleKey: 'mobile.orders.groupLater' },
];

function ScheduleScreenTitle({ variant }: { variant: 'tab' | 'account' }) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'flex-start',
          gap: theme.spacing.md,
        }}
      >
        {variant === 'account' ? (
          <View style={{ marginTop: 2 }}>
            <ScreenBackLead fallback={BACK_FALLBACK} />
          </View>
        ) : null}
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <AppText
            variant="caption"
            weight={locale === 'ar' ? 'regular' : 'medium'}
            style={{
              letterSpacing: locale === 'ar' ? 0 : 1.4,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              color: colors.brand,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {t('mobile.orders.deliveryEyebrow')}
          </AppText>
          <AppText
            variant="title"
            weight={titleWeight}
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('mobile.tabs.schedule')}
          </AppText>
          <AppText
            variant="caption"
            color="muted"
            weight="regular"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('mobile.dealerAccount.calendarSubtitle')}
          </AppText>
        </View>
      </View>
    </View>
  );
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
  const [segment, setSegment] = useState<Segment>('upcoming');
  const [cursor, setCursor] = useState<CalendarCursor>(() => initialCursorFromValue(todayYmd()));
  const [selectedDay, setSelectedDay] = useState(todayYmd());
  const [ordersExpanded, setOrdersExpanded] = useState(false);

  const monthRange = monthRangeYmd(cursor);
  const upcomingQuery = useOwnDeliveriesQuery(undefined, true);
  const calendarQuery = useOwnDeliveriesQuery(monthRange, segment === 'calendar');
  const query = segment === 'calendar' ? calendarQuery : upcomingQuery;
  const today = query.data?.todayYmd ?? upcomingQuery.data?.todayYmd ?? todayYmd();
  const todayCursor = initialCursorFromValue(today);
  const rows = query.data?.data ?? [];
  const dayMeta = useMemo(() => selectDealerCalendarDayMeta(rows), [rows]);
  const dayRows = useMemo(() => ordersOnCalendarDay(rows, selectedDay), [rows, selectedDay]);
  const upcomingGroups = useMemo(
    () => groupUpcomingByCalendarDate(upcomingQuery.data?.data ?? [], today),
    [upcomingQuery.data?.data, today],
  );
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
      <ScheduleScreenTitle variant={variant} />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.sm,
        }}
      >
        {(['upcoming', 'calendar'] as const).map((key) => {
          const selected = segment === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setSegment(key)}
              style={{
                flex: 1,
                minHeight: 40,
                borderRadius: theme.radius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected ? colors.brand : colors.surfaceSecondary,
                borderWidth: 1,
                borderColor: selected ? colors.brand : colors.border,
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                style={{ color: selected ? colors.onBrand : colors.textSecondary }}
              >
                {t(key === 'upcoming' ? 'mobile.orders.modeUpcoming' : 'mobile.orders.modeCalendar')}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {query.isLoading && !query.data ? (
        <OrdersListSkeleton />
      ) : query.isError && !query.data ? (
        <ErrorState
          title={t('mobile.orders.errorTitle')}
          description={t('mobile.orders.errorBody')}
          retryLabel={t('mobile.orders.retry')}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <ScrollView
          refreshControl={refresh}
          contentContainerStyle={{
            paddingTop: theme.spacing.sm,
            paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
            gap: theme.spacing.md,
          }}
        >
          {segment === 'upcoming' ? (
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
                    <DealerCappedNestedScroll itemCount={groupRows.length} expanded={ordersExpanded}>
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
          ) : (
            <>
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
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: theme.spacing.sm,
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.sm + 2,
                    ...(isRTL
                      ? { paddingRight: theme.spacing.md + 4 }
                      : { paddingLeft: theme.spacing.md + 4 }),
                    backgroundColor: colors.surfaceSecondary,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                  }}
                >
                  <AppText
                    variant="caption"
                    weight={locale === 'ar' ? 'medium' : 'semibold'}
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      textTransform: locale === 'ar' ? 'none' : 'uppercase',
                      letterSpacing: locale === 'ar' ? 0 : 0.7,
                      fontSize: 11,
                      color: colors.brand,
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                  >
                    {t('mobile.dealerAccount.calendarMonthTitle')}
                  </AppText>
                  {awayFromToday ? (
                    <DealerBoardPill
                      label={t('mobile.dealerAccount.calendarToday')}
                      onPress={jumpToday}
                    />
                  ) : null}
                </View>

                <View
                  style={{
                    padding: theme.spacing.md,
                    gap: theme.spacing.md,
                    ...(isRTL
                      ? { paddingRight: theme.spacing.md + 4 }
                      : { paddingLeft: theme.spacing.md + 4 }),
                  }}
                >
                  <MonthCalendar
                    variant="dealer"
                    embedded
                    value={selectedDay}
                    onSelect={(ymd) => {
                      setSelectedDay(ymd);
                      setOrdersExpanded(false);
                    }}
                    monthCursor={cursor}
                    onMonthChange={(next) => {
                      setCursor(next);
                      const range = monthRangeYmd(next);
                      setSelectedDay(range.from);
                      setOrdersExpanded(false);
                    }}
                    dayMeta={dayMeta}
                    disableUnavailable={false}
                  />
                </View>

                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    flexWrap: 'wrap',
                    gap: theme.spacing.sm,
                    paddingHorizontal: theme.spacing.md,
                    paddingBottom: theme.spacing.md,
                    ...(isRTL
                      ? { paddingRight: theme.spacing.md + 4 }
                      : { paddingLeft: theme.spacing.md + 4 }),
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                    paddingTop: theme.spacing.sm + 2,
                    backgroundColor: colors.surfaceSecondary,
                  }}
                >
                  {(
                    [
                      ['confirmed', t('mobile.orders.legendConfirmed'), colors.success],
                      ['expected', t('mobile.orders.legendExpected'), colors.brand],
                      ['delayed', t('mobile.orders.legendMayBeDelayed'), colors.warning],
                      ['delivered', t('mobile.orders.legendDelivered'), colors.success],
                    ] as const
                  ).map(([key, label, color]) => (
                    <View
                      key={key}
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingHorizontal: theme.spacing.sm,
                        paddingVertical: 6,
                        borderRadius: theme.radius.full,
                        backgroundColor: colors.surface,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: colors.border,
                      }}
                    >
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                      <AppText variant="caption" color="secondary">
                        {label}
                      </AppText>
                    </View>
                  ))}
                </View>
              </View>

              <DealerDeliveryOrdersBoard
                title={listTitle}
                count={dayRows.length}
                caption={unconfirmedOnly ? t('mobile.orders.notConfirmed') : undefined}
                expanded={ordersExpanded}
                onToggleExpand={() => setOrdersExpanded((open) => !open)}
              >
                {dayRows.length === 0 ? (
                  <DealerBoardEmpty
                    title={t('mobile.orders.emptyDayTitle')}
                    description={t('mobile.orders.emptyDayBody')}
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
