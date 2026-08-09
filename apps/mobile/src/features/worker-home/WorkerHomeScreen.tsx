import { RefreshControl, View } from 'react-native';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { ScrollableScreen } from '@/components/layout/ScrollableScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { FadeIn } from '@/motion';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { TodayProgressCard } from './components/TodayProgressCard';
import { UpcomingTasksList } from './components/UpcomingTasksList';
import { WorkerCurrentTaskHero } from './components/WorkerCurrentTaskHero';
import { WorkerHomeHeader } from './components/WorkerHomeHeader';
import { WorkerHomeSkeleton } from './components/WorkerHomeSkeleton';
import { WorkerNotificationsPreview } from './components/WorkerNotificationsPreview';
import { useWorkerHomeQuery } from './query';
import {
  hasOpenTasks,
  isWorkerHomeEmpty,
  selectCurrentTask,
  selectTodayProgress,
  selectUpcomingTasks,
} from './selectWorkerHome';
import type { WorkerHomePayload } from './api';

type WorkerHomeScreenProps = {
  forceState?: 'loading' | 'error' | 'empty' | 'offline' | 'success';
  fixture?: WorkerHomePayload;
};

export function WorkerHomeScreen({ forceState, fixture }: WorkerHomeScreenProps = {}) {
  const { user } = useAuth();
  const { t } = useLocale();
  const { colors } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const allowed = can(user, 'production-task.read');
  const canNotify = can(user, 'notification.read');

  const query = useWorkerHomeQuery(allowed && !forceState);
  const refreshing = query.isRefetching && !query.isLoading;
  const displayName = user?.name ?? t('mobile.workerHome.fallbackName');

  if (forceState === 'loading' || (allowed && query.isLoading && !query.data && !forceState)) {
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

  if (forceState === 'error' || (query.isError && !query.data && !forceState)) {
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
          onRetry={() => void query.refetch()}
        />
      </ScrollableScreen>
    );
  }

  const data: WorkerHomePayload | undefined =
    forceState === 'success' || forceState === 'empty' || forceState === 'offline'
      ? fixture
      : query.data;

  if (!data) {
    return (
      <ScrollableScreen>
        <WorkerHomeSkeleton />
      </ScrollableScreen>
    );
  }

  const empty = forceState === 'empty' || isWorkerHomeEmpty(data);
  const currentTask = selectCurrentTask(data);
  const upcoming = selectUpcomingTasks(data);
  const progress = selectTodayProgress(data);

  return (
    <ScrollableScreen
      scrollProps={{
        refreshControl: forceState ? undefined : (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void query.refetch()}
            tintColor={colors.brand}
          />
        ),
      }}
    >
      {showOfflineBanner || forceState === 'offline' ? <OfflineBanner /> : null}
      <WorkerHomeHeader
        userName={displayName}
        unreadNotifications={data.unreadNotifications}
        canOpenNotifications={canNotify || Boolean(forceState)}
      />
      {empty ? (
        <FadeIn>
          <EmptyState
            title={t('mobile.workerHome.emptyTitle')}
            description={t('mobile.workerHome.emptyBody')}
          />
        </FadeIn>
      ) : (
        <View>
          {currentTask ? <WorkerCurrentTaskHero task={currentTask} /> : null}
          {!currentTask && !hasOpenTasks(data) ? (
            <EmptyState
              title={t('mobile.workerHome.emptyTitle')}
              description={t('mobile.workerHome.emptyBody')}
            />
          ) : null}
          <UpcomingTasksList tasks={upcoming} />
          <TodayProgressCard progress={progress} />
          <WorkerNotificationsPreview
            notifications={data.notifications}
            canOpenNotifications={canNotify || Boolean(forceState)}
          />
        </View>
      )}
    </ScrollableScreen>
  );
}
