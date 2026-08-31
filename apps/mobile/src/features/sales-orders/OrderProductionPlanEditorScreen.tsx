import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import type { Href } from 'expo-router';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { localizedName } from '@maher/i18n';
import { can, canAny } from '@maher/permissions';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import type { ProductionSetupStage } from '@/api/modules/workflow';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useToast } from '@/components/feedback/Toast';
import { AppScreen } from '@/components/layout/AppScreen';
import { FloatingActionDock } from '@/components/layout/FloatingActionDock';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { BomFloorRow } from '@/features/catalog/components/BomFloorRow';
import { BomMaterialPickerSheet } from '@/features/catalog/components/BomMaterialPickerSheet';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { adminProductionFlowHref } from '@/features/production-flow/flowRoutes';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { seedOrdersDeskChip } from '@/features/sales-orders/ordersDeskContext';
import { WorkflowPickerSheet } from '@/features/sales-orders/production-setup/components/WorkflowPickerSheet';
import { ProductionTaskSheet } from '@/features/production/components/ProductionTaskSheet';
import {
  useAssignableWorkersQuery,
  useAssignTaskMutation,
  useEnsurePlanTasksMutation,
  useOrderPlanSetupQuery,
  usePutOrderPlanSetupMutation,
  useStartProductionMutation,
  useUpdateTaskNotesMutation,
} from '@/features/production/query';
import {
  type ProductionTaskRow,
} from '@/features/production/selectProduction';
import type { OrderPlanSetupTask } from '@/api/modules/production';
import { ProductionStageSetupSheet } from '@/features/workflow/components/ProductionStageSetupSheet';
import {
  isPackagingSetupStage,
  produceKindFromBehavior,
  setupProduces,
  setupUsesSemi,
  terminalSetupMode,
} from '@/features/workflow/productionSetupBehavior';
import { useAssignOrderWorkflowMutation } from '@/features/workflow/query';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';

const MATERIALS_COLLAPSED = 5;
const DOCK_SCROLL_EXTRA = 132;

function planTaskToRow(
  task: OrderPlanSetupTask,
  canAssignTask: boolean,
  canEditNotes: boolean,
  locale: string,
): ProductionTaskRow {
  const stage = task.stageDefinition;
  const departmentLabel = stage
    ? localizedName(
        locale,
        {
          nameEn: stage.nameEn ?? null,
          nameAr: stage.nameAr ?? null,
          nameHe: stage.nameHe ?? null,
        },
        stage.code ?? stage.responsibleDepartment ?? '',
      ) || null
    : null;
  return {
    id: task.id,
    name: task.name,
    number: task.number,
    status: task.status,
    priority: 'NORMAL',
    progressPercent: 0,
    notes: task.notes?.trim() ?? '',
    assigneeId: task.assignedEmployeeId ?? null,
    assigneeName: task.assigneeName ?? null,
    departmentLabel,
    responsibleDepartment: stage?.responsibleDepartment ?? null,
    canAssign: canAssignTask,
    canHold: false,
    canBlock: false,
    canEditNotes,
    isCompleted: false,
    openBlockerCount: 0,
    elapsedMinutes: 0,
    estimatedMinutes: null,
    timingStatus: null,
    plannedStart: task.plannedStart ?? null,
    plannedCompletion: task.plannedCompletion ?? null,
    stageCode: stage?.code ?? null,
    stageDefinitionId: task.stageDefinitionId ?? stage?.id ?? null,
    dependsOnCodes: [],
  };
}

type BomDraft = {
  inventoryItemId?: string | null;
  sku: string;
  qty: number;
  unit: string;
  nameEn?: string | null;
  nameAr?: string | null;
  nameHe?: string | null;
  imageUrl?: string | null;
  category?: string | null;
  unitCost?: number;
};

type Props = {
  productionOrderId: string;
  salesOrderId: string;
};

function stageConfigured(stage: ProductionSetupStage): boolean {
  const mode = terminalSetupMode(stage.stageCode);
  if (mode === 'inspection' || mode === 'delivery') return true;
  if (mode === 'packaging') {
    return (
      stage.behavior === 'PRODUCES_FINISHED' &&
      Number(stage.output?.expectedPieceCount ?? 0) >= 1
    );
  }
  return (
    Boolean(stage.materialInputs?.length) ||
    setupProduces(stage.behavior) ||
    setupUsesSemi(stage.behavior) ||
    stage.behavior === 'NONE'
  );
}

function Chip({
  label,
  tone = 'muted',
}: {
  label: string;
  tone?: 'muted' | 'brand' | 'success';
}) {
  const { colors, theme } = useTheme();
  const bg =
    tone === 'brand'
      ? colors.brandSoft
      : tone === 'success'
        ? colors.successSoft
        : colors.surfaceSecondary;
  const fg =
    tone === 'brand' ? colors.brand : tone === 'success' ? colors.success : colors.textMuted;
  return (
    <View
      style={{
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 4,
        borderRadius: theme.radius.lg,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <AppText variant="caption" weight="semibold" style={{ color: fg }}>
        {label}
      </AppText>
    </View>
  );
}

function FloorActionRow({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  return (
    <AnimatedPressable
      variant="button"
      disabled={disabled}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        minHeight: theme.sizes.touch.min,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surfaceSecondary,
        paddingHorizontal: theme.spacing.md,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        opacity: disabled ? 0.5 : 1,
        ...orderBoardShadow(colorScheme),
      }}
    >
      <AppText
        variant="label"
        weight={titleWeight}
        color="brand"
        style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
      >
        {label}
      </AppText>
      <Ionicons
        name={isRTL ? 'chevron-back' : 'chevron-forward'}
        size={18}
        color={colors.brand}
      />
    </AnimatedPressable>
  );
}

function StageRow({
  stage,
  stepLabel,
  isLast,
  packagingPackageCount,
  onPress,
}: {
  stage: ProductionSetupStage;
  stepLabel: string;
  isLast: boolean;
  packagingPackageCount?: number | null;
  onPress: () => void;
}) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const mode = terminalSetupMode(stage.stageCode);
  const produce = produceKindFromBehavior(stage.behavior);
  const takesRaw =
    mode === 'inspection' || mode === 'delivery'
      ? false
      : stage.consumesRawMaterials ||
        stage.behavior === 'USES_MATERIALS' ||
        (stage.materialInputs?.length ?? 0) > 0;
  const takesSemi =
    mode === 'delivery'
      ? false
      : setupUsesSemi(stage.behavior) ||
        stage.consumesSemiFinished ||
        (stage.consumeOutputIds?.length ?? 0) > 0 ||
        (stage.consumeWorkflowNodeIds?.length ?? 0) > 0;
  const takesPackages = mode === 'delivery';
  const makes = mode === 'inspection' || mode === 'delivery' ? false : setupProduces(stage.behavior);
  const configured = stageConfigured(stage);
  const hasOutputName = Boolean(
    stage.output?.nameEn?.trim() ||
      stage.output?.nameAr?.trim() ||
      stage.output?.nameHe?.trim(),
  );
  const outputName = hasOutputName
    ? localizedName(locale, {
        nameEn: stage.output?.nameEn,
        nameAr: stage.output?.nameAr,
        nameHe: stage.output?.nameHe,
      })
    : '';

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: theme.spacing.sm,
        alignItems: 'stretch',
      }}
    >
      <View style={{ width: 28, alignItems: 'center' }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: configured ? colors.brandSoft : colors.surfaceSecondary,
            borderWidth: 1.5,
            borderColor: configured ? colors.brand : colors.borderStrong,
          }}
        >
          <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
            {stepLabel}
          </AppText>
        </View>
        {!isLast ? (
          <View
            style={{
              width: 2,
              flex: 1,
              minHeight: 12,
              marginTop: 4,
              backgroundColor: colors.brand,
              opacity: 0.35,
            }}
          />
        ) : null}
      </View>

      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={{
          flex: 1,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          marginBottom: theme.spacing.sm,
          ...orderBoardShadow(colorScheme),
        }}
      >
        <View
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
            backgroundColor: colors.surfaceSecondary,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <AppText
            variant="label"
            weight={titleWeight}
            numberOfLines={2}
            style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
          >
            {localizedName(locale, stage)}
          </AppText>
          <Ionicons
            name={isRTL ? 'chevron-back' : 'chevron-forward'}
            size={18}
            color={colors.textMuted}
          />
        </View>

        <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
          <View style={{ gap: 6 }}>
            <AppText
              variant="caption"
              color="muted"
              weight="semibold"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {t('production.setup.takesInTitle')}
            </AppText>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                flexWrap: 'wrap',
                gap: 6,
              }}
            >
              {takesPackages ? (
                <Chip
                  label={
                    packagingPackageCount != null && packagingPackageCount > 0
                      ? t('production.setup.chipPackagesIn', {
                          count: packagingPackageCount,
                        })
                      : t('production.setup.chipPackagesInMissing')
                  }
                  tone="brand"
                />
              ) : null}
              {(stage.materialInputs ?? []).length > 0
                ? (stage.materialInputs ?? []).slice(0, 4).map((row) => (
                    <Chip
                      key={row.sku}
                      label={`${row.sku} × ${row.qtyPerUnit}`}
                      tone="brand"
                    />
                  ))
                : null}
              {(stage.materialInputs?.length ?? 0) > 4 ? (
                <Chip
                  label={`+${(stage.materialInputs?.length ?? 0) - 4}`}
                  tone="brand"
                />
              ) : null}
              {takesRaw && !(stage.materialInputs?.length) ? (
                <Chip label={t('production.setup.chipMaterials')} tone="brand" />
              ) : null}
              {takesSemi ? <Chip label={t('production.setup.chipSemiIn')} tone="brand" /> : null}
              {!takesRaw && !takesSemi && !takesPackages ? (
                <Chip label={t('production.setup.chipTakesNothing')} />
              ) : null}
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <AppText
              variant="caption"
              color="muted"
              weight="semibold"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {t('production.setup.makesTitle')}
            </AppText>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                flexWrap: 'wrap',
                gap: 6,
              }}
            >
              {makes ? (
                <Chip
                  label={
                    produce === 'finished'
                      ? t('production.setup.chipFinished')
                      : t('production.setup.chipSemiOut')
                  }
                  tone="success"
                />
              ) : (
                <Chip label={t('production.setup.chipMakesNothing')} />
              )}
            </View>
            {outputName ? (
              <AppText
                variant="caption"
                color="muted"
                numberOfLines={1}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {outputName}
              </AppText>
            ) : null}
          </View>
        </View>
      </Pressable>
    </View>
  );
}

function PlanTaskRow({
  task,
  canOpen,
  onOpen,
}: {
  task: {
    id: string;
    name: string;
    status: string;
    notes?: string | null;
    assignedEmployeeId?: string | null;
    assigneeName?: string | null;
    plannedStart?: string | null;
    plannedCompletion?: string | null;
    stageDefinition?: {
      responsibleDepartment?: string | null;
      nameEn?: string | null;
      nameAr?: string | null;
      nameHe?: string | null;
      code?: string | null;
    } | null;
  };
  canOpen: boolean;
  onOpen: () => void;
}) {
  const { t, locale, isRTL, formatDateTime } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const assigned = Boolean(task.assignedEmployeeId || task.assigneeName);
  const accent = assigned ? colors.brand : colors.warning;
  const instructions = task.notes?.trim() || null;
  const dept = task.stageDefinition
    ? localizedName(
        locale,
        {
          nameEn: task.stageDefinition.nameEn ?? null,
          nameAr: task.stageDefinition.nameAr ?? null,
          nameHe: task.stageDefinition.nameHe ?? null,
        },
        task.stageDefinition.code ?? task.stageDefinition.responsibleDepartment ?? '',
      )
    : null;
  const windowLabel =
    task.plannedStart || task.plannedCompletion
      ? [
          task.plannedStart ? formatDateTime(task.plannedStart) : null,
          task.plannedCompletion ? formatDateTime(task.plannedCompletion) : null,
        ]
          .filter(Boolean)
          .join(' → ')
      : null;

  return (
    <AnimatedPressable
      variant="button"
      disabled={!canOpen}
      onPress={() => {
        void haptics.selection();
        onOpen();
      }}
      style={{
        minHeight: theme.sizes.touch.min,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: accent,
          opacity: assigned ? 0.55 : 0.9,
          ...(isRTL ? { right: 0 } : { left: 0 }),
        }}
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <StatusBadge status={task.status} dot />
          <AppText
            variant="label"
            weight={titleWeight}
            numberOfLines={2}
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {task.name}
          </AppText>
        </View>
        <Ionicons
          name={isRTL ? 'chevron-back' : 'chevron-forward'}
          size={18}
          color={colors.textMuted}
        />
      </View>
      <View
        style={{
          margin: theme.spacing.sm,
          marginTop: theme.spacing.sm,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
          padding: theme.spacing.sm,
          gap: 2,
        }}
      >
        <AppText
          variant="caption"
          color={assigned ? 'secondary' : 'muted'}
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {task.assigneeName || t('mobile.production.unassigned')}
        </AppText>
        {dept ? (
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {dept}
          </AppText>
        ) : null}
        {windowLabel ? (
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {windowLabel}
          </AppText>
        ) : null}
        {instructions ? (
          <AppText
            variant="caption"
            color="secondary"
            numberOfLines={2}
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {instructions}
          </AppText>
        ) : (
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('mobile.production.workerInstructionsEmpty')}
          </AppText>
        )}
      </View>
    </AnimatedPressable>
  );
}

/**
 * In-place Preparing production plan: workflow, order BOM, per-stage I/O, assign, Confirm.
 */
export function OrderProductionPlanEditorScreen({
  productionOrderId,
  salesOrderId,
}: Props) {
  const { user } = useAuth();
  const { t, locale, isRTL, formatCurrency } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { showToast } = useToast();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const matsMaxHeight = Math.round(height * 0.45);

  const canEdit = canAny(user, [
    'production-order.update',
    'production.setup.edit',
    'production-order.assign',
  ]);
  const canAssign = can(user, 'production-order.assign');
  const canConfirm = can(user, 'production-order.update');
  const canEditTaskNotes = canAny(user, [
    'production-task.update-any',
    'production-task.update-own',
  ]);

  const query = useOrderPlanSetupQuery(productionOrderId, Boolean(productionOrderId));
  const putMutation = usePutOrderPlanSetupMutation(productionOrderId);
  const assignWorkflowMutation = useAssignOrderWorkflowMutation(productionOrderId);
  const startMutation = useStartProductionMutation(productionOrderId);
  const assignMutation = useAssignTaskMutation(productionOrderId);
  const notesMutation = useUpdateTaskNotesMutation(productionOrderId);
  const ensurePlanMutation = useEnsurePlanTasksMutation(productionOrderId);

  const [bomDraft, setBomDraft] = useState<BomDraft[]>([]);
  const [stageDrafts, setStageDrafts] = useState<Record<string, ProductionSetupStage>>({});
  const [dirty, setDirty] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [matsExpanded, setMatsExpanded] = useState(false);
  const [editingStage, setEditingStage] = useState<ProductionSetupStage | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [assignTaskId, setAssignTaskId] = useState<string | null>(null);
  const [assignWindow, setAssignWindow] = useState<{
    plannedStart?: string;
    plannedCompletion?: string;
  }>({});
  const [scheduleConflict, setScheduleConflict] = useState<{
    conflicts: Array<{ kind?: string; id?: string; label?: string; start?: string; end?: string }>;
    suggestedWindow?: { plannedStart: string; plannedCompletion: string } | null;
  } | null>(null);

  const canOverrideConflict = can(user, 'schedule.override');

  useFocusEffect(
    useCallback(() => {
      void query.refetch();
    }, [query.refetch]),
  );

  useEffect(() => {
    if (!query.data || dirty) return;
    setBomDraft(
      (query.data.bomLines ?? []).map((b) => ({
        inventoryItemId: b.inventoryItemId,
        sku: b.sku,
        qty: b.qty,
        unit: b.unit || 'pcs',
        nameEn: b.nameEn,
        nameAr: b.nameAr,
        nameHe: b.nameHe,
        imageUrl: b.imageUrl,
        category: b.category,
        unitCost: Number(b.unitCost) || 0,
      })),
    );
    const map: Record<string, ProductionSetupStage> = {};
    for (const s of query.data.stages ?? []) {
      map[s.workflowNodeId] = s;
    }
    setStageDrafts(map);
  }, [query.data, dirty]);

  useEffect(() => {
    if (!query.data?.planEditable) return;
    if ((query.data.tasks ?? []).length > 0) return;
    if (ensurePlanMutation.isPending) return;
    ensurePlanMutation.mutate(undefined as never, {
      onSuccess: () => void query.refetch(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once when plan loads empty
  }, [query.data?.planEditable, query.data?.tasks?.length]);

  const planEditable = Boolean(query.data?.planEditable && canEdit);
  const stages = useMemo(() => {
    const server = query.data?.stages ?? [];
    return server.map((s) => stageDrafts[s.workflowNodeId] ?? s);
  }, [query.data?.stages, stageDrafts]);

  const packagingStage = stages.find((s) => isPackagingSetupStage(s.stageCode));
  const packagingPackageCount = packagingStage?.output?.expectedPieceCount ?? null;

  const materialsSubtotal = useMemo(
    () => bomDraft.reduce((sum, row) => sum + (Number(row.unitCost) || 0) * (Number(row.qty) || 0), 0),
    [bomDraft],
  );

  const visibleBom = matsExpanded ? bomDraft : bomDraft.slice(0, MATERIALS_COLLAPSED);
  const bomOverflow = bomDraft.length > MATERIALS_COLLAPSED;

  const workersTaskMeta = useMemo(() => {
    if (!assignTaskId || !query.data) return null;
    const task = query.data.tasks.find((t) => t.id === assignTaskId);
    if (!task) return null;
    return {
      stageDefinitionId: task.stageDefinitionId ?? task.stageDefinition?.id ?? undefined,
      plannedStart:
        assignWindow.plannedStart ?? task.plannedStart ?? undefined,
      plannedCompletion:
        assignWindow.plannedCompletion ?? task.plannedCompletion ?? undefined,
      department: task.stageDefinition?.responsibleDepartment ?? null,
    };
  }, [assignTaskId, query.data, assignWindow]);

  const workersQuery = useAssignableWorkersQuery(
    canAssign && Boolean(assignTaskId),
    undefined,
    workersTaskMeta?.stageDefinitionId,
    assignTaskId
      ? {
          taskId: assignTaskId,
          plannedStart: workersTaskMeta?.plannedStart,
          plannedCompletion: workersTaskMeta?.plannedCompletion,
        }
      : undefined,
  );

  const sheetTask = useMemo(() => {
    if (!assignTaskId || !query.data) return null;
    const task = query.data.tasks.find((t) => t.id === assignTaskId);
    if (!task) return null;
    return planTaskToRow(
      task,
      Boolean(query.data.planEditable && canAssign),
      Boolean(query.data.planEditable && canEditTaskNotes),
      locale,
    );
  }, [assignTaskId, query.data, canAssign, canEditTaskNotes, locale]);

  const markDirty = useCallback(() => setDirty(true), []);

  const savePlan = async () => {
    if (!planEditable) return;
    try {
      await putMutation.mutateAsync({
        workflowId: query.data?.workflow?.id ?? null,
        bomLines: bomDraft.map((b) => ({
          inventoryItemId: b.inventoryItemId,
          sku: b.sku,
          displayName: b.nameEn ?? b.nameAr ?? b.sku,
          category: b.category,
          unit: b.unit,
          expectedQty: b.qty,
          source: 'FACTORY_MODIFIED' as const,
          needsReview: !b.inventoryItemId,
        })),
        stages: stages.map((s) => ({
          workflowNodeId: s.workflowNodeId,
          stageDefinitionId: s.stageDefinitionId,
          behavior: s.behavior,
          consumesRawMaterials: s.consumesRawMaterials,
          consumesSemiFinished: s.consumesSemiFinished,
          outputNameEn: s.output?.nameEn ?? null,
          outputNameAr: s.output?.nameAr ?? null,
          outputNameHe: s.output?.nameHe ?? null,
          outputQtyPerUnit: s.output?.qtyPerUnit ?? null,
          expectedPieceCount: s.output?.expectedPieceCount ?? null,
          pieceLabels: s.output?.pieceLabels ?? null,
          defaultWarehouseId: s.output?.defaultWarehouseId ?? null,
          consumeOutputIds: s.consumeOutputIds ?? [],
          consumeWorkflowNodeIds: s.consumeWorkflowNodeIds ?? [],
          materialInputs: (s.materialInputs ?? []).map((m) => ({
            sku: m.sku,
            inventoryItemId: m.inventoryItemId,
            qtyPerUnit: m.qtyPerUnit,
            unit: m.unit,
          })),
        })),
      });
      setDirty(false);
      void haptics.confirmLight();
      showToast({
        variant: 'success',
        message: t('mobile.productionSetup.planSaved'),
      });
    } catch (err) {
      void haptics.error();
      showToast({
        variant: 'error',
        message: isApiError(err) ? toastMessageForError(err) : t('mobile.productionSetup.actionFailed'),
      });
    }
  };

  const onConfirm = () => {
    startMutation.mutate(undefined as never, {
      onSuccess: () => {
        void haptics.confirmMedium();
        setConfirmOpen(false);
        seedOrdersDeskChip('ready_to_start');
        showToast({
          variant: 'success',
          message: t('mobile.orders.journey.confirmPlanSuccess'),
        });
        router.replace(`/(app)/(admin)/orders/${salesOrderId}` as Href);
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
  };

  if (query.isLoading) {
    return (
      <AppScreen edges={{ top: true, bottom: false }} style={{ paddingHorizontal: 0 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </AppScreen>
    );
  }

  if (query.isError || !query.data) {
    return (
      <AppScreen edges={{ top: true, bottom: false }} style={{ paddingHorizontal: 0 }}>
        <ErrorState
          title={t('mobile.orders.errorTitle')}
          description={t('mobile.orders.errorBody')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  const data = query.data;
  const dealerName = data.salesOrder?.customer
    ? localizedName(locale, data.salesOrder.customer, data.salesOrder.customer.name ?? '—')
    : '—';
  const productName = data.product
    ? localizedName(locale, data.product, data.product.sku ?? '—')
    : '—';
  const workflowName = data.workflow
    ? localizedName(locale, data.workflow, data.workflow.code ?? '—')
    : t('mobile.productionSetup.noWorkflowSelected');

  const canConfirmNow =
    canConfirm &&
    data.planEditable &&
    !dirty &&
    Boolean(data.readiness.canConfirm);

  const confirmBlockedHint = (() => {
    if (dirty) return t('mobile.productionSetup.saveBeforeConfirm');
    if (!data.readiness.hasWorkflow || !data.readiness.hasMaterials) {
      return t('mobile.productionSetup.confirmBlockedHint');
    }
    if ((data.readiness.assignment.missing ?? []).length > 0) {
      return t('mobile.productionSetup.confirmNeedsWorkersHint');
    }
    if ((data.readiness.dates?.missing ?? []).length > 0) {
      return t('mobile.productionSetup.confirmNeedsDatesHint');
    }
    if (data.readiness.hasExecutableTasks === false) {
      return t('mobile.productionSetup.confirmNeedsTasksHint');
    }
    return t('mobile.productionSetup.confirmBlockedHint');
  })();

  return (
    <AppScreen edges={{ top: true, bottom: false }} style={{ paddingHorizontal: 0 }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.md,
          paddingBottom: SURFACE_TAB_BAR_CLEARANCE + DOCK_SCROLL_EXTRA,
          gap: theme.spacing.md,
        }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => {
              setDirty(false);
              void query.refetch();
            }}
            tintColor={colors.brand}
          />
        }
      >
        <ListItemEnter index={0}>
          <DealerBoard
            title={t('mobile.productionSetup.planTitle')}
            titleWeight={titleWeight}
            trailing={
              <AppText variant="caption" weight={titleWeight} color="brand">
                {t('mobile.orders.journey.preparing.label')}
              </AppText>
            }
          >
            <AppText variant="caption" color="muted">
              {t('mobile.productionSetup.planEditorHint')}
            </AppText>
            <View
              style={{
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceSecondary,
                padding: theme.spacing.md,
                gap: theme.spacing.xs,
              }}
            >
              <AppText variant="label" weight={titleWeight}>
                {data.salesOrder?.number ?? '—'}
              </AppText>
              <AppText variant="caption" color="muted">
                {dealerName}
              </AppText>
              <AppText variant="caption" color="secondary">
                {productName}
              </AppText>
            </View>
          </DealerBoard>
        </ListItemEnter>

        <ListItemEnter index={1}>
          <DealerBoard title={t('mobile.production.hubJumpWorkflow')} titleWeight={titleWeight}>
            <View
              style={{
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceSecondary,
                padding: theme.spacing.md,
                gap: theme.spacing.xs,
              }}
            >
              <AppText variant="body" weight={titleWeight}>
                {workflowName}
              </AppText>
              <AppText variant="caption" color="muted">
                {t('mobile.productionSetup.stageCount', { n: stages.length })}
              </AppText>
            </View>

            <FloorActionRow
              label={t('mobile.productionSetup.openPathChart')}
              onPress={() => {
                router.push(adminProductionFlowHref(productionOrderId));
              }}
            />

            {planEditable ? (
              <>
                <FloorActionRow
                  label={t('mobile.productionSetup.changeWorkflowCta')}
                  disabled={assignWorkflowMutation.isPending}
                  onPress={() => setWorkflowOpen(true)}
                />
                <FloorActionRow
                  label={t('mobile.productionSetup.manageWorkflows')}
                  onPress={() => {
                    router.push('/(app)/(admin)/production/workflow' as Href);
                  }}
                />
              </>
            ) : null}
          </DealerBoard>
        </ListItemEnter>

        <ListItemEnter index={2}>
          <DealerBoard
            title={t('mobile.production.hubJumpMaterials')}
            titleWeight={titleWeight}
            trailing={
              planEditable ? (
                <AnimatedPressable
                  variant="button"
                  onPress={() => {
                    void haptics.selection();
                    setPickerOpen(true);
                  }}
                  style={{
                    minHeight: 36,
                    paddingHorizontal: theme.spacing.md,
                    borderRadius: theme.radius.full,
                    backgroundColor: colors.brandSoft,
                    borderWidth: 1,
                    borderColor: colors.brand,
                    justifyContent: 'center',
                  }}
                >
                  <AppText variant="caption" weight={titleWeight} color="brand">
                    {t('mobile.productionSetup.addMaterial')}
                  </AppText>
                </AnimatedPressable>
              ) : null
            }
          >
            <AppText variant="caption" color="muted">
              {t('mobile.productionSetup.orderBomHint')}
            </AppText>
            {bomDraft.length === 0 ? (
              <EmptyState
                title={t('mobile.productionSetup.noMaterials')}
                description={t('mobile.productionSetup.orderBomEmpty')}
              />
            ) : (
              <>
                <ScrollView
                  style={matsExpanded ? { maxHeight: matsMaxHeight } : undefined}
                  nestedScrollEnabled
                  scrollEnabled={matsExpanded}
                >
                  <View style={{ gap: theme.spacing.sm }}>
                    {visibleBom.map((line, index) => {
                      const unit = Number(line.unitCost) || 0;
                      const lineTotal = unit * (Number(line.qty) || 0);
                      return (
                        <BomFloorRow
                          key={`${line.sku}-${index}`}
                          index={index}
                          name={localizedName(
                            locale,
                            { nameEn: line.nameEn, nameAr: line.nameAr, nameHe: line.nameHe },
                            line.sku,
                          )}
                          sku={line.sku}
                          qty={String(line.qty)}
                          unitCostLabel={unit > 0 ? formatCurrency(unit) : '—'}
                          lineTotalLabel={lineTotal > 0 ? formatCurrency(lineTotal) : '—'}
                          imageUrl={line.imageUrl}
                          showCosts
                          onQtyChange={(v) => {
                            if (!planEditable) return;
                            const n = Math.max(0, Number(v.replace(',', '.')) || 0);
                            setBomDraft((prev) =>
                              prev.map((row, i) => (i === index ? { ...row, qty: n } : row)),
                            );
                            markDirty();
                          }}
                          onRemove={() => {
                            if (!planEditable) return;
                            const sku = line.sku;
                            setBomDraft((prev) => prev.filter((_, i) => i !== index));
                            setStageDrafts((prev) => {
                              const next: Record<string, ProductionSetupStage> = { ...prev };
                              for (const key of Object.keys(next)) {
                                const st = next[key];
                                if (!st) continue;
                                next[key] = {
                                  ...st,
                                  materialInputs: (st.materialInputs ?? []).filter(
                                    (m) => m.sku !== sku,
                                  ),
                                };
                              }
                              return next;
                            });
                            markDirty();
                          }}
                        />
                      );
                    })}
                  </View>
                </ScrollView>

                {bomOverflow ? (
                  <AnimatedPressable
                    variant="button"
                    onPress={() => {
                      void haptics.selection();
                      setMatsExpanded((v) => !v);
                    }}
                    style={{
                      alignSelf: isRTL ? 'flex-end' : 'flex-start',
                      minHeight: 36,
                      paddingHorizontal: theme.spacing.md,
                      borderRadius: theme.radius.full,
                      backgroundColor: colors.brandSoft,
                      borderWidth: 1,
                      borderColor: colors.brand,
                      justifyContent: 'center',
                    }}
                  >
                    <AppText variant="caption" weight={titleWeight} color="brand">
                      {matsExpanded
                        ? t('mobile.productionSetup.showFewerMaterials')
                        : t('mobile.productionSetup.showAllMaterials', {
                            n: bomDraft.length,
                          })}
                    </AppText>
                  </AnimatedPressable>
                ) : null}

                <View
                  style={{
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceSecondary,
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.sm,
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: theme.spacing.sm,
                  }}
                >
                  <AppText variant="caption" weight={titleWeight} color="muted">
                    {t('mobile.productionSetup.materialsTotal')}
                  </AppText>
                  <AppText variant="label" weight={titleWeight} dir="ltr">
                    {formatCurrency(materialsSubtotal)}
                  </AppText>
                </View>
              </>
            )}
          </DealerBoard>
        </ListItemEnter>

        <ListItemEnter index={3}>
          <DealerBoard title={t('mobile.productionSetup.stagesTitle')} titleWeight={titleWeight}>
            <AppText variant="caption" color="muted">
              {t('mobile.productionSetup.stageMaterialsHint')}
            </AppText>
            {stages.length === 0 ? (
              <AppText variant="caption" color="muted">
                {t('mobile.productionSetup.noStagesYet')}
              </AppText>
            ) : (
              stages.map((stage, index) => (
                <StageRow
                  key={stage.workflowNodeId}
                  stage={stage}
                  stepLabel={String(stage.flowStep ?? index + 1)}
                  isLast={index === stages.length - 1}
                  packagingPackageCount={packagingPackageCount}
                  onPress={() => {
                    if (!planEditable) return;
                    void haptics.selection();
                    setEditingStage(stage);
                  }}
                />
              ))
            )}
          </DealerBoard>
        </ListItemEnter>

        <ListItemEnter index={4}>
          <DealerBoard title={t('mobile.production.hubJumpTasks')} titleWeight={titleWeight}>
            <AppText variant="caption" color="muted">
              {t('mobile.productionSetup.teamHint')}
            </AppText>
            <View style={{ gap: theme.spacing.sm }}>
              {(data.tasks ?? []).map((task) => (
                <PlanTaskRow
                  key={task.id}
                  task={task}
                  canOpen={
                    data.planEditable && (canAssign || canEditTaskNotes)
                  }
                  onOpen={() => setAssignTaskId(task.id)}
                />
              ))}
            </View>
          </DealerBoard>
        </ListItemEnter>
      </ScrollView>

      {data.planEditable ? (
        <FloatingActionDock floating>
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
              padding: theme.spacing.md,
              gap: theme.spacing.sm,
              ...orderBoardShadow(colorScheme),
            }}
          >
            {dirty ? (
              <PrimaryButton
                label={t('mobile.productionSetup.savePlan')}
                loading={putMutation.isPending}
                onPress={() => void savePlan()}
                style={{
                  borderRadius: theme.radius.xl,
                }}
              />
            ) : (
              <PrimaryButton
                label={t('mobile.orders.journey.confirmPlan')}
                disabled={!canConfirmNow || startMutation.isPending}
                loading={startMutation.isPending}
                onPress={() => {
                  void haptics.selection();
                  setConfirmOpen(true);
                }}
                style={{
                  borderRadius: theme.radius.xl,
                }}
              />
            )}
            {dirty || !canConfirmNow ? (
              <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
                {confirmBlockedHint}
              </AppText>
            ) : null}
          </View>
        </FloatingActionDock>
      ) : null}

      <BomMaterialPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        existingSkus={bomDraft.map((b) => b.sku)}
        onPick={(row) => {
          setBomDraft((prev) => {
            if (prev.some((b) => b.sku === row.sku)) return prev;
            return [
              ...prev,
              {
                inventoryItemId: row.inventoryItemId ?? null,
                sku: row.sku,
                qty: Number(row.qty) || 1,
                unit: 'pcs',
                nameEn: row.nameEn,
                nameAr: row.nameAr,
                nameHe: null,
                imageUrl: row.imageUrl,
                category: row.category ?? null,
                unitCost: Number(row.unitCost) || 0,
              },
            ];
          });
          markDirty();
        }}
      />

      <WorkflowPickerSheet
        open={workflowOpen}
        onClose={() => setWorkflowOpen(false)}
        selectedId={data.workflow?.id ?? null}
        onPick={(wf) => {
          setWorkflowOpen(false);
          if (wf.id === data.workflow?.id) return;
          assignWorkflowMutation.mutate(wf.id, {
            onSuccess: () => {
              void haptics.confirmLight();
              setDirty(false);
              showToast({
                variant: 'success',
                message: t('mobile.productionSetup.workflowRebuilt'),
              });
              void query.refetch();
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

      <ProductionStageSetupSheet
        open={Boolean(editingStage)}
        stage={editingStage}
        product={
          data.product
            ? {
                id: data.product.id,
                nameEn: data.product.nameEn ?? data.product.sku ?? '—',
                nameAr: data.product.nameAr ?? data.product.nameEn ?? '—',
                nameHe: data.product.nameHe,
                sku: data.product.sku,
              }
            : null
        }
        warehouses={data.warehouses}
        bomLines={bomDraft.map((b) => ({
          sku: b.sku,
          qty: b.qty,
          exists: Boolean(b.inventoryItemId),
          imageUrl: b.imageUrl,
          nameEn: b.nameEn,
          nameAr: b.nameAr,
          nameHe: b.nameHe,
          unit: b.unit,
        }))}
        siblingMaterialClaims={stages
          .filter((s) => s.workflowNodeId !== editingStage?.workflowNodeId)
          .flatMap((s) =>
            (s.materialInputs ?? []).map((m) => ({
              sku: m.sku,
              qtyPerUnit: m.qtyPerUnit,
            })),
          )}
        packagingPackageCount={packagingStage?.output?.expectedPieceCount ?? null}
        packagingPackageLabels={packagingStage?.output?.pieceLabels ?? undefined}
        earlierSemiProducersExist={stages.some(
          (s) =>
            s.workflowNodeId !== editingStage?.workflowNodeId &&
            produceKindFromBehavior(s.behavior) === 'semi',
        )}
        onClose={() => setEditingStage(null)}
        onSave={(next) => {
          setStageDrafts((prev) => ({ ...prev, [next.workflowNodeId]: next }));
          setEditingStage(null);
          markDirty();
        }}
      />

      <ProductionTaskSheet
        open={Boolean(sheetTask)}
        onClose={() => {
          setAssignTaskId(null);
          setAssignWindow({});
          setScheduleConflict(null);
        }}
        task={sheetTask}
        workers={workersQuery.data ?? []}
        workersLoading={workersQuery.isFetching || workersQuery.isLoading}
        canAssign={canAssign && data.planEditable}
        canUpdateTask={false}
        canOverrideConflict={canOverrideConflict}
        assignLoading={assignMutation.isPending}
        notesLoading={notesMutation.isPending}
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
                setAssignTaskId(null);
                setAssignWindow({});
                setScheduleConflict(null);
                showToast({
                  variant: 'success',
                  message: t('mobile.production.assignSuccess'),
                });
                void query.refetch();
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
                    : t('mobile.productionSetup.actionFailed'),
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
                void query.refetch();
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
            },
          );
        }}
        onHold={() => undefined}
        onBlock={() => undefined}
      />

      <ConfirmationSheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t('mobile.orders.journey.confirmPlan')}
        message={t('mobile.production.setup.releaseConfirmBody')}
        confirmLabel={t('mobile.orders.journey.confirmPlan')}
        onConfirm={onConfirm}
      />
    </AppScreen>
  );
}
