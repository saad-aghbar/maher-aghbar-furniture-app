import type { Href } from 'expo-router';
import { Redirect } from 'expo-router';
import { ErrorState } from '@/components/feedback/ErrorState';
import { AppScreen } from '@/components/layout/AppScreen';
import { ProductionListSkeleton } from '@/features/production/components/ProductionSkeleton';
import { useLocale } from '@/i18n';
import { OrderProductionPlanEditorScreen } from './OrderProductionPlanEditorScreen';
import { useSalesOrderQuery } from './query';

/**
 * Canonical editable Production Plan host (Orders → Preparing).
 * In-place editor (workflow, BOM, stages, team). Post-release redirects to Production.
 */
export function OrderProductionPlanScreen({ salesOrderId }: { salesOrderId: string }) {
  const { t } = useLocale();
  const query = useSalesOrderQuery(salesOrderId, Boolean(salesOrderId));

  if (query.isLoading) {
    return (
      <AppScreen>
        <ProductionListSkeleton />
      </AppScreen>
    );
  }

  if (query.isError || !query.data) {
    return (
      <AppScreen>
        <ErrorState
          title={t('mobile.orders.errorTitle')}
          description={t('mobile.orders.errorBody')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  const order = query.data;
  const poId =
    order.productionReadinessSummary?.primaryProductionOrderId ??
    order.productionOrders?.[0]?.id ??
    null;
  const released = Boolean(
    order.releasedToFactory ??
      (order.productionOrders ?? []).some((po) => {
        const row = po as {
          releasedToFactoryAt?: string | null;
          actualStartDate?: string | null;
          status?: string;
        };
        return (
          Boolean(row.releasedToFactoryAt) ||
          Boolean(row.actualStartDate) ||
          [
            'IN_PROGRESS',
            'ON_HOLD',
            'QUALITY_CHECK',
            'READY_FOR_PACKAGING',
            'READY_FOR_DELIVERY',
            'COMPLETED',
          ].includes(String(row.status ?? '').toUpperCase())
        );
      }),
  );

  if (released && poId) {
    return <Redirect href={`/(app)/(admin)/production/${poId}` as Href} />;
  }

  if (!poId) {
    return (
      <Redirect
        href={`/(app)/(admin)/orders/${salesOrderId}/production-setup` as Href}
      />
    );
  }

  return (
    <OrderProductionPlanEditorScreen
      productionOrderId={poId}
      salesOrderId={salesOrderId}
    />
  );
}
