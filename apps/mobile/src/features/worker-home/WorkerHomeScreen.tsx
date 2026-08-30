import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { can } from '@maher/permissions';
import { getTaskWipClaimRequirements } from '@/api/modules/tasks';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { ScrollableScreen } from '@/components/layout/ScrollableScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { DeliveryWorkerHomeScreen } from '@/features/delivery-load/DeliveryWorkerHomeScreen';
import { isDeliveryFloorWorker } from '@/features/delivery-load/isDeliveryFloorWorker';
import {
  flattenTasksPages,
  useTasksInfiniteQuery,
} from '@/features/tasks/query';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { TodayFloorBucketSection } from './components/TodayFloorBucketSection';
import { TodayProgressCard } from './components/TodayProgressCard';
import { WorkerHomeHeader } from './components/WorkerHomeHeader';
import { WorkerHomeSkeleton } from './components/WorkerHomeSkeleton';
import { WorkerNotificationsPreview } from './components/WorkerNotificationsPreview';
import { useWorkerHomeQuery } from './query';
import {
  allOpenTasks,
  mapTaskListItemToWorkerHomeTask,
  selectTodayFloorBuckets,
  selectTodayProgress,
  selectTodayProgressFromOpen,
  type WorkerHomeTaskWithFloor,
} from './selectWorkerHome';
import type { WorkerHomePayload } from './api';

type WorkerHomeScreenProps = {
  forceState?: 'loading' | 'error' | 'empty' | 'offline' | 'success';
  fixture?: WorkerHomePayload;
};

const OPEN_MINE_FILTERS = { scope: 'open' as const, mine: true as const };

export function WorkerHomeScreen({ forceState, fixture }: WorkerHomeScreenProps = {}) {
  const { user } = useAuth();
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { showOfflineBanner } = useNetwork();

  const isDelivery = !forceState && isDeliveryFloorWorker(user);
  const allowed = can(user, 'production-task.read');
  const canNotify = can(user, 'notification.read');
  const live = allowed && !forceState && !isDelivery;

  const homeQuery = useWorkerHomeQuery(live);
  /** Same open/mine queue as the Tasks tab — source of truth for Today buckets. */
  const tasksQuery = useTasksInfiniteQuery(OPEN_MINE_FILTERS, live);

  const refreshing =
    (homeQuery.isRefetching || tasksQuery.isRefetching) &&
    !homeQuery.isLoading &&
    !tasksQuery.isLoading;
  const displayName = user?.name ?? t('mobile.workerHome.fallbackName');

  const [receiveNeeds, setReceiveNeeds] = useState<Record<string, boolean>>({});

  const openFromTasks = useMemo(() => {
    return flattenTasksPages(tasksQuery.data)
      .filter((item) => item.stageDefinition?.code !== 'DELIVERY')
      .map((item) =>
        mapTaskListItemToWorkerHomeTask(item, {
          needsReceive: receiveNeeds[item.id] ?? item.needsWipReceive ?? null,
          phase: item.floorHint?.phase ?? null,
        }),
      );
  }, [tasksQuery.data, receiveNeeds]);

  // Light claim-requirements probe for open tasks that lack floorHint.
  useEffect(() => {
    if (!live) return;
    const candidates = flattenTasksPages(tasksQuery.data)
      .filter((item) => item.stageDefinition?.code !== 'DELIVERY')
      .filter((item) => {
        const st = String(item.status).toUpperCase();
        if (st === 'IN_PROGRESS' || st === 'PAUSED' || st === 'COMPLETED') return false;
        if (item.floorHint || item.needsWipReceive != null) return false;
        return true;
      })
      .slice(0, 12);

    if (candidates.length === 0) return;
    let cancelled = false;
    void (async () => {
      const next: Record<string, boolean> = {};
      await Promise.all(
        candidates.map(async (item) => {
          try {
            const req = await getTaskWipClaimRequirements(item.id);
            next[item.id] = Boolean(req.required) && !(req.allReceived ?? req.allClaimed);
          } catch {
            /* ignore — heuristics still apply */
          }
        }),
      );
      if (!cancelled && Object.keys(next).length > 0) {
        setReceiveNeeds((prev) => ({ ...prev, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [live, tasksQuery.data]);

  if (isDelivery) {
    return <DeliveryWorkerHomeScreen />;
  }

  if (forceState === 'loading' || (live && tasksQuery.isLoading && !tasksQuery.data)) {
    return (
      <ScrollableScreen>
        <WorkerHomeHeader
          userName={displayName}
          unreadNotifications={0}
          canOpenNotifications={canNotify}
        />
        <WorkerHomeSkeleton />
      </ScrollableScreen>
    );
  }

  if (!allowed && !forceState) {
    return (
      <ScrollableScreen>
        <WorkerHomeHeader
          userName={displayName}
          unreadNotifications={0}
          canOpenNotifications={canNotify}
        />
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </ScrollableScreen>
    );
  }

  if (
    forceState === 'error' ||
    (live && tasksQuery.isError && !tasksQuery.data)
  ) {
    return (
      <ScrollableScreen>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <WorkerHomeHeader
          userName={displayName}
          unreadNotifications={0}
          canOpenNotifications={canNotify}
        />
        <ErrorState
          title={t('mobile.workerHome.errorTitle')}
          description={t('mobile.workerHome.errorBody')}
          retryLabel={t('mobile.workerHome.retry')}
          onRetry={() => {
            void tasksQuery.refetch();
            void homeQuery.refetch();
          }}
        />
      </ScrollableScreen>
    );
  }

  const fixtureData: WorkerHomePayload | undefined =
    forceState === 'success' || forceState === 'empty' || forceState === 'offline'
      ? fixture
      : undefined;

  if (forceState && !fixtureData) {
    return (
      <ScrollableScreen>
        <WorkerHomeSkeleton />
      </ScrollableScreen>
    );
  }

  const homeData = fixtureData ?? homeQuery.data;

  const openTasks: WorkerHomeTaskWithFloor[] = fixtureData
    ? allOpenTasks(fixtureData).map((t) => ({ ...t }))
    : openFromTasks;

  const buckets = selectTodayFloorBuckets(openTasks);
  const progress = fixtureData
    ? selectTodayProgress(fixtureData)
    : selectTodayProgressFromOpen(openTasks, homeData?.completedTodayCount ?? 0);

  const notifications = homeData?.notifications ?? [];
  const unreadNotifications = homeData?.unreadNotifications ?? 0;
  const emptyToday =
    buckets.doNow.length === 0 &&
    buckets.readyAfterReceiving.length === 0 &&
    buckets.waiting.length === 0;

  return (
    <ScrollableScreen
      scrollProps={{
        refreshControl: forceState ? undefined : (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void tasksQuery.refetch();
              void homeQuery.refetch();
            }}
            tintColor={colors.brand}
          />
        ),
      }}
    >
      {showOfflineBanner || forceState === 'offline' ? <OfflineBanner /> : null}
      <WorkerHomeHeader
        userName={displayName}
        unreadNotifications={unreadNotifications}
        canOpenNotifications={canNotify || Boolean(forceState)}
      />
      <View>
        {emptyToday ? (
          <View
            style={{
              marginBottom: theme.spacing.lg,
              padding: theme.spacing.lg,
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surfaceSecondary,
              gap: theme.spacing.xs,
            }}
          >
            <AppText
              variant="caption"
              weight="semibold"
              style={{
                color: colors.brand,
                letterSpacing: locale === 'ar' ? 0 : 1.2,
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {t('mobile.tasks.todayBucketDoNow')}
            </AppText>
            <AppText variant="body" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('mobile.workerHome.emptyBody')}
            </AppText>
          </View>
        ) : (
          <>
            <TodayFloorBucketSection bucket="DO_NOW" tasks={buckets.doNow} />
            <TodayFloorBucketSection
              bucket="READY_AFTER_RECEIVING"
              tasks={buckets.readyAfterReceiving}
            />
            <TodayFloorBucketSection bucket="WAITING" tasks={buckets.waiting} />
          </>
        )}
        <TodayProgressCard progress={progress} />
        <AppText
            variant="caption"
            weight="semibold"
            style={{
              marginBottom: theme.spacing.md,
              textAlign: isRTL ? 'right' : 'left',
              paddingHorizontal: 2,
              color: colors.success,
              letterSpacing: locale === 'ar' ? 0 : 1,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
            }}
          >
            {t('mobile.tasks.todayBucketCompleted', {
              n: progress.completed,
            })}
          </AppText>
        <WorkerNotificationsPreview
          notifications={notifications}
          canOpenNotifications={canNotify || Boolean(forceState)}
        />
      </View>
    </ScrollableScreen>
  );
}
