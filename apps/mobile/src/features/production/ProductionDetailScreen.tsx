import type { Href } from 'expo-router';
import { Redirect, useRouter } from 'expo-router';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { findDeliveryForSalesOrder } from '@/api/modules/deliveries';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { FlatList, RefreshControl, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { can, canAny } from '@maher/permissions';
import { localizedName } from '@maher/i18n';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { AppScreen } from '@/components/layout/AppScreen';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { ImageViewer } from '@/components/media/ImageViewer';
import { useNetwork } from '@/components/network/NetworkProvider';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { JourneyStickyDock } from '@/features/sales-orders/components/journey/JourneyStickyDock';
import { seedOrdersDeskChip } from '@/features/sales-orders/ordersDeskContext';
import { useLocale } from '@/i18n';
import {
  AnimatedPressable,
  haptics,
  ListItemEnter,
  useReducedMotion,
} from '@/motion';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { WorkflowProgressHit } from '@/features/production-flow/components/WorkflowProgressHit';
import { adminProductionFlowHref } from '@/features/production-flow/flowRoutes';
import { ProductionTaskSheet } from './components/ProductionTaskSheet';
import { ProductionAttentionBoard } from './components/ProductionAttentionBoard';
import { ProductionWhereNowBoard } from './components/ProductionWhereNowBoard';
import { ProductionJourneyBoard } from './components/ProductionJourneyBoard';
import {
  ProductionManageSheet,
  type ManageExceptionAction,
} from './components/ProductionManageSheet';
import {
  DeliveryDateSheet,
  PrioritySheet,
} from './components/PriorityDeliverySheets';
import { ProductionListSkeleton } from './components/ProductionSkeleton';
import { ProductionMaterialUsageBoard } from './components/ProductionMaterialUsageBoard';
import { ProductionLifecycleStrip } from './components/ProductionLifecycleStrip';
import { AdminScheduleStrip } from './components/AdminScheduleStrip';
import { ProductionTaskCard } from './components/ProductionTaskCard';
import {
  ProductionHubJump,
  type ProductionHubSection,
} from './components/ProductionHubJump';
import { ProductionWipSection } from './components/ProductionWipSection';
import { ProductionWipKitSheet } from './components/ProductionWipKitSheet';
import { ProductionIdentityBoard } from './components/ProductionIdentityBoard';
import { productionBoardShadow, productionInsetStyle } from './productionFloorStyle';
import { shouldOpenPlanSheet } from './planCta';
import { collectProductionAttention } from './productionAttention';
import { FabricTrackerBoard } from '@/features/fabric/FabricTrackerBoard';
import { resolveFabricStageLabel } from '@/features/fabric/fabricCopy';
import {
  fabricRowHref,
  fabricStatusKind,
  pickFabricBlockingRow,
  selectFabricTrackerRows,
} from '@/features/fabric/selectFabricTracker';
import { useFabricTrackerQuery } from '@/features/purchasing/query';
import {
  selectProductionJourney,
  selectProductionWhereNow,
} from './selectProductionJourney';
import { WorkflowPickerSheet } from '@/features/sales-orders/production-setup/components/WorkflowPickerSheet';
import {
  useAssignOrderWorkflowMutation,
  useWorkflowsQuery,
} from '@/features/workflow/query';
import type { WipKitCard } from '@/api/modules/inventory';
import type { ProductionTask } from './api';
import {
  useAssignableWorkersQuery,
  useAssignTaskMutation,
  useBlockTaskMutation,
  useEnsurePlanTasksMutation,
  usePauseTaskMutation,
  useProductionOrderQuery,
  useProductionMaterialUsageQuery,
  useStartProductionMutation,
  useReturnProductionToPreparingMutation,
  useUnblockTaskMutation,
  useUpdateProductionMutation,
  useUpdateTaskNotesMutation,
} from './query';
import {
  productionStartDueHint,
  selectProductionDetail,
  type ProductionTaskRow,
} from './selectProduction';

const STARTABLE_STATUSES = new Set([
  'DRAFT',
  'PLANNED',
  'READY',
  'WAITING_FOR_MATERIALS',
]);

function isExecutableTask(task: ProductionTask): boolean {
  if (task.status === 'CANCELLED') return false;
  const kind = String(task.stageDefinition?.executionKind ?? '').toUpperCase();
  if (kind === 'LOGISTICS') return false;
  const code = String(task.stageDefinition?.code ?? '').toUpperCase();
  if (code === 'DELIVERY') return false;
  return true;
}

type ProductionDetailScreenProps = {
  orderId: string;
  /** orders = Preparing plan host; production = post-release execution (default). */
  host?: 'orders' | 'production';
};

function priorityText(priority: string, t: (key: string) => string): string {
  const key = `mobile.production.priority.${priority}`;
  const label = t(key);
  return label === key ? priority : label;
}

export function ProductionDetailScreen({
  orderId,
  host = 'production',
}: ProductionDetailScreenProps) {
  const { user } = useAuth();
  const { t, locale, isRTL, formatDateTime, formatCurrency } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const router = useRouter();
  const reduce = useReducedMotion();
  const listRef = useRef<FlatList>(null);

  const canRead = can(user, 'production-order.read');
  const canAssign = can(user, 'production-order.assign');
  const canUpdate = can(user, 'production-order.update');
  const canSetup = canAny(user, ['production-order.assign', 'production-order.update']);
  const canOverrideConflict = can(user, 'schedule.override');
  const canUpdateTask = canAny(user, [
    'production-task.update-any',
    'production-task.update-own',
  ]);
  const canUnblock = can(user, 'production-task.update-any');
  const canReadMfgCost = can(user, 'inventory.cost.read');

  const [activeTask, setActiveTask] = useState<ProductionTaskRow | null>(null);
  const [assignWindow, setAssignWindow] = useState<{
    plannedStart?: string;
    plannedCompletion?: string;
  }>({});
  const [scheduleConflict, setScheduleConflict] = useState<{
    conflicts: Array<{ kind?: string; id?: string; label?: string; start?: string; end?: string }>;
    suggestedWindow?: { plannedStart: string; plannedCompletion: string } | null;
  } | null>(null);
  const [releaseConfirmOpen, setReleaseConfirmOpen] = useState(false);
  const [replanConfirmOpen, setReplanConfirmOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [taskSheetIntent, setTaskSheetIntent] = useState<'view' | 'manage' | 'plan'>(
    'plan',
  );
  const [startReasons, setStartReasons] = useState<string[]>([]);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [confirmUnblock, setConfirmUnblock] = useState<{
    taskId: string;
    name: string;
  } | null>(null);
  const [viewCompleted, setViewCompleted] = useState(false);
  const [hubSection, setHubSection] = useState<ProductionHubSection>(
    host === 'orders' ? 'tasks' : 'overview',
  );
  const [wipKit, setWipKit] = useState<WipKitCard | null>(null);
  const [workflowPickerOpen, setWorkflowPickerOpen] = useState(false);

  const query = useProductionOrderQuery(orderId, canRead);
  const workflowsQuery = useWorkflowsQuery(
    canRead && host === 'orders' && hubSection === 'workflow',
  );
  const assignWorkflowMutation = useAssignOrderWorkflowMutation(orderId);
  const deliveryQuery = useQuery({
    queryKey: ['production-order-delivery', query.data?.salesOrder?.number],
    queryFn: () => findDeliveryForSalesOrder(query.data!.salesOrder!.number),
    enabled: Boolean(query.data?.salesOrder?.number),
    staleTime: 30_000,
  });
  const materialsQuery = useProductionMaterialUsageQuery(orderId, canRead);

  const workersTaskId =
    activeTask && canAssign && taskSheetIntent !== 'view' ? activeTask.id : null;
  const workersTaskMeta = useMemo(() => {
    if (!workersTaskId || !query.data) return null;
    const task = (query.data.tasks ?? []).find((t) => t.id === workersTaskId);
    if (!task) return null;
    return {
      stageDefinitionId: task.stageDefinition?.id ?? undefined,
      plannedStart: assignWindow.plannedStart ?? task.plannedStart ?? undefined,
      plannedCompletion:
        assignWindow.plannedCompletion ?? task.plannedCompletion ?? undefined,
    };
  }, [workersTaskId, query.data, assignWindow]);

  const workersQuery = useAssignableWorkersQuery(
    canAssign && Boolean(workersTaskId),
    undefined,
    workersTaskMeta?.stageDefinitionId,
    workersTaskId
      ? {
          taskId: workersTaskId,
          plannedStart: workersTaskMeta?.plannedStart,
          plannedCompletion: workersTaskMeta?.plannedCompletion,
        }
      : undefined,
  );
  const assignMutation = useAssignTaskMutation(orderId);
  const startMutation = useStartProductionMutation(orderId);
  const replanMutation = useReturnProductionToPreparingMutation(orderId);
  const ensurePlanMutation = useEnsurePlanTasksMutation(orderId);
  const updateMutation = useUpdateProductionMutation(orderId);
  const unblockMutation = useUnblockTaskMutation(orderId);
  const notesMutation = useUpdateTaskNotesMutation(orderId);
  const pauseMutation = usePauseTaskMutation(orderId);
  const blockMutation = useBlockTaskMutation(orderId);

  const detail = useMemo(
    () => (query.data ? selectProductionDetail(query.data, locale) : null),
    [query.data, locale],
  );

  const readiness = query.data?.readiness ?? null;
  const releasedToFactory = Boolean(query.data?.releasedToFactoryAt);
  const floorStarted = Boolean(
    query.data?.actualStartDate ||
      ['IN_PROGRESS', 'ON_HOLD', 'QUALITY_CHECK', 'READY_FOR_PACKAGING', 'READY_FOR_DELIVERY', 'COMPLETED'].includes(
        String(query.data?.status ?? '').toUpperCase(),
      ),
  );
  const salesOrderId = query.data?.salesOrder?.id ?? null;
  const canFabricRead = can(user, 'fabric.procurement.read');
  const fabricTrackerQuery = useFabricTrackerQuery(salesOrderId ?? undefined, canFabricRead);
  const fabricRows = useMemo(
    () => (fabricTrackerQuery.data ? selectFabricTrackerRows(fabricTrackerQuery.data) : []),
    [fabricTrackerQuery.data],
  );
  const fabricBlockingNote = useMemo(() => {
    const blocking = pickFabricBlockingRow(fabricRows);
    if (!blocking) return null;
    const stage = resolveFabricStageLabel(t, blocking.stageCode);
    const kind = fabricStatusKind(blocking);
    const key =
      kind === 'PARTIAL'
        ? 'mobile.production.fabricStagePartial'
        : 'mobile.production.fabricStageWaiting';
    return t(key, {
      stage: stage ?? '',
      fabric: blocking.label,
    });
  }, [fabricRows, t]);
  const currentWorkflowId =
    query.data?.salesOrderLine?.productionSetup?.workflowId ?? null;
  const currentWorkflowName = useMemo(() => {
    if (!currentWorkflowId) return null;
    const wf = (workflowsQuery.data ?? []).find((row) => row.id === currentWorkflowId);
    if (!wf) return null;
    return localizedName(locale, wf, wf.code);
  }, [currentWorkflowId, workflowsQuery.data, locale]);
  const isStartable = Boolean(
    detail && STARTABLE_STATUSES.has(String(detail.status).toUpperCase()),
  );
  /** Free draft plan editor only before Release to factory. */
  const showPlan = isStartable && canSetup && !releasedToFactory;
  const canChangeWorkflow =
    host === 'orders' && !releasedToFactory && (canAssign || canUpdate);
  /** Ready for Factory — Replan unlocks back to Needs Planning (not after floor start). */
  const showReplan =
    host === 'production' && releasedToFactory && !floorStarted && canUpdate;
  const redirectUnreleasedToOrdersPlan =
    host === 'production' && Boolean(query.data) && !releasedToFactory && Boolean(salesOrderId);
  /** Active factory work — dossier is read-only by default. */
  const isExecutionDossier = host === 'production' && floorStarted;
  const isReadyDossier = host === 'production' && releasedToFactory && !floorStarted;

  const attentionBlocks = useMemo(
    () =>
      collectProductionAttention({
        reasons: readiness?.reasons ?? null,
        blockers: detail?.openBlockers ?? null,
        isLate: detail?.isLate,
      }),
    [readiness?.reasons, detail?.openBlockers, detail?.isLate],
  );

  const journeyStages = useMemo(
    () => (query.data ? selectProductionJourney(query.data, locale) : []),
    [query.data, locale],
  );

  const whereNow = useMemo(() => {
    if (!query.data || !detail) return null;
    return selectProductionWhereNow(query.data, locale, {
      dealerName: detail.dealerName,
      productTitle: detail.title,
      imageUrl: detail.imageUrl,
      deliveryLabel: detail.deliveryLabel,
      progressLabel: detail.progressLabel,
      attentionCount: attentionBlocks.length,
    });
  }, [query.data, detail, locale, attentionBlocks.length]);

  const openTaskExecution = (row: ProductionTaskRow, intent: 'view' | 'manage' | 'plan') => {
    void haptics.selection();
    setTaskSheetIntent(intent);
    setAssignWindow({});
    setScheduleConflict(null);
    setActiveTask(row);
  };

  const datesReady = useMemo(() => {
    if (!readiness) return false;
    if (typeof readiness.datesReady === 'boolean') return readiness.datesReady;
    if (readiness.dates) {
      return readiness.dates.missing.length === 0;
    }
    return !(readiness.reasons ?? []).some((r) => r.code === 'MISSING_DATE');
  }, [readiness]);

  const datesAssigned = readiness?.dates?.ready ?? 0;
  const datesRequired = readiness?.dates?.required ?? 0;

  const executableTasks = useMemo(() => {
    if (!query.data || !detail) return [];
    const tasks = (query.data.tasks ?? []).filter(isExecutableTask);
    return tasks.map((task) => {
      const row = detail.tasks.find((t) => t.id === task.id);
      return {
        task,
        row,
        name: row?.name ?? task.name,
        assigneeName: row?.assigneeName ?? null,
        canAssign: row?.canAssign ?? !task.assignedEmployeeId,
        department: task.stageDefinition?.responsibleDepartment ?? null,
        stageDefinitionId: task.stageDefinition?.id ?? row?.stageDefinitionId ?? null,
        plannedStart: row?.plannedStart ?? task.plannedStart ?? null,
        plannedCompletion:
          row?.plannedCompletion ?? task.plannedCompletion ?? null,
        dependsOnCodes: row?.dependsOnCodes ?? [],
      };
    });
  }, [query.data, detail]);

  const taskRows = useMemo(() => {
    if (!detail) return [];
    if (viewCompleted) return detail.tasks.filter((task) => task.isCompleted);
    return detail.tasks;
  }, [detail, viewCompleted]);

  const sheetTask = useMemo(() => {
    if (!activeTask || !detail) return activeTask;
    return detail.tasks.find((t) => t.id === activeTask.id) ?? activeTask;
  }, [activeTask, detail]);

  const releaseSummaryLines = useMemo(() => {
    if (!readiness) return [];
    const lines: string[] = [];
    lines.push(
      t('mobile.production.setup.readinessTeam', {
        assigned: readiness.assignment.assigned,
        required: readiness.assignment.required,
      }),
    );
    lines.push(
      t('mobile.production.setup.readinessDates', {
        ready: datesAssigned,
        required: datesRequired || readiness.assignment.required,
      }),
    );
    lines.push(
      readiness.materialsReady
        ? t('mobile.production.setup.readinessMaterials')
        : t('mobile.production.setup.incompleteBody'),
    );
    return lines;
  }, [readiness, datesAssigned, datesRequired, t]);

  if (!canRead) {
    return (
      <AppScreen backFallback={'/(app)/(admin)/(tabs)/production' as Href}>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (query.isLoading && !query.data) {
    return (
      <AppScreen backFallback={'/(app)/(admin)/(tabs)/production' as Href}>
        <ProductionListSkeleton />
      </AppScreen>
    );
  }

  if ((query.isError && !query.data) || !detail) {
    return (
      <AppScreen backFallback={'/(app)/(admin)/(tabs)/production' as Href}>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ErrorState
          title={t('mobile.production.errorTitle')}
          description={t('mobile.production.errorBody')}
          retryLabel={t('mobile.production.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  if (redirectUnreleasedToOrdersPlan && salesOrderId) {
    return (
      <Redirect
        href={`/(app)/(admin)/orders/${salesOrderId}/production-plan` as Href}
      />
    );
  }

  const pct = Math.max(0, Math.min(100, Math.round(detail.progressPercent || 0)));
  const urgent = detail.priority === 'URGENT' || detail.priority === 'HIGH';
  const accent = detail.isLate
    ? colors.error
    : urgent
      ? colors.warning
      : colors.brand;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const dockVisible =
    showPlan && (hubSection === 'overview' || hubSection === 'tasks');
  const replanDockVisible = showReplan && !dockVisible;
  const listBottomPad =
    theme.spacing['3xl'] +
    SURFACE_TAB_BAR_CLEARANCE +
    (dockVisible || replanDockVisible ? 72 : 0);

  const openAssign = (taskId: string) => {
    const row = detail?.tasks.find((t) => t.id === taskId) ?? null;
    if (!row) return;
    openTaskExecution(row, showPlan ? 'plan' : 'manage');
  };

  /** Post-release plan desk: open first unassigned executable in plan intent. */
  const openPlanSheet = () => {
    const next =
      executableTasks.find((t) => t.canAssign && !t.assigneeName) ??
      executableTasks[0] ??
      null;
    if (next?.row) {
      openTaskExecution(next.row, 'plan');
      return;
    }
    if (next?.task.id) {
      openAssign(next.task.id);
      return;
    }
    ensurePlanMutation.mutate(undefined, {
      onSuccess: () => {
        void query.refetch();
      },
      onError: () => {
        showToast({
          variant: 'error',
          message: t('mobile.production.setup.stagesPrepareFailed'),
        });
      },
    });
  };

  const retryPrepareStages = () => {
    ensurePlanMutation.mutate(undefined, {
      onSuccess: () => {
        void query.refetch();
      },
      onError: () => {
        showToast({
          variant: 'error',
          message: t('mobile.production.setup.stagesPrepareFailed'),
        });
      },
    });
  };

  const onRelease = () => {
    setStartReasons([]);
    startMutation.mutate(undefined, {
      onSuccess: () => {
        void haptics.confirmMedium();
        setReleaseConfirmOpen(false);
        showToast({
          variant: 'success',
          message: t('mobile.production.setup.startSuccess'),
        });
      },
      onError: (err) => {
        void haptics.error();
        setReleaseConfirmOpen(false);
        if (isApiError(err) && err.code === 'PRODUCTION_NOT_READY') {
          const reasons =
            readiness?.reasons
              ?.map((r) => r.message || r.stageName || r.code)
              .filter(Boolean) ?? [];
          setStartReasons(
            reasons.length > 0
              ? reasons
              : [err.message || t('mobile.production.setup.notReadyBody')],
          );
          void query.refetch();
          return;
        }
        showToast({
          variant: 'error',
          message: isApiError(err)
            ? toastMessageForError(err)
            : t('mobile.production.setup.startFailed'),
        });
      },
    });
  };

  return (
    <AppScreen backFallback={'/(app)/(admin)/(tabs)/production' as Href} padding="md">
      {showOfflineBanner ? <OfflineBanner /> : null}
      <FlatList
        data={
          showPlan
            ? []
            : hubSection === 'tasks' || hubSection === 'overview'
              ? taskRows
              : []
        }
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: listBottomPad,
          flexGrow: 1,
        }}
        onScrollToIndexFailed={() => {
          listRef.current?.scrollToEnd({ animated: true });
        }}
        refreshControl={
          <RefreshControl
            tintColor={colors.brand}
            refreshing={query.isRefetching || materialsQuery.isRefetching}
            onRefresh={() => {
              void query.refetch();
              void materialsQuery.refetch();
            }}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.lg, marginBottom: theme.spacing.sm }}>
            <HeaderEnter reduce={reduce} delay={0}>
              <ProductionIdentityBoard
                number={detail.number}
                title={detail.title}
                status={detail.status}
                priority={detail.priority}
                isLate={detail.isLate}
                imageUrl={detail.imageUrl}
                onPressImage={() => setImageOpen(true)}
              />
            </HeaderEnter>

            <HeaderEnter reduce={reduce} delay={0}>
              <ProductionHubJump
                active={hubSection}
                onChange={setHubSection}
                planMode={host === 'orders'}
              />
            </HeaderEnter>

            {host !== 'orders' &&
            hubSection === 'overview' &&
            detail.estimatedManufacturingCost != null ? (
              <HeaderEnter reduce={reduce} delay={10}>
                <DealerBoard
                  title={
                    detail.actualManufacturingCost != null
                      ? t('mobile.production.manufacturingCostActualTitle')
                      : t('mobile.production.manufacturingCostEstimated')
                  }
                  titleWeight={titleWeight}
                >
                  <View style={productionInsetStyle(theme, colors)}>
                    {detail.actualManufacturingCost == null ? (
                      <AppText variant="caption" color="muted">
                        {t('mobile.production.estimatedOnly')}
                      </AppText>
                    ) : null}
                    <MetaRow
                      isRTL={isRTL}
                      label={t('mobile.production.estimatedLabel')}
                      value={formatCurrency(detail.estimatedManufacturingCost)}
                    />
                    <MetaRow
                      isRTL={isRTL}
                      label={t('mobile.production.actualLabel')}
                      value={
                        detail.actualManufacturingCost != null
                          ? formatCurrency(detail.actualManufacturingCost)
                          : t('mobile.production.unavailable')
                      }
                    />
                    <MetaRow
                      isRTL={isRTL}
                      label={t('mobile.production.varianceLabel')}
                      value={t('mobile.production.unavailable')}
                    />
                  </View>
                </DealerBoard>
              </HeaderEnter>
            ) : null}

            {host !== 'orders' &&
            canReadMfgCost &&
            query.data?.manufacturingCosting &&
            hubSection === 'overview' ? (
              <HeaderEnter reduce={reduce} delay={20}>
                <DealerBoard title={t('mobile.orderDetail.mfgCostTitle')} titleWeight={titleWeight}>
                  <View style={productionInsetStyle(theme, colors)}>
                    <AppText variant="caption" color="secondary">
                      {(() => {
                        const st = String(query.data.manufacturingCosting.status ?? '').toUpperCase();
                        if (st === 'FINAL') return t('mobile.orderDetail.mfgCostStatusFinal');
                        if (st === 'IN_PROGRESS') return t('mobile.orderDetail.mfgCostStatusInProgress');
                        if (st === 'INCOMPLETE') return t('mobile.orderDetail.mfgCostStatusIncomplete');
                        return t('mobile.orderDetail.mfgCostStatusEstimatedOnly');
                      })()}
                    </AppText>
                    <MetaRow
                      isRTL={isRTL}
                      label={t('mobile.orderDetail.mfgCostEstimated')}
                      value={
                        query.data.manufacturingCosting.estimatedTotal != null
                          ? formatCurrency(query.data.manufacturingCosting.estimatedTotal)
                          : t('mobile.orderDetail.mfgCostUnavailable')
                      }
                    />
                    <MetaRow
                      isRTL={isRTL}
                      label={t('mobile.orderDetail.mfgCostActual')}
                      value={
                        query.data.manufacturingCosting.actualTotal != null
                          ? formatCurrency(query.data.manufacturingCosting.actualTotal)
                          : t('mobile.orderDetail.mfgCostUnavailable')
                      }
                    />
                    <MetaRow
                      isRTL={isRTL}
                      label={t('mobile.orderDetail.mfgCostVariance')}
                      value={
                        query.data.manufacturingCosting.varianceCost != null
                          ? formatCurrency(query.data.manufacturingCosting.varianceCost)
                          : t('mobile.orderDetail.mfgCostUnavailable')
                      }
                    />
                  </View>
                </DealerBoard>
              </HeaderEnter>
            ) : null}

            {hubSection === 'overview' || hubSection === 'tasks' ? (
              <>
            {isExecutionDossier && whereNow ? (
              <HeaderEnter reduce={reduce} delay={30}>
                <ProductionWhereNowBoard
                  where={whereNow}
                  onPressImage={
                    detail.imageUrl ? () => setImageOpen(true) : undefined
                  }
                />
              </HeaderEnter>
            ) : null}

            {(isExecutionDossier || isReadyDossier) && attentionBlocks.length > 0 ? (
              <HeaderEnter reduce={reduce} delay={35}>
                <ProductionAttentionBoard
                  blocks={attentionBlocks}
                  productionOrderId={orderId}
                  salesOrderId={salesOrderId}
                  onManageTask={
                    // Ready for Factory: Replan only — no free assign/manage from Attention.
                    isReadyDossier
                      ? undefined
                      : (taskId) => {
                          const row = detail.tasks.find((t) => t.id === taskId) ?? null;
                          if (row) openTaskExecution(row, 'manage');
                        }
                  }
                />
              </HeaderEnter>
            ) : null}

            {canFabricRead ? (
              <HeaderEnter reduce={reduce} delay={36}>
                <FabricTrackerBoard
                  variant="production"
                  compact
                  rows={fabricRows}
                  ready={fabricTrackerQuery.data?.ready}
                  required={fabricTrackerQuery.data?.required}
                  loading={fabricTrackerQuery.isLoading}
                  error={fabricTrackerQuery.isError}
                  onRetry={() => void fabricTrackerQuery.refetch()}
                  blockingNote={fabricBlockingNote}
                  onPressItem={(row) => router.push(fabricRowHref(row) as Href)}
                />
              </HeaderEnter>
            ) : null}

            {isExecutionDossier || isReadyDossier ? (
              <HeaderEnter reduce={reduce} delay={40}>
                <ProductionJourneyBoard
                  stages={journeyStages}
                  onOpenStage={(stage) => {
                    const row =
                      (stage.primaryTaskId
                        ? detail.tasks.find((t) => t.id === stage.primaryTaskId)
                        : null) ??
                      detail.tasks.find((t) => t.stageCode === stage.code) ??
                      null;
                    if (row) openTaskExecution(row, 'view');
                  }}
                />
              </HeaderEnter>
            ) : null}

            {isReadyDossier ? (
              <HeaderEnter reduce={reduce} delay={38}>
                <DealerBoard
                  title={t('mobile.production.dossier.approvedPlan')}
                  titleWeight={titleWeight}
                >
                  <View style={productionInsetStyle(theme, colors)}>
                    <AppText variant="caption" color="muted">
                      {t('mobile.production.dossier.approvedPlanHint')}
                    </AppText>
                    {(() => {
                      const hint = productionStartDueHint({
                        plannedStartDate: query.data?.plannedStartDate,
                        actualStartDate: query.data?.actualStartDate,
                        releasedToFactoryAt: query.data?.releasedToFactoryAt,
                        status: query.data?.status,
                      });
                      if (hint === 'due_today') {
                        return (
                          <AppText
                            variant="caption"
                            weight={titleWeight}
                            style={{ color: colors.warning }}
                          >
                            {t('mobile.production.startDue.dueToday')}
                          </AppText>
                        );
                      }
                      if (hint === 'planned_start_passed') {
                        return (
                          <AppText
                            variant="caption"
                            weight={titleWeight}
                            style={{ color: colors.warning }}
                          >
                            {t('mobile.production.startDue.plannedPassed')}
                          </AppText>
                        );
                      }
                      return null;
                    })()}
                    {detail.deliveryLabel ? (
                      <MetaRow
                        isRTL={isRTL}
                        label={t('mobile.production.deliveryDate')}
                        value={detail.deliveryLabel}
                      />
                    ) : null}
                    <MetaRow
                      isRTL={isRTL}
                      label={t('mobile.production.dossier.workersPlanned')}
                      value={`${detail.assignedWorkerCount}/${detail.taskCount}`}
                    />
                    {readiness ? (
                      <>
                        <ReadinessRow
                          done={readiness.materialsReady}
                          label={t('mobile.production.setup.readinessMaterials')}
                          isRTL={isRTL}
                        />
                        <ReadinessRow
                          done={readiness.assignment.missing.length === 0}
                          label={t('mobile.production.setup.readinessTeam', {
                            assigned: readiness.assignment.assigned,
                            required: readiness.assignment.required,
                          })}
                          isRTL={isRTL}
                        />
                        <ReadinessRow
                          done={datesReady}
                          label={t('mobile.production.setup.readinessDates', {
                            ready: datesAssigned,
                            required: datesRequired || readiness.assignment.required,
                          })}
                          isRTL={isRTL}
                        />
                      </>
                    ) : null}
                  </View>
                </DealerBoard>
              </HeaderEnter>
            ) : null}

            {(canAssign || canUpdate) && showPlan ? (
              <HeaderEnter reduce={reduce} delay={40}>
                <DealerBoard
                  title={t('mobile.production.setup.title')}
                  titleWeight={titleWeight}
                >
                  <AppText
                    variant="caption"
                    weight={locale === 'ar' ? 'regular' : 'medium'}
                    style={{
                      letterSpacing: locale === 'ar' ? 0 : 0.5,
                      textTransform: locale === 'ar' ? 'none' : 'uppercase',
                      color: colors.brand,
                      fontSize: 11,
                    }}
                  >
                    {t('mobile.production.setup.eyebrow')}
                  </AppText>
                  <AppText variant="caption" color="muted">
                    {t('mobile.production.setup.subtitle')}
                  </AppText>
                </DealerBoard>
              </HeaderEnter>
            ) : null}

            {readiness && showPlan ? (
              <HeaderEnter reduce={reduce} delay={50}>
                <DealerBoard
                  title={t('mobile.production.setup.readinessTitle')}
                  titleWeight={titleWeight}
                >
                  <View style={productionInsetStyle(theme, colors)}>
                    <ReadinessRow
                      done={readiness.setupReady ?? true}
                      label={t('mobile.production.setup.readinessSetup')}
                      isRTL={isRTL}
                    />
                    <ReadinessRow
                      done={readiness.workflowReady}
                      label={t('mobile.production.setup.readinessWorkflow')}
                      isRTL={isRTL}
                    />
                    <ReadinessRow
                      done={readiness.materialsReady}
                      label={t('mobile.production.setup.readinessMaterials')}
                      isRTL={isRTL}
                    />
                    <ReadinessRow
                      done={readiness.assignment.missing.length === 0}
                      label={t('mobile.production.setup.readinessTeam', {
                        assigned: readiness.assignment.assigned,
                        required: readiness.assignment.required,
                      })}
                      isRTL={isRTL}
                    />
                    <ReadinessRow
                      done={datesReady}
                      label={t('mobile.production.setup.readinessDates', {
                        ready: datesAssigned,
                        required: datesRequired || readiness.assignment.required,
                      })}
                      isRTL={isRTL}
                    />
                  </View>
                </DealerBoard>
              </HeaderEnter>
            ) : null}

            {showPlan ? (
              <HeaderEnter reduce={reduce} delay={55}>
                <DealerBoard
                  title={t('mobile.production.setup.teamJourney')}
                  titleWeight={titleWeight}
                  trailing={
                    <AppText
                      variant="caption"
                      weight={titleWeight}
                      dir="ltr"
                      style={{ color: accent, fontVariant: ['tabular-nums'] }}
                    >
                      {`${pct}%`}
                    </AppText>
                  }
                >
                  <View style={{ gap: theme.spacing.md }}>
                    <View style={productionInsetStyle(theme, colors)}>
                      <AppText variant="caption" color="muted">
                        {detail.progressLabel?.trim() ||
                          t('mobile.production.progress')}
                      </AppText>
                      <WorkflowProgressHit
                        progressPercent={pct}
                        height={8}
                        accessibilityLabel={t('mobile.production.progress')}
                      />
                      {detail.dealerName ? (
                        <MetaRow
                          isRTL={isRTL}
                          label={t('mobile.production.dealer')}
                          value={detail.dealerName}
                        />
                      ) : null}
                      {detail.deliveryLabel ? (
                        <MetaRow
                          isRTL={isRTL}
                          label={t('mobile.production.deliveryDate')}
                          value={detail.deliveryLabel}
                          valueColor={detail.isLate ? colors.error : undefined}
                        />
                      ) : null}
                    </View>

                    <AppText variant="caption" color="muted">
                      {t('mobile.production.setup.teamJourneyHint')}
                    </AppText>

                    <View style={{ gap: theme.spacing.sm }}>
                      {executableTasks.map((item, index) => {
                        const row =
                          detail.tasks.find((t) => t.id === item.task.id) ?? null;
                        if (!row) return null;
                        return (
                          <ListItemEnter key={item.task.id} index={index}>
                            <ProductionTaskCard
                              task={row}
                              onPress={() => openTaskExecution(row, 'plan')}
                            />
                          </ListItemEnter>
                        );
                      })}
                      {executableTasks.length === 0 ? (
                        <View style={{ gap: theme.spacing.sm }}>
                          <AppText variant="caption" color="muted">
                            {t('mobile.production.setup.noExecutableTasks')}
                          </AppText>
                          {canUpdate ? (
                            <SecondaryButton
                              label={t(
                                'mobile.production.setup.retryPrepareStages',
                              )}
                              loading={ensurePlanMutation.isPending}
                              onPress={retryPrepareStages}
                            />
                          ) : null}
                        </View>
                      ) : null}
                      {startReasons.length > 0 ? (
                        <View
                          style={{
                            padding: theme.spacing.md,
                            borderRadius: theme.radius.lg,
                            borderWidth: 1,
                            borderColor: colors.error,
                            backgroundColor: colors.errorSoft,
                            gap: theme.spacing.xs,
                          }}
                        >
                          <AppText
                            variant="label"
                            weight="semibold"
                            style={{ color: colors.error }}
                          >
                            {t('mobile.production.setup.notReadyTitle')}
                          </AppText>
                          {startReasons.map((reason) => (
                            <AppText
                              key={reason}
                              variant="caption"
                              style={{ color: colors.error }}
                            >
                              {reason}
                            </AppText>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  </View>
                </DealerBoard>
              </HeaderEnter>
            ) : null}

            {!showPlan ? (
              <HeaderEnter reduce={reduce} delay={60}>
                <DealerBoard
                  title={
                    detail.progressLabel?.trim() || t('mobile.production.progress')
                  }
                  titleWeight={titleWeight}
                  accentColor={accent}
                  trailing={
                    <AppText
                      variant="caption"
                      weight={titleWeight}
                      dir="ltr"
                      style={{ color: accent, fontVariant: ['tabular-nums'] }}
                    >
                      {`${pct}%`}
                    </AppText>
                  }
                >
                  <View style={productionInsetStyle(theme, colors)}>
                    <MetaRow
                      isRTL={isRTL}
                      label={t('mobile.production.dealer')}
                      value={detail.dealerName}
                    />
                    {!urgent ? (
                      <MetaRow
                        isRTL={isRTL}
                        label={t('mobile.production.priorityLabel')}
                        value={priorityText(detail.priority, t)}
                      />
                    ) : null}
                    {detail.deliveryLabel ? (
                      <MetaRow
                        isRTL={isRTL}
                        label={t('mobile.production.deliveryDate')}
                        value={detail.deliveryLabel}
                        valueColor={detail.isLate ? colors.error : undefined}
                      />
                    ) : null}
                  </View>

                  <WorkflowProgressHit
                    progressPercent={pct}
                    height={8}
                    accessibilityLabel={t('mobile.productionFlow.openWorkflow')}
                    onPress={() => {
                      void haptics.selection();
                      router.push(adminProductionFlowHref(detail.id));
                    }}
                    style={{ gap: theme.spacing.sm }}
                  >
                    <View
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        alignItems: 'center',
                        gap: 6,
                        alignSelf: isRTL ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <AppText variant="caption" weight="semibold" color="brand">
                        {t('mobile.productionFlow.openWorkflow')}
                      </AppText>
                      <Ionicons
                        name={isRTL ? 'chevron-back' : 'chevron-forward'}
                        size={14}
                        color={colors.brand}
                      />
                    </View>
                  </WorkflowProgressHit>
                </DealerBoard>
              </HeaderEnter>
            ) : null}

            {/* Legacy blockers list — skipped on Ready/Execution (Attention board owns human copy). */}
            {!showPlan &&
            !isReadyDossier &&
            !isExecutionDossier &&
            detail.openBlockers.length > 0 ? (
              <HeaderEnter reduce={reduce} delay={70}>
                <DealerBoard
                  title={t('mobile.production.blockers')}
                  titleWeight={titleWeight}
                  accentColor={colors.error}
                >
                  {detail.openBlockers.map((b) => (
                    <View
                      key={b.id}
                      style={productionInsetStyle(theme, colors)}
                    >
                      <AppText variant="body" weight={titleWeight}>
                        {b.taskName}
                      </AppText>
                      <AppText variant="caption" color="secondary">
                        {b.category}: {b.reason}
                      </AppText>
                      {canUnblock && b.taskId ? (
                        <PrimaryButton
                          label={t('mobile.production.resolveBlocker')}
                          onPress={() =>
                            setConfirmUnblock({
                              taskId: b.taskId,
                              name: b.taskName,
                            })
                          }
                          style={{
                            borderRadius: theme.radius.full,
                            minHeight: theme.sizes.touch.min,
                          }}
                        />
                      ) : null}
                    </View>
                  ))}
                </DealerBoard>
              </HeaderEnter>
            ) : null}

              </>
            ) : null}

            {hubSection === 'workflow' ? (
              <HeaderEnter reduce={reduce} delay={40}>
                <DealerBoard
                  title={t('mobile.production.hubJumpWorkflow')}
                  titleWeight={titleWeight}
                >
                  <AppText variant="caption" color="muted">
                    {canChangeWorkflow
                      ? t('mobile.productionSetup.planWorkflowHint')
                      : t('mobile.productionSetup.workflowLockedHint')}
                  </AppText>
                  <View style={productionInsetStyle(theme, colors)}>
                    <MetaRow
                      isRTL={isRTL}
                      label={t('mobile.production.hubJumpWorkflow')}
                      value={
                        currentWorkflowName ??
                        (currentWorkflowId
                          ? currentWorkflowId.slice(0, 8)
                          : t('mobile.productionSetup.noWorkflowSelected'))
                      }
                    />
                  </View>
                  {(query.data?.stages ?? []).length > 0 ? (
                    <View style={{ gap: theme.spacing.sm }}>
                      {(query.data?.stages ?? []).map((stage, index) => (
                        <View
                          key={stage.code ?? `stage-${index}`}
                          style={productionInsetStyle(theme, colors)}
                        >
                          <AppText variant="label" weight={titleWeight}>
                            {localizedName(
                              locale,
                              {
                                nameEn:
                                  stage.nameEn ??
                                  stage.stageDefinition?.nameEn ??
                                  null,
                                nameAr:
                                  stage.nameAr ??
                                  stage.stageDefinition?.nameAr ??
                                  null,
                                nameHe:
                                  stage.nameHe ??
                                  stage.stageDefinition?.nameHe ??
                                  null,
                              },
                              stage.code ?? stage.stageDefinition?.code ?? '—',
                            )}
                          </AppText>
                          <AppText variant="caption" color="muted">
                            {stage.code ?? stage.stageDefinition?.code ?? '—'}
                          </AppText>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {canChangeWorkflow ? (
                    <PrimaryButton
                      label={t('mobile.productionSetup.changeWorkflowCta')}
                      loading={assignWorkflowMutation.isPending}
                      disabled={assignWorkflowMutation.isPending}
                      onPress={() => {
                        void haptics.selection();
                        setWorkflowPickerOpen(true);
                      }}
                      style={{
                        borderRadius: theme.radius.xl,
                        ...productionBoardShadow(colorScheme),
                      }}
                    />
                  ) : null}
                </DealerBoard>
              </HeaderEnter>
            ) : null}

            {hubSection === 'materials' ? (
              <HeaderEnter reduce={reduce} delay={40}>
                <View style={{ gap: theme.spacing.md }}>
                  <ProductionMaterialUsageBoard
                    materials={materialsQuery.data?.materials ?? []}
                  />
                </View>
              </HeaderEnter>
            ) : null}

            {hubSection === 'wip' ? (
              <HeaderEnter reduce={reduce} delay={40}>
                <View style={{ gap: theme.spacing.md }}>
                  <ProductionWipSection
                    productionOrderId={orderId}
                    enabled={canRead}
                    onInspectKit={(kit) => setWipKit(kit)}
                  />
                </View>
              </HeaderEnter>
            ) : null}
          </View>
        }
        ListFooterComponent={
          hubSection === 'overview' || hubSection === 'tasks' ? (
            <View style={{ gap: theme.spacing.lg, marginTop: theme.spacing.lg }}>
              <AdminScheduleStrip productionOrderId={detail.id} />
              <ProductionLifecycleStrip
                poStatus={detail.status}
                currentStageCode={query.data?.currentStage?.code ?? null}
                deliveryStatus={deliveryQuery.data?.status ?? null}
              />
              {/* Ready for Factory: Replan only — no priority/delivery free edits. */}
              {canUpdate && !isReadyDossier ? (
                <DealerBoard titleWeight={titleWeight}>
                  {(
                    [
                      {
                        key: 'priority',
                        label: t('mobile.production.changePriority'),
                        icon: 'flag-outline' as const,
                        onPress: () => setPriorityOpen(true),
                      },
                      {
                        key: 'delivery',
                        label: t('mobile.production.changeDelivery'),
                        icon: 'calendar-outline' as const,
                        onPress: () => setDeliveryOpen(true),
                      },
                    ] as const
                  ).map((action) => (
                    <AnimatedPressable
                      key={action.key}
                      variant="button"
                      accessibilityRole="button"
                      accessibilityLabel={action.label}
                      onPress={() => {
                        void haptics.selection();
                        action.onPress();
                      }}
                      style={{
                        minHeight: theme.sizes.touch.min,
                        borderRadius: theme.radius.lg,
                        paddingHorizontal: theme.spacing.md,
                        paddingVertical: theme.spacing.sm,
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        alignItems: 'center',
                        gap: theme.spacing.md,
                        backgroundColor: colors.surfaceSecondary,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: colors.brandSoft,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Ionicons
                          name={action.icon}
                          size={18}
                          color={colors.brand}
                        />
                      </View>
                      <AppText
                        variant="label"
                        weight={titleWeight}
                        style={{ flex: 1 }}
                      >
                        {action.label}
                      </AppText>
                      <Ionicons
                        name={isRTL ? 'chevron-back' : 'chevron-forward'}
                        size={18}
                        color={colors.textMuted}
                      />
                    </AnimatedPressable>
                  ))}
                </DealerBoard>
              ) : null}
              {hubSection === 'overview' ? (
                <ProductionWipSection
                  productionOrderId={orderId}
                  enabled={canRead}
                  onInspectKit={(kit) => setWipKit(kit)}
                />
              ) : null}
            </View>
          ) : null
        }
        ListEmptyComponent={
          !showPlan && (hubSection === 'tasks' || hubSection === 'overview') ? (
            <EmptyState
              title={t('mobile.production.emptyTasksTitle')}
              description={t('mobile.production.emptyTasksBody')}
            />
          ) : null
        }
        renderItem={({ item, index }) => (
          <ListItemEnter index={index}>
            <ProductionTaskCard
              task={item}
              onPress={() =>
                openTaskExecution(
                  item,
                  isExecutionDossier || isReadyDossier ? 'view' : 'plan',
                )
              }
              onOpenFloor={() => {
                void haptics.selection();
                router.push(
                  `/(app)/(admin)/production/tasks/${item.id}?orderId=${orderId}` as Href,
                );
              }}
            />
          </ListItemEnter>
        )}
      />

      <ProductionWipKitSheet
        open={Boolean(wipKit)}
        kit={wipKit}
        onClose={() => setWipKit(null)}
      />

      <ProductionManageSheet
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        allowRescheduleFuture={Boolean(
          sheetTask &&
            !sheetTask.actualStart &&
            sheetTask.status !== 'IN_PROGRESS' &&
            sheetTask.status !== 'COMPLETED',
        )}
        onSelect={(action: ManageExceptionAction) => {
          setManageOpen(false);
          if (!sheetTask) return;
          // Explicit exception only — opens assign/window editing, no auto-replan.
          if (
            action === 'change_worker' ||
            action === 'change_datetime' ||
            action === 'reschedule_future'
          ) {
            openTaskExecution(sheetTask, 'manage');
          }
        }}
      />

      <ImageViewer
        open={imageOpen}
        uris={detail.imageUrl ? [detail.imageUrl] : []}
        index={0}
        onClose={() => setImageOpen(false)}
        title={detail.title}
      />
      <ProductionTaskSheet
        open={Boolean(sheetTask)}
        onClose={() => {
          setActiveTask(null);
          setAssignWindow({});
          setScheduleConflict(null);
          setTaskSheetIntent(showPlan ? 'plan' : 'view');
        }}
        task={sheetTask}
        workers={workersQuery.data ?? []}
        workersLoading={workersQuery.isLoading && !workersQuery.data}
        canAssign={canAssign}
        canUpdateTask={canUpdateTask}
        intent={
          isReadyDossier
            ? 'view'
            : isExecutionDossier
              ? taskSheetIntent === 'manage'
                ? 'manage'
                : 'view'
              : 'plan'
        }
        onRequestManage={
          isReadyDossier
            ? undefined
            : () => {
                setManageOpen(true);
              }
        }
        canOverrideConflict={canOverrideConflict}
        assignLoading={assignMutation.isPending}
        notesLoading={notesMutation.isPending}
        holdLoading={pauseMutation.isPending}
        blockLoading={blockMutation.isPending}
        scheduleConflict={scheduleConflict}
        onClearScheduleConflict={() => setScheduleConflict(null)}
        onWindowChange={setAssignWindow}
        onAssign={(payload) => {
          if (!sheetTask) return;
          assignMutation.mutate(
            {
              taskId: sheetTask.id,
              employeeId: payload.employeeId,
              priority: payload.priority,
              plannedStart: payload.plannedStart,
              plannedCompletion: payload.plannedCompletion,
              estimatedMinutes: payload.estimatedMinutes,
              overrideConflict: payload.overrideConflict,
            },
            {
              onSuccess: () => {
                void haptics.confirmMedium();
                setActiveTask(null);
                setAssignWindow({});
                setScheduleConflict(null);
                showToast({
                  variant: 'success',
                  message: t('mobile.production.assignSuccess'),
                });
              },
              onError: (err) => {
                void haptics.error();
                if (isApiError(err) && err.code === 'WORKER_SCHEDULE_CONFLICT') {
                  setScheduleConflict({
                    conflicts: Array.isArray(err.details.conflicts)
                      ? (err.details.conflicts as Array<{
                          kind?: string;
                          id?: string;
                          label?: string;
                          start?: string;
                          end?: string;
                        }>)
                      : [],
                    suggestedWindow:
                      err.details.suggestedWindow &&
                      typeof err.details.suggestedWindow === 'object'
                        ? (err.details.suggestedWindow as {
                            plannedStart: string;
                            plannedCompletion: string;
                          })
                        : null,
                  });
                  return;
                }
                showToast({
                  variant: 'error',
                  message: isApiError(err)
                    ? toastMessageForError(err)
                    : t('mobile.production.assignFailed'),
                });
              },
            },
          );
        }}
        onSaveNotes={(notes) => {
          if (!sheetTask) return;
          notesMutation.mutate(
            { taskId: sheetTask.id, notes },
            {
              onSuccess: () => {
                void haptics.confirmMedium();
                showToast({
                  variant: 'success',
                  message: t('mobile.production.workerInstructionsSaved'),
                });
              },
              onError: () => {
                void haptics.error();
                showToast({
                  variant: 'error',
                  message: t('mobile.production.updateFailed'),
                });
              },
            },
          );
        }}
        onHold={() => {
          if (!sheetTask) return;
          pauseMutation.mutate(sheetTask.id, {
            onSuccess: () => {
              void haptics.confirmMedium();
              setActiveTask(null);
              showToast({
                variant: 'success',
                message: t('mobile.production.holdSuccess'),
              });
            },
            onError: () => {
              void haptics.error();
              showToast({
                variant: 'error',
                message: t('mobile.production.updateFailed'),
              });
            },
          });
        }}
        onBlock={(reason) => {
          if (!sheetTask) return;
          blockMutation.mutate(
            { taskId: sheetTask.id, category: 'OTHER', reason },
            {
              onSuccess: () => {
                void haptics.confirmMedium();
                setActiveTask(null);
                showToast({
                  variant: 'success',
                  message: t('mobile.production.blockSuccess'),
                });
              },
              onError: () => {
                void haptics.error();
                showToast({
                  variant: 'error',
                  message: t('mobile.production.updateFailed'),
                });
              },
            },
          );
        }}
      />

      <PrioritySheet
        open={priorityOpen}
        onClose={() => setPriorityOpen(false)}
        current={detail.priority}
        loading={updateMutation.isPending}
        onSubmit={(priority) => {
          updateMutation.mutate(
            { priority },
            {
              onSuccess: () => {
                void haptics.confirmMedium();
                setPriorityOpen(false);
                showToast({
                  variant: 'success',
                  message: t('mobile.production.updateSuccess'),
                });
              },
              onError: () => {
                void haptics.error();
                showToast({
                  variant: 'error',
                  message: t('mobile.production.updateFailed'),
                });
              },
            },
          );
        }}
      />

      <DeliveryDateSheet
        open={deliveryOpen}
        onClose={() => setDeliveryOpen(false)}
        current={detail.requiredDeliveryDate}
        loading={updateMutation.isPending}
        onSubmit={(isoDate) => {
          updateMutation.mutate(
            { requiredDeliveryDate: isoDate },
            {
              onSuccess: () => {
                void haptics.confirmMedium();
                setDeliveryOpen(false);
                showToast({
                  variant: 'success',
                  message: t('mobile.production.updateSuccess'),
                });
              },
              onError: () => {
                void haptics.error();
                showToast({
                  variant: 'error',
                  message: t('mobile.production.updateFailed'),
                });
              },
            },
          );
        }}
      />

      <ConfirmationSheet
        open={Boolean(confirmUnblock)}
        onClose={() => setConfirmUnblock(null)}
        title={t('mobile.production.resolveBlocker')}
        message={t('mobile.production.resolveBlockerConfirm', {
          name: confirmUnblock?.name ?? '',
        })}
        confirmLabel={t('mobile.production.confirm')}
        cancelLabel={t('mobile.production.cancel')}
        onConfirm={() => {
          if (!confirmUnblock) return;
          unblockMutation.mutate(confirmUnblock.taskId, {
            onSuccess: () => {
              void haptics.confirmMedium();
              showToast({
                variant: 'success',
                message: t('mobile.production.blockerResolved'),
              });
            },
            onError: () => {
              void haptics.error();
              showToast({
                variant: 'error',
                message: t('mobile.production.updateFailed'),
              });
            },
          });
        }}
      />

      <WorkflowPickerSheet
        open={workflowPickerOpen}
        onClose={() => setWorkflowPickerOpen(false)}
        selectedId={currentWorkflowId}
        onPick={(workflow) => {
          setWorkflowPickerOpen(false);
          if (workflow.id === currentWorkflowId) return;
          assignWorkflowMutation.mutate(workflow.id, {
            onSuccess: () => {
              void haptics.confirmLight();
              showToast({
                variant: 'success',
                message: t('mobile.productionSetup.workflowRebuilt'),
              });
              void query.refetch();
              setHubSection('tasks');
            },
            onError: (err) => {
              void haptics.error();
              showToast({
                variant: 'error',
                message: isApiError(err)
                  ? toastMessageForError(err)
                  : t('mobile.productionSetup.actionFailed'),
              });
            },
          });
        }}
      />

      <ConfirmationSheet
        open={releaseConfirmOpen}
        onClose={() => setReleaseConfirmOpen(false)}
        title={
          host === 'orders'
            ? t('mobile.orders.journey.confirmPlan')
            : t('mobile.production.setup.releaseConfirmTitle')
        }
        message={[
          host === 'orders'
            ? t('mobile.production.setup.releaseConfirmBody')
            : t('mobile.production.setup.releaseConfirmBody'),
          ...releaseSummaryLines,
        ].join('\n')}
        confirmLabel={
          host === 'orders'
            ? t('mobile.orders.journey.confirmPlan')
            : t('mobile.production.setup.releaseToFactory')
        }
        cancelLabel={t('mobile.production.cancel')}
        onConfirm={onRelease}
      />

      <ConfirmationSheet
        open={replanConfirmOpen}
        onClose={() => setReplanConfirmOpen(false)}
        title={t('mobile.production.replan.title')}
        message={[
          t('mobile.production.replan.body'),
          t('mobile.production.replan.deliveryUnchanged'),
          ...releaseSummaryLines,
        ].join('\n')}
        confirmLabel={t('mobile.production.replan.confirm')}
        cancelLabel={t('mobile.production.cancel')}
        onConfirm={() => {
          replanMutation.mutate(
            { reason: 'admin-replan' },
            {
              onSuccess: () => {
                void haptics.confirmMedium();
                setReplanConfirmOpen(false);
                seedOrdersDeskChip('preparing');
                showToast({
                  variant: 'success',
                  message: t('mobile.production.replan.success'),
                });
                if (salesOrderId) {
                  router.replace(
                    `/(app)/(admin)/orders/${salesOrderId}/production-plan` as Href,
                  );
                }
              },
              onError: (err) => {
                void haptics.error();
                showToast({
                  variant: 'error',
                  message: isApiError(err)
                    ? toastMessageForError(err)
                    : t('mobile.production.replan.failed'),
                });
              },
            },
          );
        }}
      />

      {replanDockVisible ? (
        <JourneyStickyDock floating>
          <PrimaryButton
            label={t('mobile.production.replan.cta')}
            loading={replanMutation.isPending}
            disabled={replanMutation.isPending}
            onPress={() => {
              void haptics.selection();
              setReplanConfirmOpen(true);
            }}
            style={{
              ...productionBoardShadow(colorScheme),
              borderRadius: theme.radius.xl,
            }}
          />
        </JourneyStickyDock>
      ) : null}

      {dockVisible ? (
        <JourneyStickyDock floating>
          <View style={{ gap: 6, width: '100%' }}>
            {shouldOpenPlanSheet({
              canStart: Boolean(readiness?.canStart),
              executableCount: executableTasks.length,
              canAssign,
              canUpdate,
            }) === 'release' ? (
              <PrimaryButton
                label={
                  host === 'orders'
                    ? t('mobile.orders.journey.confirmPlan')
                    : t('mobile.production.setup.releaseToFactory')
                }
                loading={startMutation.isPending}
                disabled={startMutation.isPending}
                onPress={() => {
                  void haptics.selection();
                  setReleaseConfirmOpen(true);
                }}
                style={{
                  ...productionBoardShadow(colorScheme),
                  borderRadius: theme.radius.xl,
                }}
              />
            ) : shouldOpenPlanSheet({
                canStart: Boolean(readiness?.canStart),
                executableCount: executableTasks.length,
                canAssign,
                canUpdate,
              }) === 'plan' ? (
              <>
                <SecondaryButton
                  label={t('mobile.production.setup.finishCta')}
                  onPress={openPlanSheet}
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.borderStrong,
                    borderWidth: 1,
                    borderRadius: theme.radius.xl,
                    minHeight: 52,
                    ...productionBoardShadow(colorScheme),
                  }}
                />
                {!readiness?.canStart ? (
                  <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
                    {t('mobile.production.setup.incompleteBody')}
                  </AppText>
                ) : null}
              </>
            ) : null}
          </View>
        </JourneyStickyDock>
      ) : null}
    </AppScreen>
  );
}

function MetaRow({
  label,
  value,
  isRTL,
  valueColor,
}: {
  label: string;
  value: string;
  isRTL: boolean;
  valueColor?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <AppText variant="caption" color="muted">
        {label}
      </AppText>
      <AppText
        variant="caption"
        weight="medium"
        numberOfLines={2}
        style={{
          flex: 1,
          textAlign: isRTL ? 'left' : 'right',
          color: valueColor ?? colors.textPrimary,
        }}
      >
        {value}
      </AppText>
    </View>
  );
}

function ReadinessRow({
  done,
  label,
  isRTL,
}: {
  done: boolean;
  label: string;
  isRTL: boolean;
}) {
  const { colors, theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        minHeight: theme.sizes.touch.min - 8,
      }}
    >
      <Ionicons
        name={done ? 'checkmark-circle' : 'ellipse-outline'}
        size={20}
        color={done ? colors.success : colors.borderStrong}
      />
      <AppText variant="body" weight="medium" style={{ flex: 1 }}>
        {label}
      </AppText>
    </View>
  );
}

function HeaderEnter({
  children,
  delay,
  reduce,
}: {
  children: ReactNode;
  delay: number;
  reduce: boolean;
}) {
  if (reduce) return <>{children}</>;
  // Timing enter — same soft settle as list cards / order press (no spring overshoot).
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(220)}>
      {children}
    </Animated.View>
  );
}
