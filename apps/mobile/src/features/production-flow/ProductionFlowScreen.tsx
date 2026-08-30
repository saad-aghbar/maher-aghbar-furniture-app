import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useLocale } from '@/i18n';
import { ProgressBar } from '@/motion';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useSalesOrderQuery } from '@/features/sales-orders/query';
import { useProductionOrderQuery } from '@/features/production/query';
import { useProductionOrderWorkflowQuery } from '@/features/workflow/query';
import { AdminStageDrillSheet } from './components/AdminStageDrillSheet';
import { DealerStageSheet } from './components/DealerStageSheet';
import { ProductionFlowMap } from './components/ProductionFlowMap';
import {
  selectProductionFlow,
  selectProductionFlowStatusBadge,
  type ProductionFlowRole,
  type ProductionFlowStage,
} from './selectProductionFlow';
import {
  pickProductionOrderIdFromSalesOrder,
  selectProductionFlowFromWorkflowGraph,
} from './selectProductionFlowFromWorkflowGraph';
import { AssignOrderWorkflowCard } from '@/features/workflow/components/AssignOrderWorkflowCard';
import { StageDurationSheet } from '@/features/workflow/components/StageDurationSheet';
import { useCustomizeOrderWorkflowMinutesMutation } from '@/features/scheduling/productEstimates';
import { useOrderScheduleQuery } from '@/features/scheduling/query';
import { isOwnOrderSchedule } from '@/api/modules/scheduling';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { useToast } from '@/components/feedback/Toast';

type Props = {
  role: ProductionFlowRole;
  source: 'sales-order' | 'production-order';
  id: string;
  backFallback: Href;
};

export function ProductionFlowScreen({ role, source, id, backFallback }: Props) {
  const { t, locale, formatDate, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const [selected, setSelected] = useState<ProductionFlowStage | null>(null);
  const [durationStage, setDurationStage] = useState<ProductionFlowStage | null>(null);

  const salesQuery = useSalesOrderQuery(id, source === 'sales-order');
  const productionQuery = useProductionOrderQuery(id, source === 'production-order');
  const query = source === 'sales-order' ? salesQuery : productionQuery;

  const productionOrderId = useMemo(() => {
    if (source === 'production-order') return id;
    if (!salesQuery.data) return null;
    return pickProductionOrderIdFromSalesOrder(salesQuery.data as never);
  }, [id, salesQuery.data, source]);

  const workflowQuery = useProductionOrderWorkflowQuery(
    productionOrderId ?? '',
    Boolean(productionOrderId),
  );
  const scheduleQuery = useOrderScheduleQuery(
    productionOrderId ?? undefined,
    Boolean(productionOrderId) && role === 'admin',
  );
  const customizeMinutes = useCustomizeOrderWorkflowMinutesMutation(productionOrderId ?? '');
  const flowScrollBottomPad = theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE;

  const awaitingTimeApproval = useMemo(() => {
    if (role !== 'admin') return false;
    const graph = workflowQuery.data;
    if (graph?.stages?.some((s) => s.estimateReviewRequired || !(s.estimatedMinutes && s.estimatedMinutes > 0))) {
      return true;
    }
    const sched = scheduleQuery.data;
    if (!sched || isOwnOrderSchedule(sched)) return false;
    return Boolean(sched.schedule?.requiresAdminEstimateReview);
  }, [role, scheduleQuery.data, workflowQuery.data]);

  const flow = useMemo(() => {
    if (!query.data) return null;

    const graph = workflowQuery.data;
    if (graph?.needsWorkflow) {
      return { kind: 'needs-workflow' as const };
    }

    const legacy =
      source === 'sales-order'
        ? selectProductionFlow({ kind: 'sales-order', order: query.data as never }, role, locale)
        : selectProductionFlow(
            { kind: 'production-order', order: query.data as never },
            role,
            locale,
          );

    if (!graph?.stages?.length) return { kind: 'flow' as const, model: legacy };

    if (source === 'sales-order') {
      const order = query.data as {
        id: string;
        number: string;
        title?: string | null;
        status: string;
        progressPercent?: number | null;
        committedDeliveryDate?: string | null;
        requiredDeliveryDate?: string | null;
        requestedDeliveryDate?: string | null;
        promiseState?: string | null;
      };
      const committed = order.committedDeliveryDate ?? null;
      return {
        kind: 'flow' as const,
        model: selectProductionFlowFromWorkflowGraph(
          graph,
          {
            id: order.id,
            number: order.number,
            title: order.title ?? null,
            status: order.status,
            progressPercent: Number(order.progressPercent ?? 0),
            estimatedDelivery:
              committed ?? order.requiredDeliveryDate ?? order.requestedDeliveryDate ?? null,
            isCommittedDelivery: Boolean(committed),
            promiseState: order.promiseState ?? null,
            source: 'sales-order',
          },
          role,
          locale,
        ),
      };
    }

    const order = query.data as {
      id: string;
      number: string;
      product?: { nameEn?: string | null } | null;
      productDescription?: string | null;
      status: string;
      progressPercent?: number | null;
      committedDeliveryDate?: string | null;
      requiredDeliveryDate?: string | null;
      promiseState?: string | null;
    };
    const committed = order.committedDeliveryDate ?? null;
    return {
      kind: 'flow' as const,
      model: selectProductionFlowFromWorkflowGraph(
        graph,
        {
          id: order.id,
          number: order.number,
          title: order.product?.nameEn || order.productDescription || order.number,
          status: order.status,
          progressPercent: Number(order.progressPercent ?? 0),
          estimatedDelivery: committed ?? order.requiredDeliveryDate ?? null,
          isCommittedDelivery: Boolean(committed),
          promiseState: order.promiseState ?? null,
          source: 'production-order',
        },
        role,
        locale,
      ),
    };
  }, [locale, query.data, role, source, workflowQuery.data]);

  if (query.isLoading && !query.data) {
    return (
      <AppScreen backFallback={backFallback}>
        <AppText variant="title" weight="semibold">
          {t('mobile.productionFlow.title')}
        </AppText>
        <AppText variant="body" color="secondary">
          {t('mobile.productionFlow.loading')}
        </AppText>
      </AppScreen>
    );
  }

  if ((query.isError && !query.data) || !flow) {
    return (
      <AppScreen backFallback={backFallback}>
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

  if (flow.kind === 'needs-workflow') {
    return (
      <AppScreen backFallback={backFallback}>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            gap: theme.spacing.lg,
            paddingBottom: flowScrollBottomPad,
          }}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching || workflowQuery.isRefetching}
              onRefresh={() => {
                void query.refetch();
                if (productionOrderId) void workflowQuery.refetch();
              }}
            />
          }
        >
          <AppText variant="title" weight="semibold">
            {t('mobile.productionFlow.title')}
          </AppText>
          {role === 'admin' && productionOrderId ? (
            <AssignOrderWorkflowCard productionOrderId={productionOrderId} />
          ) : (
            <EmptyState
              title={t('mobile.production.workflow.needsWorkflowTitle')}
              description={t('mobile.production.workflow.needsWorkflowBody')}
            />
          )}
        </ScrollView>
      </AppScreen>
    );
  }

  const model = flow.model;
  const headerBadge = selectProductionFlowStatusBadge({
    awaitingTimeApproval,
    role,
    status: model.status,
    promiseState: model.promiseState,
  });
  const pct = Math.max(0, Math.min(100, Math.round(model.progressPercent || 0)));
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const late =
    Boolean(model.estimatedDelivery) &&
    new Date(model.estimatedDelivery!).getTime() < Date.now() &&
    model.status !== 'COMPLETED' &&
    model.status !== 'CANCELLED';
  const accent = late
    ? colors.error
    : pct >= 100 || model.status === 'COMPLETED'
      ? colors.success
      : colors.brand;
  const boardShadow = theme.elevation.card;

  return (
    <AppScreen backFallback={backFallback}>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          gap: theme.spacing.lg,
          paddingBottom: flowScrollBottomPad,
        }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching || workflowQuery.isRefetching}
            onRefresh={() => {
              void query.refetch();
              if (productionOrderId) void workflowQuery.refetch();
            }}
          />
        }
      >
        <View
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: late ? colors.error : colors.borderStrong,
            backgroundColor: colors.surface,
            overflow: 'hidden',
            ...boardShadow,
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              ...(isRTL ? { right: 0 } : { left: 0 }),
              width: 3,
              backgroundColor: accent,
              opacity: late ? 1 : 0.55,
            }}
          />
          <View
            style={{
              gap: theme.spacing.sm,
              paddingVertical: theme.spacing.md,
              paddingHorizontal: theme.spacing.md,
              ...(isRTL
                ? { paddingRight: theme.spacing.md + 4 }
                : { paddingLeft: theme.spacing.md + 4 }),
            }}
          >
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: late ? colors.errorSoft : colors.brandSoft,
                  borderWidth: 1,
                  borderColor: late ? colors.error : colors.border,
                }}
              >
                <Ionicons name="git-network-outline" size={18} color={accent} />
              </View>
              <AppText
                variant="caption"
                weight={locale === 'ar' ? 'regular' : 'medium'}
                style={{
                  flex: 1,
                  letterSpacing: locale === 'ar' ? 0 : 1.4,
                  textTransform: locale === 'ar' ? 'none' : 'uppercase',
                  color: colors.brand,
                }}
              >
                {t('mobile.productionFlow.title')}
              </AppText>
              <StatusBadge
                status={headerBadge.status}
                label={headerBadge.labelKey ? t(headerBadge.labelKey) : undefined}
                dot
              />
            </View>

            <AppText variant="title" weight={titleWeight} numberOfLines={2}>
              {model.title?.trim() || model.number}
            </AppText>

            <AppText
              variant="caption"
              color="secondary"
              dir="ltr"
              style={{ letterSpacing: 0.2 }}
            >
              {model.number}
            </AppText>

            {model.estimatedDelivery ? (
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: theme.spacing.xs,
                  paddingTop: theme.spacing.xs,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                }}
              >
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={late ? colors.error : colors.textMuted}
                />
                <AppText
                  variant="caption"
                  color={late ? undefined : 'muted'}
                  style={late ? { color: colors.error } : undefined}
                >
                  {t(
                    model.isCommittedDelivery
                      ? 'mobile.productionFlow.committedDelivery'
                      : 'mobile.productionFlow.estimatedDelivery',
                  )}
                  : {formatDate(model.estimatedDelivery)}
                </AppText>
              </View>
            ) : null}
          </View>
        </View>

        {awaitingTimeApproval ? (
          <View
            style={{
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: colors.error,
              backgroundColor: colors.errorSoft,
              padding: theme.spacing.md,
              gap: 4,
            }}
          >
            <AppText variant="body" weight="semibold" style={{ color: colors.error }}>
              {t('mobile.production.workflow.awaitingTimeApprovalTitle')}
            </AppText>
            <AppText variant="caption" color="muted">
              {t('mobile.production.workflow.awaitingTimeApprovalBody')}
            </AppText>
          </View>
        ) : null}

        {model.stages.length === 0 ? (
          <EmptyState
            title={t('mobile.productionFlow.emptyTitle')}
            description={t('mobile.productionFlow.emptyBody')}
          />
        ) : (
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
              overflow: 'hidden',
              ...boardShadow,
            }}
          >
            <ProductionFlowMap
              stages={model.stages}
              bottomInset={SURFACE_TAB_BAR_CLEARANCE}
              onStagePress={(stage) => {
                if (
                  role === 'admin' &&
                  (stage.estimateReviewRequired ||
                    !(stage.estimatedMinutes && stage.estimatedMinutes > 0)) &&
                  stage.snapshotNodeId
                ) {
                  setDurationStage(stage);
                  return;
                }
                setSelected(stage);
              }}
            />
          </View>
        )}

        <View
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: late ? colors.error : colors.borderStrong,
            backgroundColor: colors.surface,
            overflow: 'hidden',
            marginBottom: theme.spacing['3xl'],
            ...boardShadow,
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              ...(isRTL ? { right: 0 } : { left: 0 }),
              width: 3,
              backgroundColor: accent,
              opacity: late ? 1 : 0.55,
            }}
          />

          <View
            style={{
              gap: theme.spacing.md,
              paddingVertical: theme.spacing.md,
              paddingHorizontal: theme.spacing.md,
              ...(isRTL
                ? { paddingRight: theme.spacing.md + 4 }
                : { paddingLeft: theme.spacing.md + 4 }),
            }}
          >
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: late ? colors.errorSoft : colors.brandSoft,
                  borderWidth: 1,
                  borderColor: late ? colors.error : colors.border,
                }}
              >
                <Ionicons
                  name="analytics-outline"
                  size={18}
                  color={accent}
                />
              </View>
              <AppText variant="label" weight={titleWeight} style={{ flex: 1 }}>
                {t('mobile.productionFlow.overallProgress')}
              </AppText>
              {late ? (
                <StatusBadge
                  status="OVERDUE"
                  label={t('mobile.productionFlow.overdue')}
                  dot
                />
              ) : null}
            </View>

            <View style={{ gap: theme.spacing.xs }}>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <AppText variant="caption" color="secondary">
                  {t('mobile.production.progress')}
                </AppText>
                <AppText
                  variant="caption"
                  weight="semibold"
                  style={{ color: accent }}
                  dir="ltr"
                >
                  {`${pct}%`}
                </AppText>
              </View>
              <ProgressBar
                progress={pct / 100}
                height={6}
                fillStyle={{ backgroundColor: accent }}
                trackStyle={{ backgroundColor: colors.surfaceSecondary }}
              />
            </View>

            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
                paddingTop: theme.spacing.xs,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
              }}
            >
              <Ionicons
                name="calendar-outline"
                size={16}
                color={late ? colors.error : colors.textMuted}
              />
              <AppText
                variant="caption"
                color={late ? undefined : 'muted'}
                style={late ? { color: colors.error, flex: 1 } : { flex: 1 }}
              >
                {t('mobile.productionFlow.estimatedDelivery')}:{' '}
                {model.estimatedDelivery
                  ? formatDate(model.estimatedDelivery)
                  : t('mobile.productionFlow.deliveryTbd')}
              </AppText>
            </View>
          </View>
        </View>
      </ScrollView>

      {role === 'admin' ? (
        <AdminStageDrillSheet
          open={Boolean(selected)}
          onClose={() => setSelected(null)}
          stage={selected}
          flow={model}
        />
      ) : (
        <DealerStageSheet
          open={Boolean(selected)}
          onClose={() => setSelected(null)}
          stage={selected}
          flow={model}
        />
      )}

      {role === 'admin' && productionOrderId ? (
        <StageDurationSheet
          open={Boolean(durationStage)}
          onClose={() => setDurationStage(null)}
          stageName={durationStage?.name ?? ''}
          initialMinutes={durationStage?.estimatedMinutes}
          saving={customizeMinutes.isPending}
          onSave={async (minutes) => {
            if (!durationStage?.snapshotNodeId) return;
            try {
              await customizeMinutes.mutateAsync({
                snapshotNodeId: durationStage.snapshotNodeId,
                estimatedMinutes: minutes,
              });
              showToast({
                variant: 'success',
                message: t('mobile.production.workflow.stageDurationSaved'),
              });
              setDurationStage(null);
              void workflowQuery.refetch();
              void scheduleQuery.refetch();
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
      ) : null}
    </AppScreen>
  );
}
