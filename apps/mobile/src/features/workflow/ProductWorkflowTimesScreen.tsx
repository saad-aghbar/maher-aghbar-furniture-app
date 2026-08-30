import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { localizedName } from '@maher/i18n';
import type { Href } from 'expo-router';
import { getAdminProduct } from '@/api/modules/catalogAdmin';
import { isApiError } from '@/api/errors';
import { queryKeys } from '@/api/queryKeys';
import { toastMessageForError } from '@/api/queryClient';
import { stageEstimateMinutes } from '@/api/modules/scheduling';
import { AppText } from '@/components/AppText';
import { ErrorState } from '@/components/feedback/ErrorState';
import { AppScreen } from '@/components/layout/AppScreen';
import { useToast } from '@/components/feedback/Toast';
import { ProductionFlowMap } from '@/features/production-flow/components/ProductionFlowMap';
import type { ProductionFlowStage } from '@/features/production-flow/selectProductionFlow';
import {
  useProductProductionProfileQuery,
  useProductStageEstimatesQuery,
  useUpsertProductStageEstimatesMutation,
} from '@/features/scheduling/productEstimates';
import { formatMinutesDuration } from '@/features/tasks/formatDuration';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { useProductWorkflowQuery, useWorkflowQuery, useWorkflowVersionQuery } from '@/features/workflow/query';
import {
  formatProductIdentity,
  selectProductionFlowFromStageEstimates,
  selectProductionFlowFromWorkflowVersion,
} from '@/features/workflow/selectProductionFlowFromWorkflowVersion';
import { StageDurationSheet } from '@/features/workflow/components/StageDurationSheet';

type Props = {
  productId: string;
  workflowId: string;
  backFallback?: Href;
};

export function ProductWorkflowTimesScreen({
  productId,
  workflowId,
  backFallback = '/(app)/(admin)/products',
}: Props) {
  const { t, locale } = useLocale();
  const { theme, colors } = useTheme();
  const { showToast } = useToast();
  const [selected, setSelected] = useState<ProductionFlowStage | null>(null);

  const productQuery = useQuery({
    queryKey: queryKeys.catalog.adminDetail(productId),
    queryFn: () => getAdminProduct(productId),
    enabled: Boolean(productId),
    staleTime: 30_000,
  });
  const configQuery = useProductWorkflowQuery(productId);
  const resolvedWorkflowId = (workflowId.trim() || configQuery.data?.workflowId || '').trim();

  const workflowQuery = useWorkflowQuery(resolvedWorkflowId, Boolean(resolvedWorkflowId));
  const activeVersionId = workflowQuery.data?.activeVersion?.id ?? null;
  // Version endpoint always includes stageDefinition; lean getWorkflow payloads may not.
  const versionQuery = useWorkflowVersionQuery(
    resolvedWorkflowId,
    activeVersionId,
    Boolean(activeVersionId),
  );
  const estimatesQuery = useProductStageEstimatesQuery(productId);
  const profileQuery = useProductProductionProfileQuery(productId);
  const saveMutation = useUpsertProductStageEstimatesMutation(productId);

  const estimateMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of estimatesQuery.data ?? []) {
      map.set(row.stageDefinitionId, stageEstimateMinutes(row));
    }
    return map;
  }, [estimatesQuery.data]);

  const graphStages = useMemo(() => {
    const version = versionQuery.data ?? workflowQuery.data?.activeVersion;
    if (!version) return [];
    return selectProductionFlowFromWorkflowVersion(version, locale, estimateMap);
  }, [estimateMap, locale, versionQuery.data, workflowQuery.data?.activeVersion]);

  const estimateStages = useMemo(
    () => selectProductionFlowFromStageEstimates(estimatesQuery.data ?? [], locale),
    [estimatesQuery.data, locale],
  );

  const workflowPending =
    (!resolvedWorkflowId && configQuery.isLoading) ||
    (Boolean(resolvedWorkflowId) && (workflowQuery.isLoading || versionQuery.isLoading));

  const stages = useMemo(() => {
    if (graphStages.length > 0) return graphStages;
    if (workflowPending) return [];
    return estimateStages;
  }, [estimateStages, graphStages, workflowPending]);

  const totalMinutes = useMemo(() => {
    if (profileQuery.data?.totalStandardMinutes != null) {
      return Number(profileQuery.data.totalStandardMinutes);
    }
    return stages.reduce((sum, s) => sum + (s.estimatedMinutes ?? 0), 0);
  }, [profileQuery.data?.totalStandardMinutes, stages]);

  const missingCount = stages.filter((s) => s.estimateReviewRequired).length;
  const loading =
    (workflowPending || estimatesQuery.isLoading) && stages.length === 0;
  const productIdentity = formatProductIdentity(
    productQuery.data?.sku,
    productQuery.data ? localizedName(locale, productQuery.data, productQuery.data.sku) : '',
  );

  if (
    resolvedWorkflowId &&
    (workflowQuery.isError || versionQuery.isError) &&
    !workflowQuery.data &&
    !versionQuery.data &&
    estimateStages.length === 0 &&
    !estimatesQuery.isLoading
  ) {
    return (
      <AppScreen backFallback={backFallback}>
        <ErrorState
          title={t('mobile.production.workflow.loadError')}
          description={t('mobile.productionFlow.errorBody')}
          retryLabel={t('mobile.productionFlow.retry')}
          onRetry={() => {
            void workflowQuery.refetch();
            void versionQuery.refetch();
            void estimatesQuery.refetch();
            void configQuery.refetch();
          }}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen backFallback={backFallback}>
      <ScrollView
        contentContainerStyle={{
          gap: theme.spacing.lg,
          paddingBottom: theme.spacing['6xl'] + 48,
        }}
        refreshControl={
          <RefreshControl
            refreshing={
              workflowQuery.isRefetching ||
              versionQuery.isRefetching ||
              estimatesQuery.isRefetching ||
              profileQuery.isRefetching ||
              configQuery.isRefetching ||
              productQuery.isRefetching
            }
            onRefresh={() => {
              void workflowQuery.refetch();
              void versionQuery.refetch();
              void estimatesQuery.refetch();
              void profileQuery.refetch();
              void configQuery.refetch();
              void productQuery.refetch();
            }}
          />
        }
      >
        <View style={{ gap: 4 }}>
          <AppText variant="title" weight="semibold">
            {t('mobile.production.workflow.productTimesTitle')}
          </AppText>
          {productIdentity ? (
            <AppText variant="body" weight="medium" dir="ltr" face="latin" numberOfLines={2}>
              {productIdentity}
            </AppText>
          ) : null}
          {stages.length > 0 ? (
            <AppText variant="caption" color="muted">
              {t('mobile.production.workflow.productTimesHint')}
            </AppText>
          ) : null}
        </View>

        <View
          style={{
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surfaceSecondary,
            padding: theme.spacing.md,
            gap: 4,
          }}
        >
          <AppText variant="caption" color="muted">
            {t('mobile.production.workflow.totalProductionTime')}
          </AppText>
          <AppText variant="title" weight="semibold">
            {formatMinutesDuration(totalMinutes, {
              hour: t('mobile.workerHome.durationHour'),
              minute: t('mobile.workerHome.durationMinute'),
            })}
          </AppText>
          {stages.length === 0 ? null : missingCount > 0 ? (
            <AppText variant="caption" style={{ color: colors.error }}>
              {t('mobile.production.workflow.stagesNeedTime', { count: missingCount })}
            </AppText>
          ) : (
            <AppText variant="caption" color="muted">
              {t('mobile.production.workflow.allStagesTimed')}
            </AppText>
          )}
        </View>

        {loading ? (
          <AppText color="muted">{t('mobile.production.loadingMore')}</AppText>
        ) : stages.length === 0 ? (
          <AppText color="muted">{t('mobile.production.workflow.emptyStages')}</AppText>
        ) : (
          <ProductionFlowMap
            stages={stages}
            showEstimatedDuration
            onStagePress={(stage) => setSelected(stage)}
          />
        )}
      </ScrollView>

      <StageDurationSheet
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        stageName={selected?.name ?? ''}
        initialMinutes={selected?.estimatedMinutes}
        saving={saveMutation.isPending}
        onSave={async (minutes) => {
          if (!selected?.stageDefinitionId) return;
          try {
            await saveMutation.mutateAsync([
              {
                stageDefinitionId: selected.stageDefinitionId,
                quantityScalingMode: 'FIXED',
                fixedMinutes: minutes,
                setupMinutes: 0,
                minutesPerUnit: 0,
                isRequired: true,
              },
            ]);
            showToast({
              variant: 'success',
              message: t('mobile.production.workflow.stageDurationSaved'),
            });
            setSelected(null);
          } catch (err) {
            showToast({
              variant: 'error',
              message: isApiError(err)
                ? toastMessageForError(err)
                : t('mobile.production.workflow.loadError'),
            });
          }
        }}
      />
    </AppScreen>
  );
}
