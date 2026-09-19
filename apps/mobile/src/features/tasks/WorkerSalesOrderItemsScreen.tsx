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
import type { MyOrderSegment } from './api';
import { WorkerOrderCard } from './components/WorkerOrderCard';
import { WorkerSalesOrderIdentityBoard } from './components/WorkerSalesOrderIdentityBoard';
import { useMyOrdersQuery } from './query';
import {
  findMySalesOrder,
  mySalesOrdersFromResponse,
  selectWorkerOrderCard,
  selectWorkerSalesOrderCard,
} from './selectWorkerOrder';

function parseSegment(raw?: string): MyOrderSegment {
  if (raw === 'today' || raw === 'active') return raw;
  return 'open';
}

type Props = {
  salesOrderId?: string;
  embedded?: boolean;
  segment?: string;
  q?: string;
};

/**
 * Middle step: sales order items with variant labels, then the existing lane.
 * On the worker desk this mounts in the side pane (`embedded`); compact still
 * uses the stack route.
 */
export function WorkerSalesOrderItemsScreen({
  salesOrderId: salesOrderIdProp,
  embedded = false,
  segment: segmentProp,
  q: qProp,
}: Props = {}) {
  const params = useLocalSearchParams<{
    salesOrderId?: string;
    segment?: string;
    q?: string;
  }>();
  const id = String(
    salesOrderIdProp ||
      (Array.isArray(params.salesOrderId) ? params.salesOrderId[0] : params.salesOrderId) ||
      '',
  );
  const segment = parseSegment(
    segmentProp || (Array.isArray(params.segment) ? params.segment[0] : params.segment),
  );
  const needle = String(
    qProp ?? (Array.isArray(params.q) ? params.q[0] : params.q) ?? '',
  );
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const onBack = useSmartBack('/(app)/(employee)/(tabs)/tasks' as Href);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const query = useMyOrdersQuery(segment, needle, Boolean(id));
  const group = findMySalesOrder(mySalesOrdersFromResponse(query.data), id);
  const salesOrder = group ? selectWorkerSalesOrderCard(group, locale) : null;
  const items = (group?.items ?? []).map((item) => selectWorkerOrderCard(item, locale));

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
        data={items}
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
                {salesOrder?.number ? (
                  <AppText variant="bodySecondary" color="secondary" dir="ltr">
                    {salesOrder.number}
                  </AppText>
                ) : null}
              </View>
            </View>

            {salesOrder ? (
              <WorkerSalesOrderIdentityBoard
                orderNumber={salesOrder.number}
                imageUrl={salesOrder.imageUrl}
                priority={salesOrder.priority}
                deadline={salesOrder.deadline}
                itemCount={salesOrder.itemCount}
                myTaskCount={salesOrder.myTaskCount}
                blockedCount={salesOrder.blockedCount}
                factoryOrderNumber={salesOrder.factoryOrderNumber}
              />
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => (
          <WorkerOrderCard order={item} index={index} animateEnter={false} />
        )}
        ListEmptyComponent={
          query.isPending ? null : (
            <EmptyState
              title={t('mobile.tasks.emptyOrdersTitle')}
              description={t('mobile.tasks.emptyOrdersBody')}
            />
          )
        }
      />
    </AppScreen>
  );
}
