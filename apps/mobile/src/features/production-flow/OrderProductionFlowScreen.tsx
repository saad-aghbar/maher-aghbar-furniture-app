import { useMemo } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/AppText';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { useSalesOrderQuery } from '@/features/sales-orders/query';
import { useLocale } from '@/i18n';
import { ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import { OrderFlowItemCard } from './components/OrderFlowItemCard';
import { ProductionFlowScreen } from './ProductionFlowScreen';
import {
  adminOrderFlowHref,
  dealerOrderFlowHref,
} from './flowRoutes';
import type { ProductionFlowRole } from './selectProductionFlow';
import { useTabBarReserve } from '@/adaptive/useSurfaceClearance';
import {
  selectOrderFlowItems,
  shouldSkipOrderFlowList,
} from './selectOrderFlowItems';

type Props = {
  role: ProductionFlowRole;
  salesOrderId: string;
  selectedProductionOrderId?: string | null;
  orderBackFallback: Href;
};

/**
 * Items-first production flow: always list each PO, then open one workflow.
 */
export function OrderProductionFlowScreen({
  role,
  salesOrderId,
  selectedProductionOrderId,
  orderBackFallback,
}: Props) {
  const { t, locale } = useLocale();
  const { theme } = useTheme();
  const tabBarReserve = useTabBarReserve();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const query = useSalesOrderQuery(salesOrderId, Boolean(salesOrderId));
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const listHref =
    role === 'admin' ? adminOrderFlowHref(salesOrderId) : dealerOrderFlowHref(salesOrderId);

  const items = useMemo(
    () => selectOrderFlowItems(query.data, locale),
    [locale, query.data],
  );

  const skipList = !selectedProductionOrderId && shouldSkipOrderFlowList(items);
  const targetPoId = selectedProductionOrderId || (skipList ? items[0]?.productionOrderId : null);

  if (targetPoId) {
    return (
      <ProductionFlowScreen
        role={role}
        source="production-order"
        id={targetPoId}
        backFallback={selectedProductionOrderId ? listHref : orderBackFallback}
      />
    );
  }

  if (query.isLoading && !query.data) {
    return (
      <AppScreen backFallback={orderBackFallback}>
        <AppText variant="largeTitle" weight={titleWeight} align="center">
          {t('mobile.productionFlow.orderItems')}
        </AppText>
        <AppText variant="body" color="secondary">
          {t('mobile.productionFlow.loading')}
        </AppText>
      </AppScreen>
    );
  }

  if (query.isError && !query.data) {
    return (
      <AppScreen backFallback={orderBackFallback}>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ErrorState
          title={t('mobile.productionFlow.errorTitle')}
          description={t('mobile.productionFlow.errorBody')}
          retryLabel={t('mobile.productionFlow.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen backFallback={orderBackFallback}>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          gap: theme.spacing.lg,
          paddingBottom: theme.spacing['3xl'] + tabBarReserve,
        }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
          />
        }
      >
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="largeTitle" weight={titleWeight} align="center">
            {t('mobile.productionFlow.orderItems')}
          </AppText>
          {query.data?.number ? (
            <AppText variant="caption" color="muted" align="center" dir="ltr">
              {query.data.number}
            </AppText>
          ) : null}
        </View>

        {items.length === 0 ? (
          <DealerEmptyPanel
            icon="git-network-outline"
            text={t('mobile.productionFlow.emptyItemsBody')}
          />
        ) : (
          items.map((item, index) => (
            <ListItemEnter key={item.productionOrderId} index={index}>
              <OrderFlowItemCard
                item={item}
                onPress={() => {
                  router.push(
                    role === 'admin'
                      ? adminOrderFlowHref(salesOrderId, item.productionOrderId)
                      : dealerOrderFlowHref(salesOrderId, item.productionOrderId),
                  );
                }}
              />
            </ListItemEnter>
          ))
        )}
      </ScrollView>
    </AppScreen>
  );
}
