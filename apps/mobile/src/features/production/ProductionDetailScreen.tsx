import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { findDeliveryForSalesOrder } from '@/api/modules/deliveries';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { FlatList, Image, RefreshControl, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { can, canAny } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { DeskCard, DeskSectionBand } from '@/components/desk';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { AppScreen } from '@/components/layout/AppScreen';
import { Divider } from '@/components/layout/Divider';
import { ImageViewer } from '@/components/media/ImageViewer';
import { useNetwork } from '@/components/network/NetworkProvider';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { JourneyStickyDock } from '@/features/sales-orders/components/journey/JourneyStickyDock';
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
import {
  AssignWorkerSheet,
  type AssignWorkerPayload,
} from './components/AssignWorkerSheet';
import { ProductionPlanAssignSheet } from './components/ProductionPlanAssignSheet';
import {
  DeliveryDateSheet,
  PrioritySheet,
} from './components/PriorityDeliverySheets';
import { ProductionListSkeleton } from './components/ProductionSkeleton';
import { ProductionMaterialUsageBoard } from './components/ProductionMaterialUsageBoard';
import { ProductionLifecycleStrip } from './components/ProductionLifecycleStrip';
import { AdminScheduleStrip } from './components/AdminScheduleStrip';
import { ProductionTaskCard } from './components/ProductionTaskCard';
import { ProductionTaskSheet } from './components/ProductionTaskSheet';
import {
  ProductionHubJump,
  type ProductionHubSection,
} from './components/ProductionHubJump';
import { ProductionWipSection } from './components/ProductionWipSection';
import { ProductionWipKitSheet } from './components/ProductionWipKitSheet';
import { productionBoardShadow } from './productionFloorStyle';
import { shouldOpenPlanSheet } from './planCta';
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
  useUnblockTaskMutation,
  useUpdateProductionMutation,
  useUpdateTaskNotesMutation,
} from './query';
import {
  selectProductionDetail,
  workersForStage,
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
};

const HERO = 96;

function priorityText(priority: string, t: (key: string) => string): string {
  const key = `mobile.production.priority.${priority}`;
  const label = t(key);
  return label === key ? priority : label;
}

export function ProductionDetailScreen({ orderId }: ProductionDetailScreenProps) {
  const { user } = useAuth();
  const { t, locale, isRTL, formatDateTime, formatCurrency } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const router = useRouter();
  const reduce = useReducedMotion();

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
  const [assignTaskId, setAssignTaskId] = useState<string | null>(null);
  const [assignWindow, setAssignWindow] = useState<{
    plannedStart?: string;
    plannedCompletion?: string;
  }>({});
  const [planSheetOpen, setPlanSheetOpen] = useState(false);
  const [prepareFailed, setPrepareFailed] = useState(false);
  const [releaseConfirmOpen, setReleaseConfirmOpen] = useState(false);
  const [startReasons, setStartReasons] = useState<string[]>([]);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [confirmUnblock, setConfirmUnblock] = useState<{
    taskId: string;
    name: string;
  } | null>(null);
  const [viewCompleted, setViewCompleted] = useState(false);
  const [hubSection, setHubSection] = useState<ProductionHubSection>('overview');
  const [wipKit, setWipKit] = useState<WipKitCard | null>(null);

  const query = useProductionOrderQuery(orderId, canRead);
  const deliveryQuery = useQuery({
    queryKey: ['production-order-delivery', query.data?.salesOrder?.number],
    queryFn: () => findDeliveryForSalesOrder(query.data!.salesOrder!.number),
    enabled: Boolean(query.data?.salesOrder?.number),
    staleTime: 30_000,
  });
  const materialsQuery = useProductionMaterialUsageQuery(orderId, canRead);
  const workersQuery = useAssignableWorkersQuery(
    canAssign && Boolean(assignTaskId),
    undefined,
    undefined,
    assignTaskId
      ? {
          taskId: assignTaskId,
          plannedStart: assignWindow.plannedStart,
          plannedCompletion: assignWindow.plannedCompletion,
        }
      : undefined,
  );
  const assignMutation = useAssignTaskMutation(orderId);
  const startMutation = useStartProductionMutation(orderId);
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
  const isStartable = Boolean(
    detail && STARTABLE_STATUSES.has(String(detail.status).toUpperCase()),
  );
  const showPlan = isStartable && canSetup;

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
        plannedStart: row?.plannedStart ?? task.plannedStart ?? null,
        plannedCompletion:
          row?.plannedCompletion ?? task.plannedCompletion ?? null,
        dependsOnCodes: row?.dependsOnCodes ?? [],
      };
    });
  }, [query.data, detail]);

  const assignTarget = useMemo(
    () => executableTasks.find((t) => t.task.id === assignTaskId) ?? null,
    [assignTaskId, executableTasks],
  );

  const stageWorkers = useMemo(
    () => workersForStage(workersQuery.data ?? [], assignTarget?.department),
    [workersQuery.data, assignTarget?.department],
  );

  const missing = readiness?.assignment.missing ?? [];

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

  const pct = Math.max(0, Math.min(100, Math.round(detail.progressPercent || 0)));
  const urgent = detail.priority === 'URGENT' || detail.priority === 'HIGH';
  const accent = detail.isLate
    ? colors.error
    : urgent
      ? colors.warning
      : colors.brand;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const boardShadow = productionBoardShadow(colorScheme);
  const dockVisible =
    showPlan && (hubSection === 'overview' || hubSection === 'tasks');
  const listBottomPad =
    theme.spacing['3xl'] +
    SURFACE_TAB_BAR_CLEARANCE +
    (dockVisible ? 72 : 0);

  const openAssign = (taskId: string) => {
    void haptics.selection();
    setAssignWindow({});
    setAssignTaskId(taskId);
  };

  const openPlanSheet = () => {
    void haptics.selection();
    setPrepareFailed(false);
    setPlanSheetOpen(true);
  };

  const retryPrepareStages = () => {
    setPrepareFailed(false);
    ensurePlanMutation.mutate(undefined, {
      onSuccess: (res) => {
        void query.refetch().then(() => {
          if ((res?.created ?? 0) === 0 && executableTasks.length === 0) {
            setPrepareFailed(true);
          }
        });
      },
      onError: () => {
        setPrepareFailed(true);
        showToast({
          variant: 'error',
          message: t('mobile.production.setup.stagesPrepareFailed'),
        });
      },
    });
  };

  const assignMissing = () => {
    openPlanSheet();
  };

  const onPlanAssignSubmit = (payload: AssignWorkerPayload) => {
    if (!assignTaskId) return;
    assignMutation.mutate(
      {
        taskId: assignTaskId,
        employeeId: payload.employeeId,
        plannedStart: payload.plannedStart,
        plannedCompletion: payload.plannedCompletion,
        estimatedMinutes: payload.estimatedMinutes,
        overrideConflict: payload.overrideConflict,
      },
      {
        onSuccess: () => {
          void haptics.confirmMedium();
          setAssignTaskId(null);
          setStartReasons([]);
          showToast({
            variant: 'success',
            message: t('mobile.production.assignSuccess'),
          });
        },
        onError: (err) => {
          void haptics.error();
          showToast({
            variant: 'error',
            message: isApiError(err)
              ? toastMessageForError(err)
              : t('mobile.production.assignFailed'),
          });
        },
      },
    );
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
        data={hubSection === 'tasks' || hubSection === 'overview' ? taskRows : []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: listBottomPad,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl
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
              <ProductionHubJump active={hubSection} onChange={setHubSection} />
            </HeaderEnter>

            {canReadMfgCost && query.data?.manufacturingCosting && hubSection === 'overview' ? (
              <HeaderEnter reduce={reduce} delay={20}>
                <DeskSectionBand>
                  <AppText variant="label">{t('mobile.orderDetail.mfgCostTitle')}</AppText>
                  <AppText variant="caption" color="secondary">
                    {(() => {
                      const st = String(query.data.manufacturingCosting.status ?? '').toUpperCase();
                      if (st === 'FINAL') return t('mobile.orderDetail.mfgCostStatusFinal');
                      if (st === 'IN_PROGRESS') return t('mobile.orderDetail.mfgCostStatusInProgress');
                      if (st === 'INCOMPLETE') return t('mobile.orderDetail.mfgCostStatusIncomplete');
                      return t('mobile.orderDetail.mfgCostStatusEstimatedOnly');
                    })()}
                  </AppText>
                  <AppText variant="caption" color="muted">
                    {t('mobile.orderDetail.mfgCostEstimated')}:{' '}
                    {query.data.manufacturingCosting.estimatedTotal != null
                      ? formatCurrency(query.data.manufacturingCosting.estimatedTotal)
                      : t('mobile.orderDetail.mfgCostUnavailable')}
                  </AppText>
                  <AppText variant="caption" color="muted">
                    {t('mobile.orderDetail.mfgCostActual')}:{' '}
                    {query.data.manufacturingCosting.actualTotal != null
                      ? formatCurrency(query.data.manufacturingCosting.actualTotal)
                      : t('mobile.orderDetail.mfgCostUnavailable')}
                  </AppText>
                  <AppText variant="caption" color="muted">
                    {t('mobile.orderDetail.mfgCostVariance')}:{' '}
                    {query.data.manufacturingCosting.varianceCost != null
                      ? formatCurrency(query.data.manufacturingCosting.varianceCost)
                      : t('mobile.orderDetail.mfgCostUnavailable')}
                  </AppText>
                </DeskSectionBand>
              </HeaderEnter>
            ) : null}

            {hubSection === 'overview' || hubSection === 'tasks' ? (
              <>
            <HeaderEnter reduce={reduce} delay={0}>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  gap: theme.spacing.md,
                  alignItems: 'flex-start',
                }}
              >
                <AnimatedPressable
                  variant="card"
                  disabled={!detail.imageUrl}
                  accessibilityRole={detail.imageUrl ? 'button' : 'image'}
                  accessibilityLabel={detail.title}
                  onPress={() => {
                    if (!detail.imageUrl) return;
                    void haptics.selection();
                    setImageOpen(true);
                  }}
                  style={{
                    width: HERO,
                    height: HERO,
                    borderRadius: theme.radius.xl,
                    backgroundColor: colors.surfaceSecondary,
                    overflow: 'hidden',
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {detail.imageUrl ? (
                    <>
                      <Image
                        source={{ uri: detail.imageUrl }}
                        style={{ width: HERO, height: HERO }}
                        resizeMode="cover"
                        accessibilityIgnoresInvertColors
                      />
                      <View
                        pointerEvents="none"
                        style={{
                          position: 'absolute',
                          right: 8,
                          bottom: 8,
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'rgba(30,26,27,0.55)',
                        }}
                      >
                        <Ionicons name="expand-outline" size={14} color="#F5F2EA" />
                      </View>
                    </>
                  ) : (
                    <Ionicons name="cube-outline" size={32} color={colors.brand} />
                  )}
                </AnimatedPressable>
                <View
                  style={{
                    flex: 1,
                    minWidth: 0,
                    gap: theme.spacing.xs,
                    alignItems: isRTL ? 'flex-end' : 'flex-start',
                  }}
                >
                  <AppText variant="title" weight={titleWeight} numberOfLines={1} dir="ltr">
                    {detail.number}
                  </AppText>
                  <AppText variant="body" weight="medium" numberOfLines={2}>
                    {detail.title}
                  </AppText>
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      flexWrap: 'wrap',
                      gap: theme.spacing.sm,
                      alignItems: 'center',
                      marginTop: 2,
                    }}
                  >
                    <StatusBadge status={detail.status} />
                    {urgent ? (
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: theme.radius.sm,
                          backgroundColor: colors.warningSoft,
                        }}
                      >
                        <AppText
                          variant="caption"
                          weight="semibold"
                          style={{
                            color: colors.warning,
                            fontSize: 11,
                            lineHeight: 14,
                          }}
                        >
                          {priorityText(detail.priority, t)}
                        </AppText>
                      </View>
                    ) : null}
                    {detail.isLate ? (
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: theme.radius.sm,
                          backgroundColor: colors.errorSoft,
                        }}
                      >
                        <AppText
                          variant="caption"
                          weight="semibold"
                          style={{
                            color: colors.error,
                            fontSize: 11,
                            lineHeight: 14,
                          }}
                        >
                          {t('mobile.production.late')}
                        </AppText>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            </HeaderEnter>

            {(canAssign || canUpdate) && showPlan ? (
              <HeaderEnter reduce={reduce} delay={40}>
                <View style={{ gap: theme.spacing.xs }}>
                  <AppText
                    variant="caption"
                    weight={locale === 'ar' ? 'regular' : 'medium'}
                    style={{
                      letterSpacing: locale === 'ar' ? 0 : 1.2,
                      textTransform: locale === 'ar' ? 'none' : 'uppercase',
                      color: colors.brand,
                    }}
                  >
                    {t('mobile.production.setup.eyebrow')}
                  </AppText>
                  <AppText variant="heading" weight={titleWeight}>
                    {t('mobile.production.setup.title')}
                  </AppText>
                  <AppText variant="caption" color="muted">
                    {t('mobile.production.setup.subtitle')}
                  </AppText>
                </View>
              </HeaderEnter>
            ) : null}

            {readiness && showPlan ? (
              <HeaderEnter reduce={reduce} delay={50}>
                <DeskSectionBand>
                  <AppText variant="caption" weight="semibold" color="brand">
                    {t('mobile.production.setup.readinessTitle')}
                  </AppText>
                  <View
                    style={{
                      marginTop: theme.spacing.sm,
                      gap: theme.spacing.xs,
                    }}
                  >
                    {(
                      [
                        {
                          ok: readiness.setupReady ?? true,
                          label: t('mobile.production.setup.readinessSetup'),
                        },
                        {
                          ok: readiness.workflowReady,
                          label: t('mobile.production.setup.readinessWorkflow'),
                        },
                        {
                          ok: readiness.materialsReady,
                          label: t('mobile.production.setup.readinessMaterials'),
                        },
                        {
                          ok: readiness.assignment.missing.length === 0,
                          label: t('mobile.production.setup.readinessTeam', {
                            assigned: readiness.assignment.assigned,
                            required: readiness.assignment.required,
                          }),
                        },
                        {
                          ok: datesReady,
                          label: t('mobile.production.setup.readinessDates', {
                            ready: datesAssigned,
                            required:
                              datesRequired || readiness.assignment.required,
                          }),
                        },
                      ] as const
                    ).map((row) => (
                      <View
                        key={row.label}
                        style={{
                          flexDirection: isRTL ? 'row-reverse' : 'row',
                          alignItems: 'center',
                          gap: theme.spacing.sm,
                        }}
                      >
                        <Ionicons
                          name={row.ok ? 'checkmark-circle' : 'ellipse-outline'}
                          size={16}
                          color={row.ok ? colors.success : colors.textMuted}
                        />
                        <AppText
                          variant="caption"
                          color={row.ok ? 'primary' : 'muted'}
                          style={{ flex: 1 }}
                        >
                          {row.label}
                        </AppText>
                      </View>
                    ))}
                  </View>
                </DeskSectionBand>
              </HeaderEnter>
            ) : readiness ? (
              <HeaderEnter reduce={reduce} delay={50}>
                <DeskSectionBand>
                  <AppText variant="caption" weight="semibold" color="brand">
                    {t('mobile.production.setup.readinessTitle')}
                  </AppText>
                  <View
                    style={{
                      marginTop: theme.spacing.sm,
                      gap: theme.spacing.xs,
                    }}
                  >
                    {(
                      [
                        {
                          ok: readiness.workflowReady,
                          label: t('mobile.production.setup.readinessWorkflow'),
                        },
                        {
                          ok: readiness.materialsReady,
                          label: t('mobile.production.setup.readinessMaterials'),
                        },
                        {
                          ok: readiness.assignment.missing.length === 0,
                          label: t('mobile.production.setup.readinessTeam', {
                            assigned: readiness.assignment.assigned,
                            required: readiness.assignment.required,
                          }),
                        },
                      ] as const
                    ).map((row) => (
                      <View
                        key={row.label}
                        style={{
                          flexDirection: isRTL ? 'row-reverse' : 'row',
                          alignItems: 'center',
                          gap: theme.spacing.sm,
                        }}
                      >
                        <Ionicons
                          name={row.ok ? 'checkmark-circle' : 'ellipse-outline'}
                          size={16}
                          color={row.ok ? colors.success : colors.textMuted}
                        />
                        <AppText
                          variant="caption"
                          color={row.ok ? 'primary' : 'muted'}
                          style={{ flex: 1 }}
                        >
                          {row.label}
                        </AppText>
                      </View>
                    ))}
                  </View>
                </DeskSectionBand>
              </HeaderEnter>
            ) : null}

            {showPlan ? (
              <HeaderEnter reduce={reduce} delay={55}>
                <DeskSectionBand>
                  <AppText variant="heading" weight="semibold">
                    {t('mobile.production.setup.teamJourney')}
                  </AppText>
                  <AppText
                    variant="caption"
                    color="muted"
                    style={{ marginBottom: theme.spacing.sm }}
                  >
                    {t('mobile.production.setup.teamJourneyHint')}
                  </AppText>
                  <View style={{ gap: theme.spacing.sm }}>
                    {executableTasks.map((item) => {
                      const parallel =
                        item.dependsOnCodes.length > 0
                          ? item.dependsOnCodes.join(' · ')
                          : null;
                      const plannedLabel = item.plannedStart
                        ? formatDateTime(item.plannedStart)
                        : item.plannedCompletion
                          ? formatDateTime(item.plannedCompletion)
                          : null;
                      return (
                        <DeskCard key={item.task.id} padded>
                          <View
                            style={{
                              flexDirection: isRTL ? 'row-reverse' : 'row',
                              alignItems: 'center',
                              gap: theme.spacing.md,
                            }}
                          >
                            <View style={{ flex: 1, gap: 2 }}>
                              {parallel ? (
                                <AppText variant="caption" color="brand">
                                  {t('mobile.production.setup.parallelBand', {
                                    deps: parallel,
                                  })}
                                </AppText>
                              ) : null}
                              <AppText
                                variant="body"
                                weight="semibold"
                                numberOfLines={2}
                              >
                                {item.name}
                              </AppText>
                              <AppText
                                variant="caption"
                                color={
                                  item.assigneeName ? 'secondary' : 'muted'
                                }
                              >
                                {item.assigneeName
                                  ? t('mobile.production.assignee', {
                                      name: item.assigneeName,
                                    })
                                  : t('mobile.production.unassigned')}
                              </AppText>
                              {plannedLabel ? (
                                <AppText variant="caption" color="muted">
                                  {`${t('mobile.production.plannedDate')}: ${plannedLabel}`}
                                </AppText>
                              ) : null}
                            </View>
                            {canAssign && item.canAssign ? (
                              <SecondaryButton
                                label={t('mobile.production.assign')}
                                onPress={() => openAssign(item.task.id)}
                                style={{ minWidth: 96 }}
                              />
                            ) : null}
                          </View>
                        </DeskCard>
                      );
                    })}
                    {executableTasks.length === 0 ? (
                      <View style={{ gap: theme.spacing.sm }}>
                        <AppText variant="caption" color="muted">
                          {t('mobile.production.setup.noExecutableTasks')}
                        </AppText>
                        {canUpdate ? (
                          <SecondaryButton
                            label={t('mobile.production.setup.retryPrepareStages')}
                            loading={ensurePlanMutation.isPending}
                            onPress={retryPrepareStages}
                          />
                        ) : null}
                      </View>
                    ) : null}
                  </View>

                  {startReasons.length > 0 ? (
                    <View
                      style={{
                        marginTop: theme.spacing.md,
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
                </DeskSectionBand>
              </HeaderEnter>
            ) : null}

            <HeaderEnter reduce={reduce} delay={60}>
              <View style={[{ borderRadius: theme.radius.xl }, boardShadow]}>
                <View
                  style={{
                    borderRadius: theme.radius.xl,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.borderStrong,
                    backgroundColor: colors.surface,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      height: 3,
                      backgroundColor: accent,
                      opacity: detail.isLate || urgent ? 1 : 0.55,
                    }}
                  />
                  <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
                    <MetaRow
                      isRTL={isRTL}
                      label={t('mobile.production.dealer')}
                      value={detail.dealerName}
                    />
                    <MetaRow
                      isRTL={isRTL}
                      label={t('mobile.production.priorityLabel')}
                      value={priorityText(detail.priority, t)}
                    />
                    {detail.deliveryLabel ? (
                      <MetaRow
                        isRTL={isRTL}
                        label={t('mobile.production.deliveryDate')}
                        value={detail.deliveryLabel}
                        valueColor={detail.isLate ? colors.error : undefined}
                      />
                    ) : null}

                    <Divider compact />

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
                          justifyContent: 'space-between',
                          gap: theme.spacing.md,
                        }}
                      >
                        <AppText
                          variant="label"
                          weight="semibold"
                          dir="ltr"
                          style={{ color: accent, fontVariant: ['tabular-nums'] }}
                        >
                          {`${pct}%`}
                        </AppText>
                        <AppText
                          variant="label"
                          weight="medium"
                          color="secondary"
                          numberOfLines={1}
                          style={{ flex: 1, textAlign: isRTL ? 'left' : 'right' }}
                        >
                          {detail.progressLabel?.trim() ||
                            t('mobile.production.progress')}
                        </AppText>
                      </View>
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
                  </View>
                </View>
              </View>
            </HeaderEnter>

            {detail.openBlockers.length > 0 ? (
              <HeaderEnter reduce={reduce} delay={70}>
                <View
                  style={{
                    borderRadius: theme.radius.xl,
                    borderWidth: 1,
                    borderColor: colors.error,
                    backgroundColor: colors.surface,
                    overflow: 'hidden',
                    ...boardShadow,
                    padding: theme.spacing.md,
                    gap: theme.spacing.md,
                  }}
                >
                  <AppText variant="heading" weight="semibold">
                    {t('mobile.production.blockers')}
                  </AppText>
                  <View style={{ gap: theme.spacing.md }}>
                    {detail.openBlockers.map((b) => (
                      <View key={b.id} style={{ gap: theme.spacing['2xs'] }}>
                        <AppText variant="body" weight="semibold">
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
                          />
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              </HeaderEnter>
            ) : null}

            <HeaderEnter reduce={reduce} delay={80}>
              <View style={{ gap: theme.spacing.md }}>
                {/* Task list filter — toggle, not a navigation row */}
                <View
                  style={{
                    borderRadius: theme.radius.xl,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.borderStrong,
                    backgroundColor: colors.surfaceSecondary,
                    padding: 6,
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    gap: 4,
                  }}
                >
                  {(
                    [
                      {
                        key: 'all',
                        active: !viewCompleted,
                        label: t('mobile.production.showAllTasks'),
                        onPress: () => setViewCompleted(false),
                      },
                      {
                        key: 'done',
                        active: viewCompleted,
                        label: t('mobile.production.viewTaskCompletion'),
                        onPress: () => setViewCompleted(true),
                      },
                    ] as const
                  ).map((chip) => (
                    <AnimatedPressable
                      key={chip.key}
                      variant="button"
                      accessibilityRole="button"
                      accessibilityState={{ selected: chip.active }}
                      accessibilityLabel={chip.label}
                      onPress={() => {
                        if (chip.active) return;
                        void haptics.selection();
                        chip.onPress();
                      }}
                      style={{
                        flex: 1,
                        minHeight: 40,
                        borderRadius: theme.radius.lg,
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingHorizontal: theme.spacing.sm,
                        backgroundColor: chip.active
                          ? colors.surface
                          : 'transparent',
                        borderWidth: chip.active ? 1 : 0,
                        borderColor: chip.active
                          ? colors.borderStrong
                          : 'transparent',
                        ...(chip.active
                          ? colorScheme === 'dark'
                            ? {
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.25,
                                shadowRadius: 4,
                              }
                            : {
                                shadowColor: '#1E1A1B',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.08,
                                shadowRadius: 3,
                              }
                          : null),
                      }}
                    >
                      <AppText
                        variant="caption"
                        weight={chip.active ? 'semibold' : 'medium'}
                        numberOfLines={1}
                        style={{
                          color: chip.active
                            ? colors.brand
                            : colors.textMuted,
                          textAlign: 'center',
                        }}
                      >
                        {chip.label}
                      </AppText>
                    </AnimatedPressable>
                  ))}
                </View>
                <AppText variant="heading" weight="semibold">
                  {viewCompleted
                    ? t('mobile.production.completedTasks')
                    : t('mobile.production.tasks')}
                </AppText>
              </View>
            </HeaderEnter>
              </>
            ) : null}

            {hubSection === 'materials' ? (
              <HeaderEnter reduce={reduce} delay={40}>
                <ProductionMaterialUsageBoard
                  materials={materialsQuery.data?.materials ?? []}
                />
              </HeaderEnter>
            ) : null}

            {hubSection === 'wip' ? (
              <HeaderEnter reduce={reduce} delay={40}>
                <ProductionWipSection
                  productionOrderId={orderId}
                  enabled={canRead}
                  onInspectKit={(kit) => setWipKit(kit)}
                />
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
              {canUpdate ? (
                <View style={[{ borderRadius: theme.radius.xl }, boardShadow]}>
                  <View
                    style={{
                      borderRadius: theme.radius.xl,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: colors.borderStrong,
                      backgroundColor: colors.surface,
                      overflow: 'hidden',
                    }}
                  >
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
                    ).map((action, index, list) => {
                      const last = index === list.length - 1;
                      return (
                        <View key={action.key}>
                          <AnimatedPressable
                            variant="button"
                            accessibilityRole="button"
                            accessibilityLabel={action.label}
                            onPress={() => {
                              void haptics.selection();
                              action.onPress();
                            }}
                            style={{
                              minHeight: theme.sizes.touch.min,
                              paddingHorizontal: theme.spacing.lg,
                              paddingVertical: theme.spacing.md,
                              flexDirection: isRTL ? 'row-reverse' : 'row',
                              alignItems: 'center',
                              gap: theme.spacing.md,
                              backgroundColor: colors.surface,
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
                              weight="medium"
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
                          {!last ? (
                            <View
                              style={{
                                height: StyleSheet.hairlineWidth,
                                backgroundColor: colors.border,
                                marginLeft: isRTL ? theme.spacing.lg : 68,
                                marginRight: isRTL ? 68 : theme.spacing.lg,
                              }}
                            />
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                </View>
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
          hubSection === 'tasks' || hubSection === 'overview' ? (
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
              onPress={() => setActiveTask(item)}
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

      <ImageViewer
        open={imageOpen}
        uris={detail.imageUrl ? [detail.imageUrl] : []}
        index={0}
        onClose={() => setImageOpen(false)}
        title={detail.title}
      />
      <ProductionTaskSheet
        open={Boolean(sheetTask)}
        onClose={() => setActiveTask(null)}
        task={sheetTask}
        workers={workersQuery.data ?? []}
        canAssign={canAssign}
        canUpdateTask={canUpdateTask}
        assignLoading={assignMutation.isPending}
        notesLoading={notesMutation.isPending}
        holdLoading={pauseMutation.isPending}
        blockLoading={blockMutation.isPending}
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
                showToast({
                  variant: 'success',
                  message: t('mobile.production.assignSuccess'),
                });
              },
              onError: () => {
                void haptics.error();
                showToast({
                  variant: 'error',
                  message: t('mobile.production.assignFailed'),
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
                  message: t('mobile.production.notesSaved'),
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

      <ProductionPlanAssignSheet
        open={planSheetOpen}
        onClose={() => setPlanSheetOpen(false)}
        title={t('mobile.production.setup.title')}
        subtitle={`${detail.number} · ${detail.title}`}
        canAssign={canAssign}
        loading={ensurePlanMutation.isPending || query.isFetching}
        prepareFailed={prepareFailed}
        onRetryPrepare={canUpdate ? retryPrepareStages : undefined}
        stages={executableTasks.map((item) => ({
          taskId: item.task.id,
          name: item.name,
          assigneeName: item.assigneeName,
          plannedLabel: item.plannedStart
            ? formatDateTime(item.plannedStart)
            : item.plannedCompletion
              ? formatDateTime(item.plannedCompletion)
              : null,
          canAssign: item.canAssign,
          dependsOnCodes: item.dependsOnCodes,
        }))}
        onAssignStage={(taskId) => {
          setPlanSheetOpen(false);
          openAssign(taskId);
        }}
      />

      <AssignWorkerSheet
        open={Boolean(assignTaskId)}
        onClose={() => {
          setAssignTaskId(null);
          setAssignWindow({});
        }}
        workers={stageWorkers}
        loading={assignMutation.isPending || workersQuery.isFetching}
        canOverrideConflict={canOverrideConflict}
        title={
          assignTarget?.assigneeName
            ? t('mobile.production.reassignWorker')
            : t('mobile.production.assignWorker')
        }
        currentEmployeeId={assignTarget?.task.assignedEmployeeId}
        onWindowChange={setAssignWindow}
        onSubmit={onPlanAssignSubmit}
      />

      <ConfirmationSheet
        open={releaseConfirmOpen}
        onClose={() => setReleaseConfirmOpen(false)}
        title={t('mobile.production.setup.releaseConfirmTitle')}
        message={[
          t('mobile.production.setup.releaseConfirmBody'),
          ...releaseSummaryLines,
        ].join('\n')}
        confirmLabel={t('mobile.production.setup.releaseToFactory')}
        cancelLabel={t('mobile.production.cancel')}
        onConfirm={onRelease}
      />

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
                label={t('mobile.production.setup.releaseToFactory')}
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
