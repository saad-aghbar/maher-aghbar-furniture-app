import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { AppScreen } from '@/components/layout/AppScreen';
import { ProductThumb } from '@/components/desk/ProductThumb';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { ProductionFlowMap } from '@/features/production-flow/components/ProductionFlowMap';
import type { ProductionFlowStage } from '@/features/production-flow/selectProductionFlow';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useSmartBack } from '@/navigation/useSmartBack';
import { useTheme } from '@/theme';
import { useMyOrderWorkflowQuery } from './query';
import { isLaneTaskOpenable, lockReasonText, selectWorkerOrderCard } from './selectWorkerOrder';
import {
  findLaneNodeByGraphKey,
  localizedLaneStageName,
  selectNextStationHint,
  workerLaneToFlowStages,
} from './selectWorkerLane';
import type { WorkerOrderLaneNode } from './api';

type Props = {
  productionOrderId: string;
};

function hintText(
  node: WorkerOrderLaneNode,
  locale: 'en' | 'ar' | 'he',
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const name = localizedLaneStageName(node, locale);
  if (isLaneTaskOpenable(node)) {
    return t('mobile.tasks.nextYouCanWork', { stage: name });
  }
  if (node.lockState.kind === 'locked') {
    return t('mobile.tasks.nextWaitOn', { stage: node.lockState.waitingOnStageName });
  }
  if (node.lockState.kind === 'done') {
    return t('mobile.tasks.segments.done');
  }
  return t('mobile.tasks.notYourStation', { stage: name });
}

export function WorkerOrderWorkflowScreen({ productionOrderId }: Props) {
  const { t, formatDateTime, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const onBack = useSmartBack('/(app)/(employee)/(tabs)/tasks' as Href);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const query = useMyOrderWorkflowQuery(productionOrderId, Boolean(productionOrderId));
  const order = query.data ? selectWorkerOrderCard(query.data, locale) : null;
  const lane = query.data?.lane ?? [];
  const laneRunning = lane.some((node) => node.status === 'IN_PROGRESS' && node.openStartedAt);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!laneRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [laneRunning]);
  const stages = useMemo(() => workerLaneToFlowStages(lane, locale, now), [lane, locale, now]);
  const next = useMemo(() => selectNextStationHint(lane), [lane]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = findLaneNodeByGraphKey(lane, selectedId ?? undefined) ?? next;

  const openNode = (node: WorkerOrderLaneNode) => {
    setSelectedId(node.id);
    if (!isLaneTaskOpenable(node) || !node.taskId) {
      void haptics.error();
      return;
    }
    void haptics.selection();
    if (node.lockState.kind === 'needs_receive') {
      router.push(`/(app)/(employee)/tasks/${node.taskId}/take-in` as Href);
      return;
    }
    router.push(`/(app)/(employee)/tasks/${node.taskId}` as Href);
  };

  const onStagePress = (stage: ProductionFlowStage) => {
    const node = findLaneNodeByGraphKey(lane, stage.graphKey ?? stage.snapshotNodeId ?? undefined);
    if (!node) {
      void haptics.error();
      return;
    }
    openNode(node);
  };

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
      <ScrollView
        contentContainerStyle={{
          paddingBottom: theme.spacing['3xl'],
          gap: theme.spacing.md,
        }}
        refreshControl={
          <RefreshControl
            refreshing={Boolean(query.isRefetching)}
            onRefresh={() => void query.refetch()}
            tintColor={colors.brand}
          />
        }
      >
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
              {t('mobile.tasks.orderWorkflowEyebrow')}
            </AppText>
            <AppText variant="largeTitle" weight={titleWeight}>
              {t('mobile.tasks.orderWorkflowTitle')}
            </AppText>
          </View>
        </View>

        {order ? (
          <DealerBoard title={order.productTitle} titleWeight={titleWeight}>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: theme.spacing.md,
              }}
            >
              <ProductThumb
                uri={resolveOrderMediaUri(order.imageUrl)}
                width={72}
                aspectRatio={1}
                radius={theme.radius.lg}
              />
              <View style={{ flex: 1, gap: 4, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                <AppText variant="caption" color="secondary" dir="ltr">
                  {order.number}
                </AppText>
                {order.factoryOrderNumber ? (
                  <AppText variant="caption" color="muted" dir="ltr">
                    {order.factoryOrderNumber}
                  </AppText>
                ) : null}
                {order.quantity ? (
                  <AppText variant="caption" color="secondary" dir="ltr">
                    {t('mobile.tasks.qtyLabel', { n: order.quantity })}
                  </AppText>
                ) : null}
                <AppText variant="caption" color="muted" dir="ltr">
                  {order.deadline ? formatDateTime(order.deadline) : t('mobile.tasks.noDeadline')}
                </AppText>
              </View>
            </View>
          </DealerBoard>
        ) : query.isPending ? null : (
          <EmptyState title={t('mobile.tasks.emptyOrdersTitle')} description={t('mobile.tasks.emptyOrdersBody')} />
        )}

        {stages.length > 0 ? (
          <DealerBoard title={t('mobile.tasks.laneGraphTitle')} titleWeight={titleWeight}>
            <AppText variant="caption" color="muted" style={{ marginBottom: theme.spacing.sm }}>
              {t('mobile.tasks.laneGraphHint')}
            </AppText>
            <ProductionFlowMap stages={stages} onStagePress={onStagePress} />
          </DealerBoard>
        ) : null}

        {selected ? (
          <DealerBoard title={localizedLaneStageName(selected, locale)} titleWeight={titleWeight}>
            <View style={{ gap: theme.spacing.sm, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
              <AppText variant="body" weight={titleWeight}>
                {hintText(selected, locale, t)}
              </AppText>
              {lockReasonText(selected.lockState, t) ? (
                <AppText variant="caption" color="secondary">
                  {lockReasonText(selected.lockState, t)}
                </AppText>
              ) : null}
              {!selected.assignedToMe ? (
                <AppText variant="caption" color="muted">
                  {t('mobile.tasks.notYourStation', {
                    stage: localizedLaneStageName(selected, locale),
                  })}
                </AppText>
              ) : null}
            </View>
          </DealerBoard>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}
