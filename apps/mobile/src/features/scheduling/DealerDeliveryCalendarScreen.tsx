import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
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
import { DealerDeliverySummaryBoard } from '@/features/sales-orders/components/DealerDeliverySummaryBoard';
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
  filterBySummaryTile,
  ordersOnCalendarDay,
  selectDealerCalendarDayMeta,
  type DealerSummaryTileKey,
} from './selectDealerDeliveries';
import { useOwnDeliveriesQuery } from './query';

const BACK_FALLBACK = '/(app)/(customer)/(tabs)/account' as Href;
const ORDER_HREF = (id: string) => `/(app)/(customer)/orders/${id}` as Href;

const TILE_TITLE: Record<DealerSummaryTileKey, string> = {
  upcoming: 'mobile.orders.summaryUpcoming',
  week: 'mobile.orders.summaryThisWeek',
  awaiting: 'mobile.orders.summaryAwaiting',
  delayed: 'mobile.orders.summaryDelayed',
};

function CalendarScreenTitle() {
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
        <View style={{ marginTop: 2 }}>
          <ScreenBackLead fallback={BACK_FALLBACK} />
        </View>
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
            {t('mobile.dealerAccount.calendarTitle')}
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

export function DealerDeliveryCalendarScreen() {
  const { t, formatDate, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const [cursor, setCursor] = useState<CalendarCursor>(() => initialCursorFromValue(todayYmd()));
  const [selectedDay, setSelectedDay] = useState(todayYmd());
  const [focusTile, setFocusTile] = useState<DealerSummaryTileKey | null>(null);
  const [ordersExpanded, setOrdersExpanded] = useState(false);

  const query = useOwnDeliveriesQuery(undefined, true);
  const today = query.data?.todayYmd ?? todayYmd();
  const todayCursor = initialCursorFromValue(today);
  const rows = query.data?.data ?? [];
  const summary = query.data?.summary ?? {
    upcoming: 0,
    thisWeek: 0,
    awaitingConfirmation: 0,
    mayBeDelayed: 0,
  };
  const dayMeta = useMemo(() => selectDealerCalendarDayMeta(rows), [rows]);
  const dayRows = useMemo(() => ordersOnCalendarDay(rows, selectedDay), [rows, selectedDay]);
  const focusedRows = useMemo(
    () => (focusTile ? filterBySummaryTile(rows, focusTile, today) : []),
    [focusTile, rows, today],
  );
  const listRows = focusTile ? focusedRows : dayRows;
  const listTitle = focusTile
    ? t(TILE_TITLE[focusTile])
    : t('mobile.orders.dayDeliveries', { date: formatDate(selectedDay) });
  const awayFromToday =
    selectedDay !== today ||
    focusTile != null ||
    cursor.y !== todayCursor.y ||
    cursor.m !== todayCursor.m;

  const openOrder = (salesOrderId: string) => {
    router.push(ORDER_HREF(salesOrderId));
  };

  const jumpToday = () => {
    setSelectedDay(today);
    setCursor(initialCursorFromValue(today));
    setFocusTile(null);
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
      <CalendarScreenTitle />
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
          <DealerDeliverySummaryBoard
            summary={summary}
            selectedTile={focusTile}
            onSelectTile={(key) => {
              setFocusTile((cur) => (cur === key ? null : key));
              setOrdersExpanded(false);
            }}
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
                <DealerBoardPill label={t('mobile.dealerAccount.calendarToday')} onPress={jumpToday} />
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
                  setFocusTile(null);
                  setOrdersExpanded(false);
                }}
                monthCursor={cursor}
                onMonthChange={(next) => {
                  setCursor(next);
                  const range = monthRangeYmd(next);
                  setSelectedDay(range.from);
                  setFocusTile(null);
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
                  ['proposed', t('mobile.orders.legendProposed'), colors.brand],
                  ['attention', t('mobile.orders.legendAttention'), colors.warning],
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
            count={listRows.length}
            caption={focusTile ? t('mobile.dealerAccount.calendarFocusHint') : undefined}
            headerAction={
              focusTile ? (
                <DealerBoardPill
                  label={t('mobile.dealerAccount.calendarShowDay')}
                  onPress={() => {
                    setFocusTile(null);
                    setOrdersExpanded(false);
                  }}
                />
              ) : null
            }
            expanded={ordersExpanded}
            onToggleExpand={() => setOrdersExpanded((open) => !open)}
          >
            {listRows.length === 0 ? (
              <DealerBoardEmpty
                title={
                  focusTile ? t('mobile.orders.emptyDeliveriesTitle') : t('mobile.orders.emptyDayTitle')
                }
                description={
                  focusTile
                    ? t('mobile.dealerAccount.calendarFocusHint')
                    : t('mobile.orders.emptyDayBody')
                }
              />
            ) : (
              <DealerCappedNestedScroll itemCount={listRows.length} expanded={ordersExpanded}>
                {listRows.map((row, index) => (
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
        </ScrollView>
      )}
    </AppScreen>
  );
}
