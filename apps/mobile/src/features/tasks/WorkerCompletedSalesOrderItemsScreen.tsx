import { FlatList, RefreshControl, View } from 'react-native';
import { useLocalSearchParams, type Href } from 'expo-router';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { AppScreen } from '@/components/layout/AppScreen';
import { useLocale } from '@/i18n';
import { useSmartBack } from '@/navigation/useSmartBack';
import { useTheme } from '@/theme';
import { TaskCard } from './components/TaskCard';
import { WorkerSalesOrderIdentityBoard } from './components/WorkerSalesOrderIdentityBoard';
import { flattenTasksPages, useTasksInfiniteQuery } from './query';
import {
  completedTaskMatchesSalesOrder,
  selectCompletedSalesOrderCards,
  selectTaskCard,
} from './selectTask';

type Props = {
  salesOrderId?: string;
  embedded?: boolean;
  number?: string;
  q?: string;
};

/**
 * Middle step for finished work: tall order photo identity, then task cards.
 * On the worker desk this mounts in the side pane (`embedded`).
 */
export function WorkerCompletedSalesOrderItemsScreen({
  salesOrderId: salesOrderIdProp,
  embedded = false,
  number: numberProp,
  q: qProp,
}: Props = {}) {
  const params = useLocalSearchParams<{
    salesOrderId?: string;
    number?: string;
    q?: string;
  }>();
  const id = String(
    salesOrderIdProp ||
      (Array.isArray(params.salesOrderId) ? params.salesOrderId[0] : params.salesOrderId) ||
      '',
  );
  const orderNumber = String(
    numberProp ??
      (Array.isArray(params.number) ? params.number[0] : params.number) ??
      '',
  );
  const needle = String(
    qProp ?? (Array.isArray(params.q) ? params.q[0] : params.q) ?? '',
  );
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const onBack = useSmartBack('/(app)/(employee)/(tabs)/completed' as Href);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const query = useTasksInfiniteQuery(
    {
      scope: 'completed',
      mine: true,
      ...(needle ? { q: needle } : orderNumber ? { q: orderNumber } : {}),
    },
    Boolean(id),
  );

  const matchingRows = flattenTasksPages(query.data).filter((item) => {
    if (item.stageDefinition?.code === 'DELIVERY') return false;
    return completedTaskMatchesSalesOrder(
      selectTaskCard(item, locale),
      id,
      orderNumber || undefined,
    );
  });

  const group = selectCompletedSalesOrderCards(matchingRows, locale)[0] ?? null;
  const tasks = group?.tasks ?? matchingRows.map((item) => selectTaskCard(item, locale));

  if (query.isError && !query.data) {
    return (
      <AppScreen>
        {embedded ? null : <BackButton onPress={onBack} />}
        <ErrorState
          title={t('mobile.tasks.errorTitle')}
          description={t('mobile.tasks.errorBody')}
          retryLabel={t('mobile.tasks.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen edges={{ top: true, bottom: true }}>
      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingBottom: theme.spacing['3xl'],
          flexGrow: 1,
        }}
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={Boolean(query.isRefetching)}
            onRefresh={() => void query.refetch()}
            tintColor={colors.brand}
          />
        }
        ListHeaderComponent={
          <View style={{ marginBottom: theme.spacing.md, gap: theme.spacing.md }}>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              {embedded ? null : <BackButton onPress={onBack} />}
              <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
                  {t('mobile.tasks.orderItemsEyebrow')}
                </AppText>
                <AppText variant={embedded ? 'title' : 'largeTitle'} weight={titleWeight}>
                  {t('mobile.tasks.orderItemsTitle')}
                </AppText>
                {group?.number || orderNumber ? (
                  <AppText variant="bodySecondary" color="secondary" dir="ltr">
                    {group?.number || orderNumber}
                  </AppText>
                ) : null}
              </View>
            </View>

            {group ? (
              <WorkerSalesOrderIdentityBoard
                completed
                orderNumber={group.number}
                imageUrl={group.imageUrl}
                priority={group.priority}
                deadline={group.deadline}
                itemCount={group.taskCount}
                myTaskCount={group.taskCount}
                blockedCount={0}
              />
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => (
          <TaskCard task={item} index={index} completed animateEnter={false} />
        )}
        ListEmptyComponent={
          query.isPending ? null : (
            <EmptyState
              title={t('mobile.tasks.emptyCompletedTitle')}
              description={t('mobile.tasks.emptyCompletedBody')}
            />
          )
        }
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) {
            void query.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
      />
    </AppScreen>
  );
}
