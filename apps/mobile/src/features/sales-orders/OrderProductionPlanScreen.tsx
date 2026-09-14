import { useEffect, useRef, useState } from 'react';
import type { Href } from 'expo-router';
import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { can } from '@maher/permissions';
import { ApiError } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { ErrorState } from '@/components/feedback/ErrorState';
import { AppScreen } from '@/components/layout/AppScreen';
import { ProductionListSkeleton } from '@/features/production/components/ProductionSkeleton';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { OrderProductionPlanEditorScreen } from './OrderProductionPlanEditorScreen';
import { OrderProductionPlanItemBoard } from './OrderProductionPlanItemBoard';
import {
  useOrderProductionSetupActions,
  useOrderProductionSetupQuery,
} from './production-setup/query';
import { productionOrderIdForLineId } from './productionOrderIdForLine';
import { useSalesOrderQuery } from './query';

/**
 * Preparing Production Plan host.
 * No lineId → SO item board. With lineId → existing per-line editor.
 */
export function OrderProductionPlanScreen({
  salesOrderId,
  lineId,
}: {
  salesOrderId: string;
  lineId?: string;
}) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const query = useSalesOrderQuery(salesOrderId, Boolean(salesOrderId));
  const setupQuery = useOrderProductionSetupQuery(salesOrderId, Boolean(salesOrderId));
  const canEditSetup = can(user, 'production.setup.edit');
  const actions = useOrderProductionSetupActions(salesOrderId);
  const [bootError, setBootError] = useState<string | null>(null);
  const [booting, setBooting] = useState(false);
  const [ensuredPoId, setEnsuredPoId] = useState<string | null>(null);
  const attempted = useRef(false);

  const order = query.data;
  const mappedPoId = lineId
    ? productionOrderIdForLineId({
        lineId,
        productionOrders: order?.productionOrders,
        setupLines: setupQuery.data?.lines ?? order?.productionSetup?.lines,
        fallbackId:
          order?.productionReadinessSummary?.primaryProductionOrderId ??
          order?.productionOrders?.[0]?.id ??
          null,
      })
    : null;
  const poId = ensuredPoId ?? mappedPoId;
  const released = (order?.productionOrders ?? []).some((po) => {
    const row = po as { releasedToFactoryAt?: string | null };
    return Boolean(row.releasedToFactoryAt);
  });
  const hasSetupLines = Boolean(
    (setupQuery.data?.lines ?? order?.productionSetup?.lines ?? []).length,
  );

  useEffect(() => {
    if (!order || released || attempted.current || booting) return;
    if (lineId && poId) return;
    if (!lineId && hasSetupLines) return;
    if (!canEditSetup) {
      if (lineId) setBootError(t('mobile.orders.journey.planNeedsPo'));
      return;
    }

    attempted.current = true;
    setBooting(true);
    setBootError(null);

    void (async () => {
      try {
        const result = await actions.ensurePlan.mutateAsync(undefined);
        const refreshed = await query.refetch();
        await setupQuery.refetch();
        if (!lineId) return;
        const id = productionOrderIdForLineId({
          lineId,
          productionOrders: refreshed.data?.productionOrders,
          setupLines:
            refreshed.data?.productionSetup?.lines ?? order?.productionSetup?.lines,
          fallbackId: result.primaryProductionOrderId ?? result.productionOrderIds[0] ?? null,
        });
        if (!id) {
          setBootError(t('mobile.orders.journey.planNeedsPo'));
          return;
        }
        setEnsuredPoId(id);
      } catch (err) {
        const message =
          err instanceof ApiError && err.message
            ? err.message
            : t('mobile.productionSetup.actionFailed');
        setBootError(message);
      } finally {
        setBooting(false);
      }
    })();
  }, [
    order,
    poId,
    released,
    canEditSetup,
    actions.ensurePlan,
    query,
    setupQuery,
    booting,
    lineId,
    hasSetupLines,
    t,
  ]);

  if (query.isLoading) {
    return (
      <AppScreen>
        <ProductionListSkeleton />
      </AppScreen>
    );
  }

  if (query.isError || !order) {
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

  if (!lineId) {
    const setupLines = setupQuery.data?.lines ?? [];
    if (booting || (!bootError && canEditSetup && !attempted.current && !hasSetupLines)) {
      return (
        <AppScreen edges={{ top: true, bottom: false }} style={{ paddingHorizontal: 0 }}>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.sm,
            }}
          >
            <BackButton onPress={() => router.back()} />
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <ActivityIndicator color={colors.brand} />
            <AppText variant="caption" color="muted">
              {t('mobile.orders.journey.openingPlan')}
            </AppText>
          </View>
        </AppScreen>
      );
    }
    if (setupLines.length) {
      return (
        <OrderProductionPlanItemBoard
          salesOrderId={salesOrderId}
          lines={setupLines}
          orderNumber={setupQuery.data?.salesOrder.number ?? order.number}
          dealer={setupQuery.data?.salesOrder.customer ?? order.customer}
          progress={setupQuery.data?.progress}
        />
      );
    }
  }

  if (released && poId) {
    return <Redirect href={`/(app)/(admin)/production/${poId}` as Href} />;
  }

  if (lineId && poId) {
    return (
      <OrderProductionPlanEditorScreen
        productionOrderId={poId}
        salesOrderId={salesOrderId}
      />
    );
  }

  if (booting || (!bootError && canEditSetup && !attempted.current)) {
    return (
      <AppScreen edges={{ top: true, bottom: false }} style={{ paddingHorizontal: 0 }}>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.sm,
          }}
        >
          <BackButton onPress={() => router.back()} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator color={colors.brand} />
          <AppText variant="caption" color="muted">
            {t('mobile.orders.journey.openingPlan')}
          </AppText>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.sm,
        }}
      >
        <BackButton onPress={() => router.back()} />
      </View>
      <ErrorState
        title={t('mobile.productionSetup.planTitle')}
        description={bootError ?? t('mobile.orders.journey.planNeedsPo')}
        retryLabel={t('mobile.orderDetail.retry')}
        onRetry={() => {
          attempted.current = false;
          setBootError(null);
          setEnsuredPoId(null);
          void query.refetch();
        }}
      />
    </AppScreen>
  );
}
