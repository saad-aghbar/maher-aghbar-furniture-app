import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { canAny } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { ToastClearance } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import {
  AnimatedPressable,
  CountUp,
  ListItemEnter,
  haptics,
} from '@/motion';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import type { ProductionDateMode, ProductionListBucket } from './api';
import { ProductionDealerBar } from './components/ProductionDealerBar';
import { ProductionDealerSheet } from './components/ProductionDealerSheet';
import { ProductionDayLensBoard } from './components/ProductionDayLensBoard';
import { ProductionDayOrderCard } from './components/ProductionDayOrderCard';
import { ProductionOrderCard } from './components/ProductionOrderCard';
import { ProductionListSkeleton } from './components/ProductionSkeleton';
import { deviceLocalTodayYmd } from './factoryLocalDay';
import {
  flattenProductionOrderPages,
  useProductionDaySummaryQuery,
  useProductionDealersQuery,
  useProductionOrdersInfiniteQuery,
  useProductionSummaryQuery,
} from './query';
import { selectProductionCard } from './selectProduction';

type MetricAccent = 'brand' | 'info' | 'success' | 'late' | 'warning';

type MetricKey =
  | 'needs_setup'
  | 'ready_to_start'
  | 'on_floor'
  | 'blocked'
  | 'inspection_packaging';

type MetricDef = {
  key: MetricKey;
  label: string;
  value: number;
  accent?: MetricAccent;
};

const BOARD_BUCKETS = new Set<string>([
  'needs_setup',
  'ready_to_start',
  'on_floor',
  'blocked',
  'inspection_packaging',
  'completed',
  'in_production',
  'late',
  'all',
]);

export function ProductionOverviewScreen() {
  const { user, refreshUser } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { theme, colors, colorScheme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const listBottomPad = theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE;
  const router = useRouter();
  const params = useLocalSearchParams<{ bucket?: string; section?: string; quality?: string }>();
  const listRef = useRef<FlatList>(null);
  /** Stagger enter only on first paint — filter swaps remount rows and must stay opaque. */
  const [staggerListEnter, setStaggerListEnter] = useState(true);
  const allowed = canAny(user, ['production-order.read', 'production-task.read']);
  const canWorkflow = canAny(user, ['production.workflow.read', 'production-order.update']);

  const initialBucket = (() => {
    const raw = String(params.bucket ?? params.section ?? 'on_floor');
    return BOARD_BUCKETS.has(raw) ? (raw as ProductionListBucket) : 'on_floor';
  })();

  const [bucket, setBucket] = useState<ProductionListBucket>(initialBucket);
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [dealerId, setDealerId] = useState<string | null>(null);
  const [dealerLabel, setDealerLabel] = useState<string | null>(null);
  const [dealerSheetOpen, setDealerSheetOpen] = useState(false);
  const [onDate, setOnDate] = useState(deviceLocalTodayYmd());
  const [dateMode, setDateMode] = useState<ProductionDateMode>('planned');
  const [dateScope, setDateScope] = useState<'day' | 'all'>('day');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [factoryTodayYmd, setFactoryTodayYmd] = useState(deviceLocalTodayYmd());

  useEffect(() => {
    const raw = String(params.bucket ?? params.section ?? '');
    if (raw && BOARD_BUCKETS.has(raw)) {
      setBucket(raw as ProductionListBucket);
    }
  }, [params.bucket, params.section, params.quality]);

  // Pick up newly seeded production.workflow.* grants without forcing a full reinstall.
  useEffect(() => {
    if (!allowed) return;
    void refreshUser();
  }, [allowed, refreshUser]);

  useEffect(() => {
    const id = setTimeout(() => {
      const next = searchInput.trim();
      if (next !== q) setStaggerListEnter(false);
      setQ(next);
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput, q]);

  const summaryQuery = useProductionSummaryQuery(allowed);
  const daySummaryQuery = useProductionDaySummaryQuery(
    {
      onDate,
      dateMode,
      bucket,
      customerId: dealerId ?? undefined,
    },
    allowed && dateScope === 'day',
  );
  const dealersQuery = useProductionDealersQuery(allowed);
  const listQuery = useProductionOrdersInfiniteQuery(
    {
      bucket,
      q: q || undefined,
      customerId: dealerId ?? undefined,
      onDate: dateScope === 'day' ? onDate : undefined,
      dateMode: dateScope === 'day' ? dateMode : undefined,
    },
    allowed,
  );

  useEffect(() => {
    const today = daySummaryQuery.data?.factoryTodayYmd;
    if (today) setFactoryTodayYmd(today);
  }, [daySummaryQuery.data?.factoryTodayYmd]);

  const refreshing =
    (summaryQuery.isRefetching ||
      listQuery.isRefetching ||
      daySummaryQuery.isRefetching) &&
    !listQuery.isFetchingNextPage &&
    !listQuery.isPlaceholderData;

  /** Soft indicator while keepPreviousData shows the prior list. */
  const isFilterUpdating =
    listQuery.isFetching &&
    !listQuery.isFetchingNextPage &&
    Boolean(listQuery.data);

  const listItems = useMemo(
    () => flattenProductionOrderPages(listQuery.data),
    [listQuery.data],
  );

  useEffect(() => {
    if (!staggerListEnter) return;
    if (listQuery.isPending || !listQuery.data) return;
    const t = setTimeout(() => setStaggerListEnter(false), 520);
    return () => clearTimeout(t);
  }, [listQuery.data, listQuery.isPending, staggerListEnter]);

  const selectBucket = (next: ProductionListBucket) => {
    // Tap active lane again → clear filter and show all orders.
    const resolved = next === bucket ? 'all' : next;
    if (resolved === bucket) return;
    setStaggerListEnter(false);
    void haptics.selection();
    setBucket(resolved);
    // Persist lane in URL so list → detail → back restores Attention/Needs planning/etc.
    router.setParams({ bucket: resolved === 'all' ? undefined : resolved });
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  if (!allowed) {
    return (
      <AppScreen>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  // Only the true first load — never tear down the page when filters change
  const initialLoad = listQuery.isPending && !listQuery.data;

  if (initialLoad) {
    return (
      <AppScreen>
        <ProductionHubTitle titleWeight={locale === 'ar' ? 'medium' : 'semibold'} />
        <ProductionListSkeleton />
      </AppScreen>
    );
  }

  if (listQuery.isError && !listQuery.data) {
    return (
      <AppScreen>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ToastClearance />
        <ProductionHubTitle titleWeight={locale === 'ar' ? 'medium' : 'semibold'} />
        <ErrorState
          title={t('mobile.production.errorTitle')}
          description={t('mobile.production.errorBody')}
          retryLabel={t('mobile.production.retry')}
          onRetry={() => void listQuery.refetch()}
        />
      </AppScreen>
    );
  }

  const summary = summaryQuery.data;
  const dayBoard = daySummaryQuery.data?.board;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  // All time → full production-summary lanes. By day → day-scoped board counts.
  const boardCounts =
    dateScope === 'all'
      ? summary
        ? {
            needsSetup: summary.needsSetup ?? 0,
            readyToStart: summary.readyToStart ?? 0,
            onFloor: summary.onFloor ?? 0,
            blocked: summary.blocked ?? 0,
            inspectionPackaging: summary.inspectionPackaging ?? 0,
          }
        : null
      : dayBoard
        ? {
            needsSetup: dayBoard.needsSetup,
            readyToStart: dayBoard.readyToStart,
            onFloor: dayBoard.onFloor,
            blocked: dayBoard.blocked,
            inspectionPackaging: dayBoard.inspectionPackaging,
          }
        : null;

  const setupMetrics: MetricDef[] | null = boardCounts
    ? [
        {
          key: 'needs_setup',
          label: t('mobile.production.needsSetup'),
          value: boardCounts.needsSetup,
          accent: 'warning',
        },
        {
          key: 'ready_to_start',
          label: t('mobile.production.readyToStart'),
          value: boardCounts.readyToStart,
          accent: 'brand',
        },
        {
          key: 'on_floor',
          label: t('mobile.production.onFloor'),
          value: boardCounts.onFloor,
          accent: 'info',
        },
      ]
    : null;

  const attentionMetrics: MetricDef[] | null = boardCounts
    ? [
        {
          key: 'blocked',
          label: t('mobile.production.blocked'),
          value: boardCounts.blocked,
          accent: boardCounts.blocked > 0 ? 'late' : undefined,
        },
        {
          key: 'inspection_packaging',
          label: t('mobile.production.inspectionPackaging'),
          value: boardCounts.inspectionPackaging,
          accent: 'success',
        },
      ]
    : null;

  return (
    <AppScreen>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <FlatList
        ref={listRef}
        data={listItems}
        keyExtractor={(item) => item.id}
        style={{ opacity: isFilterUpdating ? 0.72 : 1 }}
        extraData={`${bucket}:${q}:${dealerId}:${dateScope}:${onDate}:${dateMode}:${isFilterUpdating}`}
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: listBottomPad,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl
            tintColor={colors.brand}
            refreshing={refreshing}
            onRefresh={() => {
              void summaryQuery.refetch();
              void daySummaryQuery.refetch();
              void listQuery.refetch();
            }}
          />
        }
        onEndReached={() => {
          if (listQuery.hasNextPage && !listQuery.isFetchingNextPage) {
            void listQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.lg, marginBottom: theme.spacing.sm }}>
            {isFilterUpdating ? (
              <AppText
                variant="caption"
                color="muted"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {t('mobile.production.updatingList')}
              </AppText>
            ) : null}
            <ToastClearance />
            <ProductionHubTitle titleWeight={titleWeight} />

            <ProductionDayLensBoard
              dateScope={dateScope}
              onDate={onDate}
              dateMode={dateMode}
              factoryTodayYmd={factoryTodayYmd}
              summary={daySummaryQuery.data ?? null}
              onChangeScope={(scope) => {
                setStaggerListEnter(false);
                setDateScope(scope);
                listRef.current?.scrollToOffset({ offset: 0, animated: false });
              }}
              onChangeDate={(ymd) => {
                setStaggerListEnter(false);
                setDateScope('day');
                setOnDate(ymd);
                listRef.current?.scrollToOffset({ offset: 0, animated: false });
              }}
              onChangeMode={(mode) => {
                setStaggerListEnter(false);
                setDateMode(mode);
                listRef.current?.scrollToOffset({ offset: 0, animated: false });
              }}
              calendarOpen={calendarOpen}
              onCalendarOpenChange={setCalendarOpen}
            />

            {canWorkflow ? (
              <AnimatedPressable
                variant="button"
                onPress={() => {
                  void haptics.selection();
                  router.push('/(app)/(admin)/production/workflow' as Href);
                }}
                style={{
                  borderRadius: theme.radius.xl,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
                  backgroundColor: colors.surface,
                  overflow: 'hidden',
                  paddingHorizontal: theme.spacing.lg,
                  paddingVertical: theme.spacing.md,
                  ...(isRTL
                    ? { paddingRight: theme.spacing.lg + 4 }
                    : { paddingLeft: theme.spacing.lg + 4 }),
                  ...orderBoardShadow(colorScheme),
                }}
                accessibilityRole="button"
                accessibilityLabel={t('mobile.production.workflow.title')}
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
                    gap: theme.spacing.md,
                  }}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.brandSoft,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Ionicons name="git-network-outline" size={14} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="label" weight={titleWeight}>
                      {t('mobile.production.workflow.title')}
                    </AppText>
                    <AppText variant="caption" color="muted">
                      {t('mobile.production.workflow.subtitle')}
                    </AppText>
                  </View>
                  <Ionicons
                    name={isRTL ? 'chevron-back' : 'chevron-forward'}
                    size={18}
                    color={colors.brand}
                  />
                </View>
              </AnimatedPressable>
            ) : null}

            {setupMetrics && attentionMetrics ? (
              <View
                style={{
                  borderRadius: theme.radius.xl,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.borderStrong,
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
                    paddingHorizontal: theme.spacing.md,
                    paddingTop: theme.spacing.md,
                    paddingBottom: theme.spacing.sm,
                    ...(isRTL
                      ? { paddingRight: theme.spacing.md + 4 }
                      : { paddingLeft: theme.spacing.md + 4 }),
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: theme.spacing.sm,
                    backgroundColor: colors.surfaceSecondary,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <AppText
                    variant="caption"
                    weight={titleWeight}
                    style={{
                      color: colors.brand,
                      letterSpacing: locale === 'ar' ? 0 : 0.55,
                      textTransform: locale === 'ar' ? 'none' : 'uppercase',
                      fontSize: 10,
                      lineHeight: 12,
                    }}
                  >
                    {t('mobile.production.boardSections')}
                  </AppText>
                  <AppText variant="caption" color="muted" numberOfLines={1}>
                    {bucket === 'all'
                      ? t('mobile.production.boardShowingAll')
                      : t('mobile.production.boardTapAgain')}
                  </AppText>
                </View>

                <View
                  style={{
                    padding: theme.spacing.sm,
                    gap: theme.spacing.sm,
                    ...(isRTL
                      ? { paddingRight: theme.spacing.sm + 4 }
                      : { paddingLeft: theme.spacing.sm + 4 }),
                  }}
                >
                  <MetricRow
                    isRTL={isRTL}
                    items={setupMetrics}
                    selected={bucket}
                    onSelect={selectBucket}
                  />
                  <MetricRow
                    isRTL={isRTL}
                    items={attentionMetrics}
                    selected={bucket}
                    onSelect={selectBucket}
                  />
                </View>
              </View>
            ) : null}

            <View
              style={{
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                backgroundColor: colors.surface,
                padding: theme.spacing.md,
                gap: theme.spacing.md,
                ...orderBoardShadow(colorScheme),
              }}
            >
              <ProductionDealerBar
                label={dealerLabel}
                onPress={() => setDealerSheetOpen(true)}
                onClear={() => {
                  setStaggerListEnter(false);
                  setDealerId(null);
                  setDealerLabel(null);
                  listRef.current?.scrollToOffset({ offset: 0, animated: false });
                }}
              />
              <TextField
                value={searchInput}
                onChangeText={setSearchInput}
                placeholder={t('mobile.production.searchPlaceholder')}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                pill
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          listQuery.isFetching && listItems.length === 0 ? (
            <ProductionListSkeleton />
          ) : listItems.length === 0 && !listQuery.isFetching ? (
            <DealerEmptyPanel
              icon="construct-outline"
              text={
                dealerLabel
                  ? t('mobile.production.emptyDealerBody', { dealer: dealerLabel })
                  : q
                    ? t('mobile.production.emptySearchBody')
                    : dateScope === 'all'
                      ? t('mobile.production.emptyBody')
                      : dateMode === 'planned'
                        ? t('mobile.production.dayLens.emptyPlanned')
                        : daySummaryQuery.data?.isFuture
                          ? t('mobile.production.dayLens.emptyActualFuture')
                          : t('mobile.production.dayLens.emptyActual')
              }
            />
          ) : null
        }
        ListFooterComponent={
          <View style={{ paddingBottom: theme.spacing.sm }}>
            {listQuery.isFetchingNextPage ? (
              <AppText
                variant="caption"
                color="secondary"
                style={{ textAlign: 'center', paddingVertical: theme.spacing.md }}
              >
                {t('mobile.production.loadingMore')}
              </AppText>
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => {
          const card = selectProductionCard(item, locale);
          const openOrder = () => {
            void haptics.selection();
            const soId = item.salesOrder?.id ?? card.salesOrderId;
            const released = Boolean(item.releasedToFactoryAt);
            if ((!released || bucket === 'needs_setup') && soId) {
              router.push(`/(app)/(admin)/orders/${soId}/production-plan` as Href);
              return;
            }
            router.push(`/(app)/(admin)/production/${item.id}` as Href);
          };
          return (
            <ListItemEnter index={index} enabled={staggerListEnter}>
              {dateScope === 'all' ? (
                <ProductionOrderCard order={card} onPress={openOrder} />
              ) : (
                <ProductionDayOrderCard order={item} onPress={openOrder} />
              )}
            </ListItemEnter>
          );
        }}
      />
      <ProductionDealerSheet
        open={dealerSheetOpen}
        onClose={() => setDealerSheetOpen(false)}
        dealers={dealersQuery.data?.data ?? []}
        loading={dealersQuery.isPending && !dealersQuery.data}
        selectedId={dealerId}
        onSelect={(next) => {
          setStaggerListEnter(false);
          setDealerId(next?.id ?? null);
          setDealerLabel(next?.name ?? null);
          listRef.current?.scrollToOffset({ offset: 0, animated: false });
        }}
      />
    </AppScreen>
  );
}

function ProductionHubTitle({ titleWeight }: { titleWeight: 'medium' | 'semibold' }) {
  const { t, locale } = useLocale();
  const { theme, colors } = useTheme();

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText
        variant="caption"
        color="muted"
        align="center"
        style={{
          color: colors.brand,
          letterSpacing: locale === 'ar' ? 0 : 0.55,
          textTransform: locale === 'ar' ? 'none' : 'uppercase',
          fontSize: 10,
        }}
      >
        {t('mobile.production.pulseEyebrow')}
      </AppText>
      <AppText variant="largeTitle" weight={titleWeight} align="center">
        {t('mobile.production.title')}
      </AppText>
      <AppText variant="caption" color="muted" align="center">
        {t('mobile.production.subtitle')}
      </AppText>
    </View>
  );
}

function MetricRow({
  items,
  isRTL,
  selected,
  onSelect,
}: {
  items: MetricDef[];
  isRTL: boolean;
  selected: ProductionListBucket;
  onSelect: (next: ProductionListBucket) => void;
}) {
  const { colors, theme } = useTheme();
  const { locale } = useLocale();

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'stretch',
        gap: theme.spacing.sm,
      }}
    >
      {items.map((item) => {
        const isSelected = selected === item.key;
        const tint =
          item.accent === 'late'
            ? colors.error
            : item.accent === 'success'
              ? colors.success
              : item.accent === 'info'
                ? colors.info
                : item.accent === 'warning'
                  ? colors.warning
                  : item.accent === 'brand'
                    ? colors.brand
                    : colors.brand;
        const soft =
          item.accent === 'late'
            ? colors.errorSoft
            : item.accent === 'success'
              ? colors.successSoft
              : item.accent === 'info'
                ? colors.infoSoft
                : item.accent === 'warning'
                  ? colors.warningSoft
                  : colors.brandSoft;

        return (
          <AnimatedPressable
            key={item.key}
            variant="card"
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${item.label}: ${item.value}`}
            onPress={() => onSelect(item.key)}
            style={{
              flex: 1,
              minHeight: 96,
              borderRadius: theme.radius.lg,
              paddingTop: theme.spacing.md,
              paddingBottom: theme.spacing.md + 4,
              paddingHorizontal: theme.spacing.sm,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: isSelected ? soft : colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: isSelected ? tint : colors.borderStrong,
              overflow: 'hidden',
              ...(isSelected ? theme.elevation.rest : null),
            }}
          >
            {isSelected ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: 3,
                  backgroundColor: tint,
                }}
              />
            ) : null}
            <AppText
              variant="caption"
              align="center"
              numberOfLines={2}
              weight={
                isSelected
                  ? locale === 'ar'
                    ? 'medium'
                    : 'semibold'
                  : locale === 'ar'
                    ? 'regular'
                    : 'medium'
              }
              style={{
                color: isSelected ? tint : colors.textMuted,
                fontSize: 10,
                lineHeight: 13,
                letterSpacing: locale === 'ar' ? 0 : 0.35,
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
              }}
            >
              {item.label}
            </AppText>
            <CountUp
              value={item.value}
              variant="heading"
              color={isSelected || item.accent === 'late' ? tint : colors.textPrimary}
              accessibilityLabel={`${item.label}: ${item.value}`}
            />
          </AnimatedPressable>
        );
      })}
    </View>
  );
}
