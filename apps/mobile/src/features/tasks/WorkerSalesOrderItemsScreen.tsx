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
import { useMyOrdersQuery } from './query';
import {
  findMySalesOrder,
  mySalesOrdersFromResponse,
  selectWorkerOrderCard,
} from './selectWorkerOrder';

function parseSegment(raw?: string): MyOrderSegment {
  if (raw === 'today' || raw === 'active') return raw;
  return 'open';
}

/**
 * Middle step: sales order items with variant labels, then the existing lane.
 */
export function WorkerSalesOrderItemsScreen() {
  const { salesOrderId, segment: segmentParam, q } = useLocalSearchParams<{
    salesOrderId?: string;
    segment?: string;
    q?: string;
  }>();
  const id = String(Array.isArray(salesOrderId) ? salesOrderId[0] : salesOrderId ?? '');
  const segment = parseSegment(
    Array.isArray(segmentParam) ? segmentParam[0] : segmentParam,
  );
  const needle = String(Array.isArray(q) ? q[0] : q ?? '');
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const onBack = useSmartBack('/(app)/(employee)/(tabs)/tasks' as Href);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const query = useMyOrdersQuery(segment, needle, Boolean(id));
  const group = findMySalesOrder(mySalesOrdersFromResponse(query.data), id);
  const items = (group?.items ?? []).map((item) => selectWorkerOrderCard(item, locale));

  if (query.isError && !query.data) {
    return (
      <AppScreen>
        <BackButton onPress={onBack} />
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
          <View style={{ marginBottom: theme.spacing.md, gap: theme.spacing.sm }}>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              <BackButton onPress={onBack} />
              <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
                  {t('mobile.tasks.orderItemsEyebrow')}
                </AppText>
                <AppText variant="largeTitle" weight={titleWeight}>
                  {t('mobile.tasks.orderItemsTitle')}
                </AppText>
                {group?.salesOrderNumber ? (
                  <AppText variant="bodySecondary" color="secondary" dir="ltr">
                    {group.salesOrderNumber}
                  </AppText>
                ) : null}
              </View>
            </View>
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
