import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
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
import { TasksListSkeleton } from './components/TasksListSkeleton';
import type { TaskListItem } from './api';
import {
  flattenTasksPages,
  useCompletedDealersQuery,
  useTasksInfiniteQuery,
  type TasksListQueryFilters,
} from './query';
import { selectTaskCard, sortUrgentFirst } from './selectTask';

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

function filtersForSegment(segment: TasksSegment): TasksListQueryFilters {
  switch (segment) {
    case 'today':
      return { scope: 'open', dueToday: true, mine: true };
    case 'active':
      return { status: 'IN_PROGRESS', mine: true };
    case 'open':
    default:
      return { scope: 'open', mine: true };
  }
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
  const allowed = can(user, 'production-task.read');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const isCompleted = variant === 'completed';
  /** Same stack inset as admin inventory / order detail so the last card clears the pill. */
  const listBottomPad =
    theme.spacing['3xl'] +
    surfaceTabBarStackInset(insets.bottom, theme.spacing.sm) +
    theme.spacing['2xl'];

  const [segment, setSegment] = useState<TasksSegment>('open');
  const [completedFilters, setCompletedFilters] = useState<CompletedFiltersState>(
    INITIAL_COMPLETED_FILTERS,
  );
  const debouncedCompletedQ = useDebouncedValue(completedFilters.q, 300);

  useEffect(() => {
    if (!isCompleted) setSegment('open');
  }, [isCompleted]);

  const dealersQuery = useCompletedDealersQuery(allowed && isCompleted && !forceState);

  const filters = useMemo<TasksListQueryFilters>(() => {
    if (!isCompleted) return filtersForSegment(segment);
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

  const query = useTasksInfiniteQuery(filters, allowed && !forceState);

  /** Pull-to-refresh only — not segment / filter transitions. */
  const pullRefreshing =
    query.isRefetching && !query.isFetchingNextPage && !query.isPlaceholderData;

  /**
   * Filter/segment in flight while previous results still show
   * (keepPreviousData). Soft indicator — never swap the whole screen.
   */
  const isFilterUpdating =
    !forceState &&
    query.isFetching &&
    !query.isFetchingNextPage &&
    Boolean(query.data);

  const [animateEnter, setAnimateEnter] = useState(true);
  useEffect(() => {
    if (!animateEnter) return;
    if (!query.isFetched || query.isPlaceholderData) return;
    const id = setTimeout(() => setAnimateEnter(false), 520);
    return () => clearTimeout(id);
  }, [animateEnter, query.isFetched, query.isPlaceholderData]);

  const liveItems = flattenTasksPages(query.data).map((item) =>
    selectTaskCard(item, locale),
  );
  const fixtureItems = (fixture ?? []).map((item) => selectTaskCard(item, locale));

  const items =
    forceState === 'success' || forceState === 'empty' || forceState === 'offline'
      ? forceState === 'empty'
        ? []
        : sortUrgentFirst(fixtureItems)
      : sortUrgentFirst(liveItems);

  const subtitleKey = isCompleted
    ? 'mobile.tasks.subtitleDone'
    : segment === 'today'
      ? 'mobile.tasks.subtitleToday'
      : segment === 'active'
        ? 'mobile.tasks.subtitleActive'
        : 'mobile.tasks.subtitleOpen';

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
    : segment === 'today'
      ? t('mobile.tasks.emptyTodayTitle')
      : segment === 'active'
        ? t('mobile.tasks.emptyActiveTitle')
        : t('mobile.tasks.emptyTitle');
  const emptyBody = isCompleted
    ? hasCompletedFilter
      ? t('mobile.tasks.emptyCompletedFilteredBody')
      : t('mobile.tasks.emptyCompletedBody')
    : segment === 'today'
      ? t('mobile.tasks.emptyTodayBody')
      : segment === 'active'
        ? t('mobile.tasks.emptyActiveBody')
        : t('mobile.tasks.emptyBody');

  /** True first visit only — never when swapping filters. */
  const isInitialLoading =
    forceState === 'loading' ||
    (allowed &&
      !forceState &&
      query.isPending &&
      !query.data &&
      !query.isPlaceholderData);

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

  if (forceState === 'error' || (query.isError && !query.data && !forceState)) {
    return (
      <AppScreen edges={{ top: true, bottom: false }}>
        {showOfflineBanner ? <OfflineBanner /> : null}
        {header}
        <ErrorState
          title={t('mobile.tasks.errorTitle')}
          description={t('mobile.tasks.errorBody')}
          retryLabel={t('mobile.tasks.retry')}
          onRetry={() => void query.refetch()}
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
            completed={isCompleted}
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
        extraData={`${isCompleted ? 'done' : segment}:${animateEnter}:${isFilterUpdating}`}
        keyboardShouldPersistTaps="handled"
      />
    </AppScreen>
  );
}
