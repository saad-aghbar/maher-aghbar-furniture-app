import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shouldFetchWorkerQueue } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { surfaceTabBarStackInset } from '@/navigation/tabBarClearance';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { TaskCard } from './components/TaskCard';
import {
  CompletedTasksFilters,
  completedFiltersToQuery,
  type CompletedFiltersState,
} from './components/CompletedTasksFilters';
import {
  TasksSegmentRail,
  type TasksSegment,
} from './components/TasksSegmentRail';
import { WorkerCompletedSalesOrderCard } from './components/WorkerCompletedSalesOrderCard';
import { WorkerSalesOrderCard } from './components/WorkerSalesOrderCard';
import { TasksListSkeleton } from './components/TasksListSkeleton';
import type { TaskListItem } from './api';
import {
  flattenTasksPages,
  useCompletedDealersQuery,
  useMyOrdersQuery,
  useTasksInfiniteQuery,
  type TasksListQueryFilters,
} from './query';
import {
  selectCompletedSalesOrderCards,
  selectTaskCard,
  sortUrgentFirst,
} from './selectTask';
import {
  mySalesOrdersFromResponse,
  selectWorkerSalesOrderCard,
  workerSalesOrderMatchesQuery,
} from './selectWorkerOrder';

export type TasksListVariant = 'open' | 'completed';

type TasksListScreenProps = {
  variant: TasksListVariant;
  forceState?: 'loading' | 'error' | 'empty' | 'offline' | 'success';
  fixture?: TaskListItem[];
};

const INITIAL_COMPLETED_FILTERS: CompletedFiltersState = {
  q: '',
  dealerId: null,
  dealerName: null,
  datePreset: 'all',
  customDate: '',
};

function orderSegment(segment: TasksSegment): 'open' | 'today' | 'active' {
  return segment;
}

/**
 * Worker floor queue — bubble filters on My Tasks; Completed tab is separate.
 */
export function TasksListScreen({ variant, forceState, fixture }: TasksListScreenProps) {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const insets = useSafeAreaInsets();
  const allowed = shouldFetchWorkerQueue(user);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const isCompleted = variant === 'completed';
  /** Same stack inset as admin inventory / order detail so the last card clears the pill. */
  const listBottomPad =
    theme.spacing['3xl'] +
    surfaceTabBarStackInset(insets.bottom, theme.spacing.sm) +
    theme.spacing['2xl'];

  const [segment, setSegment] = useState<TasksSegment>('open');
  const [searchInput, setSearchInput] = useState('');
  const [completedFilters, setCompletedFilters] = useState<CompletedFiltersState>(
    INITIAL_COMPLETED_FILTERS,
  );
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const debouncedCompletedQ = useDebouncedValue(completedFilters.q, 300);

  useEffect(() => {
    if (!isCompleted) setSegment('open');
  }, [isCompleted]);

  const dealersQuery = useCompletedDealersQuery(allowed && isCompleted && !forceState);

  const filters = useMemo<TasksListQueryFilters>(() => {
    if (!isCompleted) return { scope: 'open', mine: true };
    const extra = completedFiltersToQuery({
      ...completedFilters,
      q: debouncedCompletedQ,
    });
    return {
      scope: 'completed',
      mine: true,
      ...extra,
    };
  }, [isCompleted, segment, completedFilters, debouncedCompletedQ]);

  const query = useTasksInfiniteQuery(filters, allowed && !forceState && isCompleted);
  const showOrders = !isCompleted && !forceState;
  const hasOpenSearch = Boolean(debouncedSearch.trim());
  const ordersSegment = hasOpenSearch ? 'open' : orderSegment(segment);
  const ordersQuery = useMyOrdersQuery(ordersSegment, debouncedSearch, allowed && showOrders);

  /** Pull-to-refresh only — not segment / filter transitions. */
  const pullRefreshing =
    query.isRefetching && !query.isFetchingNextPage && !query.isPlaceholderData;

  /**
   * Filter/segment in flight while previous results still show
   * (keepPreviousData). Soft indicator — never swap the whole screen.
   */
  const isFilterUpdating =
    !forceState &&
    (showOrders
      ? ordersQuery.isFetching && Boolean(ordersQuery.data)
      : query.isFetching && !query.isFetchingNextPage && Boolean(query.data));

  const [animateEnter, setAnimateEnter] = useState(true);
  useEffect(() => {
    if (!animateEnter) return;
    const fetched = showOrders ? ordersQuery.isFetched : query.isFetched;
    const placeholder = showOrders ? ordersQuery.isPlaceholderData : query.isPlaceholderData;
    if (!fetched || placeholder) return;
    const id = setTimeout(() => setAnimateEnter(false), 520);
    return () => clearTimeout(id);
  }, [
    animateEnter,
    showOrders,
    ordersQuery.isFetched,
    ordersQuery.isPlaceholderData,
    query.isFetched,
    query.isPlaceholderData,
  ]);

  const liveItems = flattenTasksPages(query.data)
    .filter((item) => item.stageDefinition?.code !== 'DELIVERY')
    .map((item) => selectTaskCard(item, locale));
  const fixtureItems = (fixture ?? [])
    .filter((item) => item.stageDefinition?.code !== 'DELIVERY')
    .map((item) => selectTaskCard(item, locale));

  const items =
    forceState === 'success' || forceState === 'empty' || forceState === 'offline'
      ? forceState === 'empty'
        ? []
        : sortUrgentFirst(fixtureItems)
      : sortUrgentFirst(liveItems);

  const completedSource =
    forceState === 'success' || forceState === 'empty' || forceState === 'offline'
      ? forceState === 'empty'
        ? []
        : (fixture ?? []).filter((item) => item.stageDefinition?.code !== 'DELIVERY')
      : flattenTasksPages(query.data).filter(
          (item) => item.stageDefinition?.code !== 'DELIVERY',
        );

  const completedOrderCards = isCompleted
    ? selectCompletedSalesOrderCards(completedSource, locale)
    : [];

  const orderCards = mySalesOrdersFromResponse(ordersQuery.data)
    .filter((row) => workerSalesOrderMatchesQuery(row, debouncedSearch))
    .map((row) => selectWorkerSalesOrderCard(row, locale));

  const subtitleKey = isCompleted
    ? 'mobile.tasks.subtitleDone'
    : segment === 'today'
      ? 'mobile.tasks.subtitleToday'
      : segment === 'active'
        ? 'mobile.tasks.subtitleActive'
        : 'mobile.tasks.openOrdersSubtitle';

  const showingLabel = isCompleted
    ? t('mobile.tasks.segments.done')
    : t(`mobile.tasks.segments.${segment}`);

  const hasCompletedFilter =
    Boolean(debouncedCompletedQ.trim()) ||
    Boolean(completedFilters.dealerId) ||
    completedFilters.datePreset !== 'all';

  const emptyTitle = isCompleted
    ? hasCompletedFilter
      ? t('mobile.tasks.emptyCompletedFilteredTitle')
      : t('mobile.tasks.emptyCompletedTitle')
    : hasOpenSearch
      ? t('mobile.tasks.emptySearchTitle')
      : segment === 'today'
        ? t('mobile.tasks.emptyTodayTitle')
        : segment === 'active'
          ? t('mobile.tasks.emptyActiveTitle')
          : t('mobile.tasks.emptyOrdersTitle');
  const emptyBody = isCompleted
    ? hasCompletedFilter
      ? t('mobile.tasks.emptyCompletedFilteredBody')
      : t('mobile.tasks.emptyCompletedBody')
    : hasOpenSearch
      ? t('mobile.tasks.emptySearchBody')
      : segment === 'today'
        ? t('mobile.tasks.emptyTodayBody')
        : segment === 'active'
          ? t('mobile.tasks.emptyActiveBody')
          : t('mobile.tasks.emptyOrdersBody');

  /** True first visit only — never when swapping filters. */
  const isInitialLoading =
    forceState === 'loading' ||
    (allowed &&
      !forceState &&
      (showOrders
        ? ordersQuery.isPending && !ordersQuery.data
        : query.isPending && !query.data && !query.isPlaceholderData));

  const header = useMemo(
    () => (
      <View style={{ marginBottom: theme.spacing.md, gap: theme.spacing.md }}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            overflow: 'hidden',
            ...orderBoardShadow(colorScheme),
          }}
        >
          <View style={{ height: 3, backgroundColor: colors.brand, opacity: 0.35 }} />
          <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
            <View
              style={{
                gap: 4,
                alignItems: isRTL ? 'flex-end' : 'flex-start',
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                style={{ color: colors.brand }}
              >
                {t(isCompleted ? 'mobile.tasks.completedEyebrow' : 'mobile.tasks.floorEyebrow')}
              </AppText>
              <AppText variant="largeTitle" weight={titleWeight}>
                {t(isCompleted ? 'mobile.tasks.completedTitle' : 'mobile.tasks.title')}
              </AppText>
              <AppText variant="bodySecondary" color="secondary" align="start">
                {t(subtitleKey)}
              </AppText>
            </View>

            {isCompleted ? (
              <CompletedTasksFilters
                value={completedFilters}
                onChange={setCompletedFilters}
                dealers={dealersQuery.data?.data ?? []}
                dealersLoading={dealersQuery.isPending && !dealersQuery.data}
              />
            ) : (
              <>
                <TextField
                  value={searchInput}
                  onChangeText={setSearchInput}
                  placeholder={t('mobile.tasks.searchPlaceholder')}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                  pill
                />
                <TasksSegmentRail value={segment} onChange={setSegment} />
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                    paddingHorizontal: theme.spacing.sm,
                    paddingVertical: theme.spacing.sm,
                    borderRadius: theme.radius.lg,
                    backgroundColor: colors.surfaceSecondary,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: colors.brand,
                    }}
                  />
                  <AppText variant="caption" color="secondary" style={{ flex: 1 }}>
                    {t('mobile.tasks.showingFilter', { filter: showingLabel })}
                  </AppText>
                  {isFilterUpdating ? (
                    <ActivityIndicator size="small" color={colors.brand} />
                  ) : null}
                </View>
              </>
            )}

            {isCompleted && isFilterUpdating ? (
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                }}
              >
                <ActivityIndicator size="small" color={colors.brand} />
                <AppText variant="caption" color="muted">
                  {t('mobile.tasks.updatingList')}
                </AppText>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    ),
    [
      colors,
      colorScheme,
      completedFilters,
      dealersQuery.data?.data,
      dealersQuery.isPending,
      dealersQuery.data,
      isCompleted,
      isFilterUpdating,
      isRTL,
      locale,
      searchInput,
      segment,
      showingLabel,
      subtitleKey,
      t,
      theme,
      titleWeight,
    ],
  );

  if (isInitialLoading) {
    return (
      <AppScreen edges={{ top: true, bottom: false }}>
        {header}
        <TasksListSkeleton />
      </AppScreen>
    );
  }

  if (!allowed && !forceState) {
    return (
      <AppScreen>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (
    forceState === 'error' ||
    (!forceState &&
      (showOrders ? ordersQuery.isError && !ordersQuery.data : query.isError && !query.data))
  ) {
    return (
      <AppScreen edges={{ top: true, bottom: false }}>
        {showOfflineBanner ? <OfflineBanner /> : null}
        {header}
        <ErrorState
          title={t('mobile.tasks.errorTitle')}
          description={t('mobile.tasks.errorBody')}
          retryLabel={t('mobile.tasks.retry')}
          onRetry={() => void (showOrders ? ordersQuery.refetch() : query.refetch())}
        />
      </AppScreen>
    );
  }

  if (forceState === 'offline') {
    return (
      <AppScreen edges={{ top: true, bottom: false }}>
        <OfflineBanner />
        {header}
        <ErrorState
          title={t('mobile.tasks.offlineTitle')}
          description={t('mobile.tasks.offlineBody')}
          retryLabel={t('mobile.tasks.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen edges={{ top: true, bottom: false }}>
      {showOfflineBanner ? <OfflineBanner /> : null}
      {showOrders ? (
        <FlatList
          data={orderCards}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingBottom: listBottomPad,
            flexGrow: 1,
          }}
          style={{ flex: 1, opacity: isFilterUpdating ? 0.72 : 1 }}
          refreshControl={
            <RefreshControl
              refreshing={Boolean(ordersQuery.isRefetching)}
              onRefresh={() => void ordersQuery.refetch()}
              tintColor={colors.brand}
            />
          }
          ListHeaderComponent={header}
          renderItem={({ item, index }) => (
            <WorkerSalesOrderCard
              order={item}
              segment={ordersSegment}
              q={debouncedSearch}
              index={index}
              animateEnter={animateEnter}
            />
          )}
          ListEmptyComponent={
            isFilterUpdating ? (
              <View style={{ paddingVertical: theme.spacing.xl, alignItems: 'center' }}>
                <ActivityIndicator color={colors.brand} />
              </View>
            ) : (
              <EmptyState title={emptyTitle} description={emptyBody} />
            )
          }
          extraData={`${segment}:${debouncedSearch}:${animateEnter}:${isFilterUpdating}`}
          keyboardShouldPersistTaps="handled"
        />
      ) : isCompleted ? (
        <FlatList
          data={completedOrderCards}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingBottom: listBottomPad,
            flexGrow: 1,
          }}
          style={{ flex: 1, opacity: isFilterUpdating ? 0.72 : 1 }}
          refreshControl={
            <RefreshControl
              refreshing={Boolean(pullRefreshing)}
              onRefresh={() => void query.refetch()}
              tintColor={colors.brand}
            />
          }
          ListHeaderComponent={header}
          renderItem={({ item, index }) => (
            <WorkerCompletedSalesOrderCard
              order={item}
              q={debouncedCompletedQ}
              index={index}
              animateEnter={animateEnter}
            />
          )}
          ListEmptyComponent={
            isFilterUpdating ? (
              <View style={{ paddingVertical: theme.spacing.xl, alignItems: 'center' }}>
                <ActivityIndicator color={colors.brand} />
              </View>
            ) : (
              <EmptyState title={emptyTitle} description={emptyBody} />
            )
          }
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) {
              void query.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.4}
          extraData={`done:${animateEnter}:${isFilterUpdating}`}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingBottom: listBottomPad,
            flexGrow: 1,
          }}
          style={{ flex: 1, opacity: isFilterUpdating ? 0.72 : 1 }}
          refreshControl={
            <RefreshControl
              refreshing={Boolean(pullRefreshing)}
              onRefresh={() => void query.refetch()}
              tintColor={colors.brand}
            />
          }
          ListHeaderComponent={header}
          renderItem={({ item, index }) => (
            <TaskCard
              task={item}
              index={index}
              completed={false}
              animateEnter={animateEnter}
            />
          )}
          ListEmptyComponent={
            isFilterUpdating ? (
              <View style={{ paddingVertical: theme.spacing.xl, alignItems: 'center' }}>
                <ActivityIndicator color={colors.brand} />
              </View>
            ) : (
              <EmptyState title={emptyTitle} description={emptyBody} />
            )
          }
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) {
              void query.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.4}
          extraData={`${segment}:${animateEnter}:${isFilterUpdating}`}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </AppScreen>
  );
}
