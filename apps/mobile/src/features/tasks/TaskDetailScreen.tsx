import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  UIManager,
  useWindowDimensions,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { can, canAny } from '@maher/permissions';
import { createRequestId } from '@/api/requestId';
import { ApiError } from '@/api/errors';
import { uploadFile } from '@/api/modules/uploads';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { PriorityBadge } from '@/components/badges/PriorityBadge';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { ActionSheet, type ActionSheetItem } from '@/components/sheets/ActionSheet';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useAccessoryCamera } from '@/features/inventory/components/AccessoryCameraProvider';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { ImageCarousel } from '@/features/sales-orders/components/ImageCarousel';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import {
  classifyTaskQualityKind,
  countPriorFails,
  isLastStageQualityFloor,
  isQcFailResult,
  type TaskQualityKind,
} from '@/features/quality/taskQualityKind';
import { useLocale } from '@/i18n';
import { SuccessBurst, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useSmartBack } from '@/navigation/useSmartBack';
import { PendingOutboxBanner } from './components/PendingOutboxBanner';
import {
  TaskMaterialsFloorSection,
  type TaskMaterialsFloorHandle,
} from './components/TaskMaterialsFloorSection';
import { TaskFabricTakeInBoard } from './components/TaskFabricTakeInBoard';
import {
  TaskIncomingWorkFloorSection,
  type TaskIncomingFloorHandle,
} from './components/TaskIncomingWorkFloorSection';
import {
  TaskSemiOutputFloorSection,
  type TaskSemiOutputFloorHandle,
} from './components/TaskSemiOutputFloorSection';
import { TaskActionDock, type TaskDockAction } from './components/TaskActionDock';
import { TaskDetailSkeleton } from './components/TasksListSkeleton';
import { TaskFilePreview } from './components/TaskFilePreview';
import { TaskTimerBoard } from './components/TaskTimerBoard';
import { flushTaskOutbox } from './flushOutbox';
import { enqueueTaskPhoto, listTaskOutbox, type TaskOutboxItem } from './outbox';
import {
  getTaskWipIncoming,
  type FloorTaskHint,
  type WipIncomingLine,
} from '@/api/modules/tasks';
import {
  useBlockTaskMutation,
  useCompleteTaskMutation,
  usePauseTaskMutation,
  useResumeTaskMutation,
  useStartTaskMutation,
  useTaskQuery,
} from './query';
import { floorHintFromIncoming } from './floorPhase';
import { selectTaskDetail } from './selectTask';
import type { TaskBlockerCategory, TaskDetail } from './api';
import {
  createInspection,
  getFloorContext,
  submitInspection,
  type DefectCategory,
  type QualityFloorContext,
  type QualityInspection,
} from '@/features/quality/api';
import { InspectionFloorPanel } from '@/features/quality/components/InspectionFloorPanel';
import {
  PackagingConfirmPanel,
  allPackagesConfirmed,
  confirmedPackageLabels,
} from '@/features/quality/components/PackagingConfirmPanel';
import { QcFailSheet } from '@/features/quality/components/QcFailSheet';
import { ReinspectionBanner } from '@/features/quality/components/ReinspectionBanner';
import { ReworkFloorBanner } from '@/features/quality/components/ReworkFloorBanner';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type TaskDetailScreenProps = {
  taskId: string;
  forceState?: 'loading' | 'error' | 'offline' | 'success';
  fixture?: TaskDetail;
  /** Override back target (e.g. admin PO hub → floor). */
  backFallback?: Href;
};

const BLOCK_CATEGORIES: TaskBlockerCategory[] = [
  'MATERIAL_MISSING',
  'MACHINE_PROBLEM',
  'MEASUREMENT_ISSUE',
  'DESIGN_ISSUE',
  'PREVIOUS_STAGE_DEFECT',
  'OTHER',
];

const TASKS_FALLBACK = '/(app)/(employee)/(tabs)/tasks' as Href;

function isReadyStatus(status: string): boolean {
  return status.trim().toUpperCase().replace(/\s+/g, '_') === 'READY';
}

export function TaskDetailScreen({
  taskId,
  forceState,
  fixture,
  backFallback = TASKS_FALLBACK,
}: TaskDetailScreenProps) {
  const { user } = useAuth();
  const { t, formatDateTime, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowW } = useWindowDimensions();
  const { showOfflineBanner, isConnected } = useNetwork();
  const { showToast } = useToast();
  const router = useRouter();
  const onBack = useSmartBack(backFallback);
  const { openAccessoryCamera } = useAccessoryCamera();
  const offline = isConnected === false || forceState === 'offline';
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const pad = theme.spacing.md;
  const mediaW = Math.max(0, windowW - pad * 2);
  /** Dock + last floor board clear the floating tab bar. */
  const floorClearance = insets.bottom + SURFACE_TAB_BAR_CLEARANCE;
  const [dockHeight, setDockHeight] = useState(0);
  const onDockHeight = useCallback((height: number) => {
    setDockHeight((prev) => (prev === height ? prev : height));
  }, []);

  const allowed = can(user, 'production-task.read');
  const canUpdate = canAny(user, [
    'production-task.update-own',
    'production-task.update-any',
  ]);
  const canComplete = can(user, 'production-task.complete');
  const canRecordUsage = can(user, 'production.material-usage.record');
  const canPerformQc = can(user, 'quality-inspection.perform');

  const query = useTaskQuery(taskId, allowed && !forceState);
  const startMutation = useStartTaskMutation(taskId);
  const pauseMutation = usePauseTaskMutation(taskId);
  const resumeMutation = useResumeTaskMutation(taskId);
  const completeMutation = useCompleteTaskMutation(taskId);
  const blockMutation = useBlockTaskMutation(taskId);

  const [uploadSheetOpen, setUploadSheetOpen] = useState(false);
  const [problemSheetOpen, setProblemSheetOpen] = useState(false);
  const [problemReason, setProblemReason] = useState('');
  const [problemCategory, setProblemCategory] =
    useState<TaskBlockerCategory>('OTHER');
  const [uploading, setUploading] = useState(false);
  const [outbox, setOutbox] = useState<TaskOutboxItem[]>([]);
  const [flushing, setFlushing] = useState(false);
  const [finishedBurst, setFinishedBurst] = useState(false);
  const materialsRef = useRef<TaskMaterialsFloorHandle>(null);
  const semiOutputRef = useRef<TaskSemiOutputFloorHandle>(null);
  const incomingRef = useRef<TaskIncomingFloorHandle>(null);
  const completeKeyRef = useRef(`complete-${createRequestId()}`);

  const [qcContext, setQcContext] = useState<QualityFloorContext | null>(null);
  const [qcInspection, setQcInspection] = useState<QualityInspection | null>(null);
  const [qcChecklist, setQcChecklist] = useState<Record<string, boolean>>({});
  const [qcNotes, setQcNotes] = useState('');
  const [qcFailOpen, setQcFailOpen] = useState(false);
  const [qcBusy, setQcBusy] = useState(false);
  const [packageChecked, setPackageChecked] = useState<Record<string, boolean>>({});
  const qcCreateKeyRef = useRef(`qc-create-${createRequestId()}`);
  const qcSubmitKeyRef = useRef(`qc-submit-${createRequestId()}`);

  const raw: TaskDetail | undefined =
    forceState === 'success' || forceState === 'offline' ? fixture : query.data;

  const vm = raw ? selectTaskDetail(raw, locale) : null;
  const refreshing = query.isRefetching && !query.isLoading;
  const busy =
    startMutation.isPending ||
    pauseMutation.isPending ||
    resumeMutation.isPending ||
    completeMutation.isPending ||
    blockMutation.isPending ||
    uploading ||
    flushing ||
    qcBusy;

  const [incomingInfo, setIncomingInfo] = useState<{
    required: boolean;
    allReceived: boolean;
    lines: WipIncomingLine[];
  }>({ required: false, allReceived: true, lines: [] });

  const floorHint: FloorTaskHint | null = useMemo(() => {
    if (!vm) return null;
    return floorHintFromIncoming({
      taskStatus: vm.status,
      openBlockerCount: vm.openBlockers.length,
      required: incomingInfo.required,
      allReceived: incomingInfo.allReceived,
      lines: incomingInfo.lines,
    });
  }, [vm, incomingInfo]);

  const needsWipReceive =
    Boolean(incomingInfo.required) && !incomingInfo.allReceived;

  const qualityKind = useMemo(() => {
    if (!vm) return 'production' as const;
    return classifyTaskQualityKind({
      stageCode: vm.stageCode,
      executionKind: vm.executionKind,
      isRework: vm.isRework,
      priorFailCount: countPriorFails(qcContext?.inspections),
    });
  }, [vm, qcContext?.inspections]);

  const isQcGate =
    qualityKind === 'inspection' || qualityKind === 'reinspection';
  const isPackaging = qualityKind === 'packaging';
  const isReworkTask = qualityKind === 'rework';

  const packagesAllConfirmed = useMemo(() => {
    if (!isPackaging) return true;
    if (!qcContext) return false;
    return allPackagesConfirmed(qcContext.expectedPackages ?? [], packageChecked);
  }, [isPackaging, qcContext, packageChecked]);

  const refreshQcContext = useCallback(async () => {
    if (!vm?.productionOrderId || (!isQcGate && !isPackaging && !isReworkTask)) {
      return;
    }
    try {
      const ctx = await getFloorContext(vm.productionOrderId);
      setQcContext(ctx);
      if (isPackaging && ctx.expectedPackages?.length) {
        setPackageChecked((prev) => {
          const next = { ...prev };
          for (const p of ctx.expectedPackages) {
            if (next[p.code] == null) next[p.code] = false;
          }
          return next;
        });
      }
      if (isQcGate) {
        const open =
          ctx.latestInspection && !ctx.latestInspection.result
            ? ctx.latestInspection
            : null;
        if (open) {
          setQcInspection(open);
          setQcNotes(open.notes ?? '');
          setQcChecklist(
            Object.fromEntries(
              (open.items ?? []).map((i) => [
                i.checklistCode,
                i.result === 'PASS' || i.result === 'NOT_APPLICABLE',
              ]),
            ),
          );
        } else if (canPerformQc && !offline) {
          const created = await createInspection({
            productionOrderId: vm.productionOrderId,
            stageCode: vm.stageCode ?? 'INSPECTION',
            idempotencyKey: qcCreateKeyRef.current,
          });
          setQcInspection(created);
          setQcNotes(created.notes ?? '');
          setQcChecklist(
            Object.fromEntries(
              (created.items ?? []).map((i) => [i.checklistCode, false]),
            ),
          );
        }
      }
    } catch {
      if (isPackaging) {
        setQcContext((prev) =>
          prev ??
            ({
              productionOrderId: vm.productionOrderId!,
              productionOrderNumber: '',
              quantity: 1,
              orderStatus: '',
              itemUnderInspection: null,
              manufacturingSpec: null,
              latestInspection: null,
              inspections: [],
              openRework: null,
              expectedPackages: [],
              packagingUnlocked: true,
              lightAnalytics: {
                inspectionAttempts: 0,
                reworkCount: 0,
                failureCategories: [],
              },
            } satisfies QualityFloorContext),
        );
      }
    }
  }, [
    vm?.productionOrderId,
    vm?.stageCode,
    isQcGate,
    isPackaging,
    isReworkTask,
    canPerformQc,
    offline,
  ]);

  useEffect(() => {
    void refreshQcContext();
  }, [refreshQcContext]);

  const refreshOutbox = useCallback(async () => {
    const items = await listTaskOutbox(taskId);
    setOutbox(items);
  }, [taskId]);

  useEffect(() => {
    void refreshOutbox();
  }, [refreshOutbox]);

  useEffect(() => {
    if (!offline && outbox.length > 0) {
      void onFlushOutbox();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flush when reconnecting
  }, [offline]);

  async function onFlushOutbox() {
    setFlushing(true);
    try {
      const result = await flushTaskOutbox(taskId);
      await refreshOutbox();
      if (result.synced > 0) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        await query.refetch();
        showToast({
          variant: 'success',
          message: t('mobile.tasks.outboxSynced', { n: result.synced }),
        });
      }
      if (result.conflicts > 0) {
        showToast({
          variant: 'error',
          message: t('mobile.tasks.outboxConflict', { n: result.conflicts }),
        });
      }
    } finally {
      setFlushing(false);
    }
  }

  function actionErrorMessage(err: unknown, fallbackKey = 'mobile.tasks.actionFailed') {
    if (err instanceof ApiError && err.message.trim()) return err.message;
    if (err && typeof err === 'object' && 'message' in err) {
      const msg = String((err as { message?: string }).message ?? '').trim();
      if (msg) return msg;
    }
    return t(fallbackKey);
  }

  async function onStart() {
    if (offline) {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.tasks.onlineRequired') });
      return;
    }
    if (needsWipReceive) {
      void haptics.error();
      showToast({
        variant: 'error',
        message: t('mobile.tasks.incomingStartBlocked'),
      });
      return;
    }
    try {
      await startMutation.mutateAsync();
      void haptics.confirmMedium();
      showToast({ variant: 'success', message: t('mobile.tasks.startedToast') });
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (code === 'WIP_CLAIM_REQUIRED') {
        void haptics.error();
        showToast({
          variant: 'error',
          message: t('mobile.tasks.incomingStartBlocked'),
        });
        return;
      }
      void haptics.error();
      showToast({ variant: 'error', message: actionErrorMessage(err) });
    }
  }

  async function onStop() {
    if (offline) {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.tasks.onlineRequired') });
      return;
    }
    try {
      await pauseMutation.mutateAsync();
      void haptics.confirmMedium();
      showToast({ variant: 'success', message: t('mobile.tasks.stoppedToast') });
    } catch (err) {
      void haptics.error();
      showToast({ variant: 'error', message: actionErrorMessage(err) });
    }
  }

  async function onResume() {
    if (offline) {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.tasks.onlineRequired') });
      return;
    }
    try {
      await resumeMutation.mutateAsync();
      void haptics.confirmMedium();
      showToast({ variant: 'success', message: t('mobile.tasks.resumedToast') });
    } catch (err) {
      void haptics.error();
      showToast({ variant: 'error', message: actionErrorMessage(err) });
    }
  }

  async function onFinish() {
    // Never queue completion offline — must be explicit and online.
    if (offline) {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.tasks.finishRequiresOnline') });
      return;
    }
    try {
      const incoming = await getTaskWipIncoming(taskId);
      if (incoming.required && !incoming.allReceived) {
        const line = (incoming.lines ?? []).find((l) => l.statusKey !== 'RECEIVED');
        void haptics.error();
        showToast({
          variant: 'error',
          message: line
            ? t('mobile.tasks.incomingFinishBlockedDetail', {
                stage: line.fromStageNameEn,
                received: line.received,
                expected: line.expected,
              })
            : t('mobile.tasks.incomingFinishBlocked'),
        });
        return;
      }
    } catch {
      /* fall through — server will re-check */
    }
    if (vm?.producesSemiFinished && vm.requiresPhotos) {
      const piecePhotos = semiOutputRef.current?.piecePhotoCount() ?? 0;
      if (piecePhotos < 1) {
        void haptics.error();
        showToast({
          variant: 'error',
          message: t('mobile.tasks.semiOutputFinishNeedsPiece'),
        });
        return;
      }
    } else if (
      vm?.requiresPhotos &&
      !(vm.photos.length > 0) &&
      outbox.every((i) => i.kind !== 'photo')
    ) {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.tasks.photosRequired') });
      return;
    }
    if (canRecordUsage) {
      if (!materialsRef.current?.hasSelection()) {
        void haptics.error();
        showToast({
          variant: 'error',
          message: t('mobile.tasks.materialsMustChoose'),
        });
        return;
      }
      try {
        await materialsRef.current.commit();
      } catch (err) {
        void haptics.error();
        if (!(err instanceof Error && err.message === 'WAREHOUSE_REQUIRED')) {
          showToast({ variant: 'error', message: t('mobile.tasks.materialsSaveFailed') });
        }
        return;
      }
    }
    if (isPackaging) {
      if (!packagesAllConfirmed) {
        void haptics.error();
        showToast({
          variant: 'error',
          message: t('mobile.quality.confirmAllPackagesHint'),
        });
        return;
      }
      const labels = confirmedPackageLabels(
        qcContext?.expectedPackages ?? [],
        packageChecked,
      );
      await finishTaskAfterMaterials({ confirmedPackageLabels: labels });
      return;
    }
    await finishTaskAfterMaterials();
  }

  async function finishTaskAfterMaterials(extra?: {
    confirmedPackageLabels?: string[];
  }) {
    try {
      await flushTaskOutbox(taskId);
      await completeMutation.mutateAsync({
        idempotencyKey: completeKeyRef.current,
        confirmedPackageLabels: extra?.confirmedPackageLabels,
      });
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setFinishedBurst(true);
      showToast({ variant: 'success', message: t('mobile.tasks.finishedToast') });
      setTimeout(() => {
        router.replace('/(app)/(employee)/(tabs)/completed' as Href);
      }, 700);
    } catch (err) {
      void haptics.error();
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (code === 'WIP_RECEIVE_REQUIRED' || code === 'WIP_CLAIM_REQUIRED') {
        showToast({
          variant: 'error',
          message: t('mobile.tasks.incomingFinishBlocked'),
        });
        return;
      }
      if (code === 'PACKAGES_INCOMPLETE') {
        showToast({
          variant: 'error',
          message: t('mobile.quality.confirmAllPackagesHint'),
        });
        return;
      }
      if (code === 'USE_QUALITY_SUBMIT') {
        showToast({
          variant: 'error',
          message: t('mobile.quality.usePassNotComplete'),
        });
        return;
      }
      showToast({ variant: 'error', message: actionErrorMessage(err) });
    }
  }

  async function onPassInspection() {
    if (offline) {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.tasks.onlineRequired') });
      return;
    }
    if (!qcInspection?.id) {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.quality.inspectionNotReady') });
      return;
    }
    setQcBusy(true);
    try {
      const items = qcInspection.items ?? [];
      await submitInspection(qcInspection.id, {
        result: 'PASSED',
        notes: qcNotes.trim() || undefined,
        checklistResults: items.map((i) => ({
          checklistCode: i.checklistCode,
          result: qcChecklist[i.checklistCode] ? 'PASS' : 'FAIL',
        })),
        photoDocumentIds: vm?.photos.map((p) => p.id),
        idempotencyKey: qcSubmitKeyRef.current,
      });
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setFinishedBurst(true);
      void haptics.confirmMedium();
      showToast({ variant: 'success', message: t('mobile.quality.inspectionPassed') });
      await query.refetch();
      setTimeout(() => {
        router.replace('/(app)/(employee)/(tabs)/completed' as Href);
      }, 700);
    } catch (err) {
      void haptics.error();
      showToast({ variant: 'error', message: actionErrorMessage(err) });
    } finally {
      setQcBusy(false);
    }
  }

  async function onConfirmQcFail(args: {
    defectCategory: DefectCategory;
    defectDescription: string;
    affectedQty: number;
    severity: string;
    reentryStageInstanceId?: string;
  }) {
    if (!qcInspection?.id) {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.quality.inspectionNotReady') });
      return;
    }
    setQcBusy(true);
    try {
      const items = qcInspection.items ?? [];
      await submitInspection(qcInspection.id, {
        result: 'FAILED_REWORK_REQUIRED',
        notes: qcNotes.trim() || undefined,
        defectCategory: args.defectCategory,
        defectDescription: args.defectDescription,
        affectedQty: args.affectedQty,
        severity: args.severity,
        reentryStageInstanceId: args.reentryStageInstanceId,
        checklistResults: items.map((i) => ({
          checklistCode: i.checklistCode,
          result: qcChecklist[i.checklistCode] ? 'PASS' : 'FAIL',
        })),
        photoDocumentIds: vm?.photos.map((p) => p.id),
        idempotencyKey: `qc-fail-${createRequestId()}`,
      });
      setQcFailOpen(false);
      void haptics.confirmMedium();
      showToast({ variant: 'success', message: t('mobile.quality.problemFound') });
      await query.refetch();
      await refreshQcContext();
    } catch (err) {
      void haptics.error();
      showToast({ variant: 'error', message: actionErrorMessage(err) });
    } finally {
      setQcBusy(false);
    }
  }

  async function onReportProblem() {
    const reason = problemReason.trim();
    if (!reason) {
      showToast({ variant: 'error', message: t('mobile.tasks.problemReasonRequired') });
      return;
    }
    if (offline) {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.tasks.onlineRequired') });
      return;
    }
    try {
      await blockMutation.mutateAsync({
        category: problemCategory,
        reason,
        idempotencyKey: `block-${createRequestId()}`,
      });
      void haptics.confirmMedium();
      setProblemSheetOpen(false);
      setProblemReason('');
      showToast({ variant: 'success', message: t('mobile.tasks.problemReported') });
    } catch {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.tasks.actionFailed') });
    }
  }

  async function uploadOrQueue(uri: string, fileName: string, mimeType: string) {
    if (!vm?.productionOrderId) {
      showToast({ variant: 'error', message: t('mobile.tasks.uploadFailed') });
      return;
    }
    setUploading(true);
    const idempotencyKey = `photo-${createRequestId()}`;
    const productionOrderId = vm.productionOrderId;
    try {
      if (offline) {
        await enqueueTaskPhoto({
          taskId,
          productionOrderId,
          uri,
          fileName,
          mimeType,
          idempotencyKey,
        });
        await refreshOutbox();
        void haptics.confirmLight();
        showToast({ variant: 'warning', message: t('mobile.tasks.photoQueued') });
        return;
      }
      await uploadFile({
        uri,
        fileName,
        mimeType,
        category: `TASK_PHOTO:${taskId}`,
        taskId,
        productionOrderId,
        idempotencyKey,
      });
      void haptics.confirmLight();
      showToast({ variant: 'success', message: t('mobile.tasks.photoUploaded') });
      await query.refetch();
    } catch {
      try {
        await enqueueTaskPhoto({
          taskId,
          productionOrderId,
          uri,
          fileName,
          mimeType,
          idempotencyKey,
        });
        await refreshOutbox();
        void haptics.error();
        showToast({ variant: 'warning', message: t('mobile.tasks.photoQueued') });
      } catch {
        void haptics.error();
        showToast({ variant: 'error', message: t('mobile.tasks.uploadFailed') });
      }
    } finally {
      setUploading(false);
    }
  }

  async function pickGallery() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showToast({ variant: 'warning', message: t('mobile.tasks.galleryPermission') });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        // Match admin accessory picker — editing + multi-select after a sheet
        // Modal often flash-dismisses or never presents on iOS.
        allowsEditing: false,
        exif: false,
        allowsMultipleSelection: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0]!;
      await uploadOrQueue(
        asset.uri,
        asset.fileName ?? `task-photo-${Date.now()}.jpg`,
        asset.mimeType ?? 'image/jpeg',
      );
    } catch {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.tasks.uploadFailed') });
    }
  }

  async function pickCamera() {
    try {
      const uri = await openAccessoryCamera({
        title: t('mobile.tasks.takePhoto'),
        hint: t('mobile.tasks.takePhotoHint'),
        aspectRatio: 4 / 3,
      });
      if (!uri) return;
      await uploadOrQueue(uri, `task-photo-${Date.now()}.jpg`, 'image/jpeg');
    } catch {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.tasks.uploadFailed') });
    }
  }

  const uploadActions: ActionSheetItem[] = [
    {
      label: t('mobile.tasks.takePhoto'),
      icon: 'camera-outline',
      deferUntilClosed: true,
      onPress: () => void pickCamera(),
    },
    {
      label: t('mobile.tasks.choosePhoto'),
      icon: 'images-outline',
      deferUntilClosed: true,
      onPress: () => void pickGallery(),
    },
  ];

  const mediaUris = useMemo(
    () => {
      if (!vm) return [];
      return (vm.imageUrls?.length ? vm.imageUrls : vm.imageUrl ? [vm.imageUrl] : [])
        .map((u) => resolveOrderMediaUri(u))
        .filter((u): u is string => Boolean(u));
    },
    [vm],
  );

  const dockActions = useMemo(() => {
    const actions: TaskDockAction[] = [];
    if (!vm || !floorHint) return actions;

    const primary = floorHint.primaryAction;

    // Piece 9 — inspection: Pass / Report problem (never floor Complete).
    if (isQcGate && canPerformQc && vm.canFinish && !finishedBurst) {
      actions.push({
        key: 'qc-pass',
        label: t('mobile.quality.passInspection'),
        icon: 'checkmark-circle-outline',
        primary: true,
        onPress: () => void onPassInspection(),
        loading: qcBusy,
        disabled: busy || offline || qcBusy,
      });
      actions.push({
        key: 'qc-fail',
        label: t('mobile.quality.reportProblem'),
        icon: 'warning-outline',
        onPress: () => setQcFailOpen(true),
        disabled: busy || offline || qcBusy,
      });
      if (canUpdate && vm.canUploadPhoto) {
        actions.push({
          key: 'photo',
          label: t('mobile.tasks.uploadPhoto'),
          icon: 'camera-outline',
          onPress: () => setUploadSheetOpen(true),
          disabled: busy,
        });
      }
      return actions.slice(0, 4);
    }

    if (primary === 'RECEIVE_SEMI' && canUpdate) {
      actions.push({
        key: 'receive',
        label: t('mobile.tasks.dockReceiveSemi'),
        icon: 'download-outline',
        primary: true,
        onPress: () => incomingRef.current?.openReceive(),
        disabled: busy || offline,
      });
    } else if (primary === 'START' && canUpdate && vm.canStart) {
      actions.push({
        key: 'start',
        label: t('mobile.tasks.startTask'),
        icon: 'play',
        primary: true,
        onPress: () => void onStart(),
        loading: startMutation.isPending,
        disabled: busy,
      });
    } else if (canUpdate && vm.canResume) {
      actions.push({
        key: 'resume',
        label: t('mobile.tasks.resumeTask'),
        icon: 'play',
        primary: true,
        onPress: () => void onResume(),
        loading: resumeMutation.isPending,
        disabled: busy || offline,
      });
    }

    if (canUpdate && vm.canStop) {
      actions.push({
        key: 'stop',
        label: t('mobile.tasks.stopTask'),
        icon: 'pause',
        onPress: () => void onStop(),
        loading: pauseMutation.isPending,
        disabled: busy || offline,
      });
    }

    if (primary === 'COMPLETE' && canComplete && vm.canFinish && !finishedBurst) {
      const packagingBlocked = isPackaging && !packagesAllConfirmed;
      actions.push({
        key: 'finish',
        label: isPackaging
          ? packagesAllConfirmed
            ? t('mobile.quality.completePackaging')
            : t('mobile.quality.confirmPackages')
          : t('mobile.tasks.markFinished'),
        holdLabel: t('mobile.tasks.holdToFinish'),
        icon: 'checkmark-circle-outline',
        holdConfirm: true,
        primary: true,
        onPress: () => void onFinish(),
        loading: completeMutation.isPending,
        disabled: busy || offline || packagingBlocked,
      });
    }

    if (canUpdate && vm.canUploadPhoto && !vm.producesSemiFinished) {
      actions.push({
        key: 'photo',
        label: t('mobile.tasks.uploadPhoto'),
        icon: 'camera-outline',
        onPress: () => setUploadSheetOpen(true),
        disabled: busy,
      });
    }
    if (canUpdate && vm.canReportProblem && !isQcGate) {
      actions.push({
        key: 'problem',
        label: t('mobile.tasks.reportProblem'),
        icon: 'warning-outline',
        onPress: () => setProblemSheetOpen(true),
        disabled: busy,
      });
    }

    // Cap secondary tiles — primary already included.
    return actions.slice(0, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers stable enough for dock
  }, [
    busy,
    canComplete,
    canPerformQc,
    canUpdate,
    completeMutation.isPending,
    finishedBurst,
    floorHint,
    isPackaging,
    isQcGate,
    offline,
    packagesAllConfirmed,
    pauseMutation.isPending,
    qcBusy,
    resumeMutation.isPending,
    startMutation.isPending,
    t,
    vm,
  ]);

  const dockRows = dockActions.length === 0 ? 0 : dockActions.length <= 2 ? 1 : 2;
  const dockFallback = dockRows === 0 ? 0 : dockRows === 1 ? 80 : 148;
  const dockScrollPad =
    dockActions.length > 0 ? (dockHeight > 0 ? dockHeight : dockFallback) : 0;

  if (forceState === 'loading' || (allowed && query.isLoading && !query.data && !forceState)) {
    return (
      <AppScreen backFallback={backFallback}>
        <TaskDetailSkeleton />
      </AppScreen>
    );
  }

  if (!allowed && !forceState) {
    return (
      <AppScreen backFallback={backFallback}>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (forceState === 'error' || (query.isError && !raw && !forceState)) {
    return (
      <AppScreen backFallback={backFallback}>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            paddingHorizontal: theme.spacing.lg,
          }}
        >
          <ErrorState
            title={t('mobile.tasks.detailErrorTitle')}
            description={t('mobile.tasks.errorBody')}
          />
          <PrimaryButton
            label={t('mobile.tasks.retry')}
            onPress={() => void query.refetch()}
            style={{ alignSelf: 'stretch' }}
          />
        </View>
      </AppScreen>
    );
  }

  if (!vm) {
    return (
      <AppScreen backFallback={backFallback}>
        <EmptyState
          title={t('mobile.tasks.detailErrorTitle')}
          description={t('mobile.tasks.errorBody')}
        />
      </AppScreen>
    );
  }

  const deadlineLabel = vm.deadline
    ? formatDateTime(vm.deadline)
    : t('mobile.tasks.noDeadline');
  const floorQualityKind: TaskQualityKind =
    qualityKind === 'inspection' ||
    qualityKind === 'reinspection' ||
    qualityKind === 'packaging'
      ? qualityKind
      : null;
  const hideProductionChrome = isLastStageQualityFloor(floorQualityKind);

  return (
    <AppScreen edges={{ top: true, bottom: false }} style={{ paddingHorizontal: 0 }}>
      {showOfflineBanner || forceState === 'offline' ? (
        <View style={{ paddingHorizontal: pad }}>
          <OfflineBanner />
        </View>
      ) : null}

      <View style={{ paddingHorizontal: pad }}>
        <TaskDetailNav
          onBack={onBack}
          title={taskDetailNavTitle(floorQualityKind, t)}
          subtitle={vm.orderNumber}
          trailing={
            <StatusBadge
              status={vm.status}
              variant={isReadyStatus(vm.status) ? 'brand' : undefined}
            />
          }
        />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={Boolean(refreshing)}
              onRefresh={() => {
                void query.refetch();
                void refreshOutbox();
                void refreshQcContext();
                if (!offline) void onFlushOutbox();
              }}
              tintColor={colors.brand}
            />
          }
          contentContainerStyle={{
            paddingHorizontal: pad,
            paddingBottom: floorClearance + dockScrollPad + theme.spacing.md,
            gap: theme.spacing.md,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {finishedBurst ? (
            <SuccessBurst triggerKey="finished">
              <View
                style={{
                  alignItems: 'center',
                  paddingVertical: theme.spacing.xl,
                  borderRadius: theme.radius.xl,
                  backgroundColor: colors.successSoft,
                  borderWidth: 1,
                  borderColor: colors.success,
                }}
              >
                <AppText variant="title" weight={titleWeight} style={{ color: colors.success }}>
                  {t('mobile.tasks.finishedToast')}
                </AppText>
              </View>
            </SuccessBurst>
          ) : null}

          <PendingOutboxBanner
            items={outbox}
            syncing={flushing}
            onRetry={() => void onFlushOutbox()}
          />

          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
              overflow: 'hidden',
              ...orderBoardShadow(colorScheme),
            }}
          >
            {mediaUris.length > 0 ? (
              <ImageCarousel uris={mediaUris} height={240} itemWidth={mediaW} />
            ) : (
              <View
                style={{
                  height: 200,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.brandSoft,
                  gap: theme.spacing.sm,
                }}
              >
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons name="cube-outline" size={22} color={colors.brand} />
                </View>
                <AppText variant="caption" color="muted">
                  {t('mobile.tasks.noModelImage')}
                </AppText>
              </View>
            )}
          </View>

          <View
            style={{
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
                ...(isRTL ? { right: 0 } : { left: 0 }),
                width: 3,
                backgroundColor: colors.brand,
                opacity: 0.55,
              }}
            />
            <View
              style={{
                padding: theme.spacing.md,
                gap: theme.spacing.sm,
                ...(isRTL
                  ? { paddingRight: theme.spacing.md + 4 }
                  : { paddingLeft: theme.spacing.md + 4 }),
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                style={{
                  color: colors.brand,
                  letterSpacing: locale === 'ar' ? 0 : 0.4,
                  fontSize: 11,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {t('mobile.tasks.whatYouAreMaking')}
              </AppText>
              {floorHint ? (
                <View
                  style={{
                    alignSelf: isRTL ? 'flex-end' : 'flex-start',
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: theme.radius.full,
                    backgroundColor: colors.brandSoft,
                    borderWidth: 1,
                    borderColor: colors.brand,
                  }}
                >
                  <AppText
                    variant="caption"
                    weight="semibold"
                    style={{ color: colors.brand, fontSize: 11 }}
                  >
                    {isReworkTask
                      ? t('mobile.quality.stampRework')
                      : isQcGate
                        ? qualityKind === 'reinspection'
                          ? t('mobile.quality.readyForReinspection')
                          : t('mobile.quality.readyForInspection')
                        : isPackaging
                          ? t('mobile.quality.stampPackaging')
                          : t(floorHint.labelKey)}
                  </AppText>
                </View>
              ) : null}
              <AppText
                variant="caption"
                weight="semibold"
                style={{
                  color: colors.textSecondary,
                  letterSpacing: locale === 'ar' ? 0 : 0.4,
                  textTransform: locale === 'ar' ? 'none' : 'uppercase',
                  fontSize: 11,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {vm.requiredWork}
              </AppText>
              <AppText
                variant="title"
                weight={titleWeight}
                numberOfLines={3}
                style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 20, lineHeight: 26 }}
              >
                {vm.productTitle}
              </AppText>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: theme.spacing.sm,
                }}
              >
                <AppText
                  variant="label"
                  weight="semibold"
                  dir="ltr"
                  style={{
                    flex: 1,
                    color: colors.brand,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {vm.orderNumber}
                  {raw?.productionOrder?.quantity != null
                    ? ` · ${t('mobile.tasks.qtyLabel', {
                        n: String(raw.productionOrder.quantity),
                      })}`
                    : ''}
                </AppText>
                <PriorityBadge priority={vm.priority} />
              </View>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                <AppText variant="caption" color="muted" numberOfLines={1}>
                  {t('mobile.tasks.deadline', { when: deadlineLabel })}
                </AppText>
              </View>
            </View>
          </View>

          <View style={{ gap: theme.spacing.sm }}>
              <AppText
                variant="caption"
                weight="semibold"
                style={{
                  color: colors.brand,
                  letterSpacing: locale === 'ar' ? 0 : 0.8,
                  textTransform: locale === 'ar' ? 'none' : 'uppercase',
                  fontSize: 11,
                  textAlign: isRTL ? 'right' : 'left',
                  paddingHorizontal: 2,
                }}
              >
                {t('mobile.tasks.whatYouNeed')}
              </AppText>
              {canRecordUsage ? (
                <TaskMaterialsFloorSection ref={materialsRef} taskId={taskId} />
              ) : null}
              {canRecordUsage ? <TaskFabricTakeInBoard taskId={taskId} /> : null}

              <TaskIncomingWorkFloorSection
                ref={incomingRef}
                taskId={taskId}
                showNoneWhenEmpty
                onReceived={() => {
                  /* availability callback refreshes floorHint */
                }}
                onAvailabilityChange={(info) => {
                  setIncomingInfo(info);
                }}
              />
            </View>
          {isReworkTask ? (
            <ReworkFloorBanner
              problemText={
                qcContext?.openRework?.description ??
                qcContext?.openRework?.inspection?.defects?.[0]?.description ??
                null
              }
              hasPhotos={Boolean(vm.photos.length)}
            />
          ) : null}

          {qualityKind === 'reinspection' ? (
            <ReinspectionBanner
              previousFailure={
                qcContext?.inspections?.find((i) => isQcFailResult(i.result))
                  ?.defects?.[0]?.description ??
                qcContext?.inspections?.find((i) => isQcFailResult(i.result))?.notes ??
                null
              }
              reworkedBy={
                qcContext?.openRework?.tasks?.[0]?.assignedEmployee?.fullName ||
                qcContext?.inspections
                  ?.flatMap((i) => i.rework ?? [])
                  .find((r) => r.status === 'COMPLETED')
                  ?.tasks?.[0]?.assignedEmployee?.fullName ||
                null
              }
            />
          ) : null}

          {isQcGate ? (
            <InspectionFloorPanel
              itemUnderInspection={qcContext?.itemUnderInspection ?? null}
              manufacturingSpec={qcContext?.manufacturingSpec ?? null}
              checklist={qcInspection?.items ?? []}
              checked={qcChecklist}
              onToggle={(code, next) =>
                setQcChecklist((prev) => ({ ...prev, [code]: next }))
              }
              notes={qcNotes}
              onNotesChange={setQcNotes}
              onPass={() => void onPassInspection()}
              onReportProblem={() => setQcFailOpen(true)}
              busy={qcBusy}
              disabled={!canPerformQc || offline || Boolean(finishedBurst)}
            />
          ) : null}

          {isPackaging ? (
            <PackagingConfirmPanel
              packages={qcContext?.expectedPackages ?? []}
              checked={packageChecked}
              onToggle={(code, next) =>
                setPackageChecked((prev) => ({ ...prev, [code]: next }))
              }
              onReportProblem={() => setProblemSheetOpen(true)}
              onComplete={
                canComplete && vm.canFinish && packagesAllConfirmed && !finishedBurst
                  ? () => void onFinish()
                  : undefined
              }
              completeBusy={completeMutation.isPending}
              disabled={offline || Boolean(finishedBurst)}
            />
          ) : null}

          {!isQcGate ? (
            <FloorSection
              title={t('mobile.tasks.yourWork')}
              isRTL={isRTL}
              locale={locale}
            >
              {vm.notes ? (
                <View style={{ gap: 4, marginBottom: theme.spacing.sm }}>
                  <AppText
                    variant="caption"
                    weight="semibold"
                    color="muted"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {t('mobile.tasks.workerInstructions')}
                  </AppText>
                  <AppText
                    variant="body"
                    weight={titleWeight}
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  >
                    {vm.notes}
                  </AppText>
                </View>
              ) : null}
              <AppText
                variant="caption"
                weight="semibold"
                color="muted"
                style={{ textAlign: isRTL ? 'right' : 'left', marginBottom: 4 }}
              >
                {vm.notes
                  ? t('mobile.tasks.stageGuide')
                  : t('mobile.tasks.instructions')}
              </AppText>
              <AppText
                variant="body"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {vm.instructions || t('mobile.tasks.noInstructions')}
              </AppText>
            </FloorSection>
          ) : null}

          {vm.waitingOn ? (
            <AppText
              variant="bodySecondary"
              color="warning"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {t('mobile.tasks.waitingOn', { stages: vm.waitingOn })}
            </AppText>
          ) : null}

          {vm.openBlockers.length > 0 ? (
            <View
              style={{
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: colors.error,
                backgroundColor: colors.errorSoft,
                padding: theme.spacing.md,
                gap: theme.spacing.xs,
              }}
            >
              <AppText variant="label" weight={titleWeight} style={{ color: colors.error }}>
                {t('mobile.blockers')}
              </AppText>
              {vm.openBlockers.map((b) => (
                <AppText key={b.id} variant="bodySecondary">
                  {b.reason}
                </AppText>
              ))}
            </View>
          ) : null}

          <TaskTimerBoard
            timing={vm.timing}
            formatDateTime={formatDateTime}
            isScheduledToday={vm.isScheduledToday}
          />

          {vm.attachments.length > 0 ? (
            <TaskFilePreview
              title={t('mobile.tasks.attachments')}
              files={vm.attachments}
              emptyLabel={t('mobile.tasks.noAttachments')}
              icon="document-attach-outline"
            />
          ) : null}

          {!vm.producesSemiFinished && vm.photos.length > 0 ? (
            <TaskFilePreview
              title={t('mobile.tasks.photos')}
              files={vm.photos}
              emptyLabel={t('mobile.noPhotos')}
              icon="camera-outline"
              preferImages
            />
          ) : null}

          {vm.producesSemiFinished ? (
            <TaskSemiOutputFloorSection
              ref={semiOutputRef}
              taskId={taskId}
              productionOrderId={vm.productionOrderId}
              expectedPieceCount={vm.expectedPieceCount ?? 1}
            />
          ) : (
            <FloorSection
              title={t('mobile.tasks.outputHandoffTitle')}
              isRTL={isRTL}
              locale={locale}
            >
              <AppText variant="body" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t('mobile.tasks.outputHandoffNone')}
              </AppText>
            </FloorSection>
          )}

          {offline && canComplete && vm.canFinish ? (
            <AppText variant="caption" color="muted" align="center">
              {t('mobile.tasks.finishRequiresOnline')}
            </AppText>
          ) : null}
        </ScrollView>

        <TaskActionDock
          actions={dockActions}
          bottomOffset={floorClearance}
          onHeight={onDockHeight}
        />
      </View>

      <ActionSheet
        open={uploadSheetOpen}
        onClose={() => setUploadSheetOpen(false)}
        title={t('mobile.tasks.uploadPhoto')}
        actions={uploadActions}
        cancelLabel={t('mobile.tasks.cancel')}
      />

      <BottomSheet
        open={problemSheetOpen}
        onClose={() => setProblemSheetOpen(false)}
        title={t('mobile.tasks.reportProblem')}
        sheetHeight={420}
      >
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="bodySecondary" color="secondary">
            {t('mobile.blockReason')}
          </AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.sm,
            }}
          >
            {BLOCK_CATEGORIES.map((cat) => {
              const active = problemCategory === cat;
              return (
                <Pressable
                  key={cat}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    void haptics.selection();
                    setProblemCategory(cat);
                  }}
                  style={{
                    paddingHorizontal: theme.spacing.lg,
                    paddingVertical: theme.spacing.md,
                    minHeight: theme.sizes.touch.min,
                    borderRadius: theme.radius.md,
                    backgroundColor: active ? colors.brand : colors.surfaceSecondary,
                    borderWidth: 1,
                    borderColor: active ? colors.brand : colors.border,
                    justifyContent: 'center',
                  }}
                >
                  <AppText
                    variant="label"
                    weight={active ? 'semibold' : 'medium'}
                    style={{ color: active ? colors.onBrand : colors.textPrimary }}
                  >
                    {t(`mobile.tasks.blocker.${cat}`)}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
          <TextField
            label={t('mobile.tasks.problemDetails')}
            value={problemReason}
            onChangeText={setProblemReason}
            multiline
            numberOfLines={3}
            placeholder={t('mobile.tasks.problemPlaceholder')}
          />
          <PrimaryButton
            label={t('mobile.tasks.submitProblem')}
            onPress={() => void onReportProblem()}
            loading={blockMutation.isPending}
            style={{ minHeight: theme.sizes.touch.min }}
          />
          <SecondaryButton
            label={t('mobile.tasks.cancel')}
            onPress={() => setProblemSheetOpen(false)}
          />
        </View>
      </BottomSheet>

      {vm.productionOrderId ? (
        <QcFailSheet
          open={qcFailOpen}
          onClose={() => setQcFailOpen(false)}
          productionOrderId={vm.productionOrderId}
          quantity={Number(raw?.productionOrder?.quantity) || 1}
          busy={qcBusy}
          onConfirm={(args) => void onConfirmQcFail(args)}
        />
      ) : null}
    </AppScreen>
  );
}

function taskDetailNavTitle(
  qualityKind: TaskQualityKind,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  if (qualityKind === 'packaging') {
    const label = t('production.stageLibrary.PACKAGING');
    if (label !== 'production.stageLibrary.PACKAGING') return label;
  }
  if (qualityKind === 'inspection' || qualityKind === 'reinspection') {
    const label = t('catalog.inspectionDetail');
    if (label !== 'catalog.inspectionDetail') return label;
  }
  return t('mobile.tasks.detailTitle');
}

function TaskDetailNav({
  onBack,
  title,
  subtitle,
  trailing,
}: {
  onBack: () => void;
  title: string;
  subtitle?: string | null;
  trailing?: ReactNode;
}) {
  const { t, isRTL, locale } = useLocale();
  const { theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        minHeight: theme.sizes.touch.min,
        marginBottom: theme.spacing.sm,
      }}
    >
      <BackButton onPress={onBack} label={t('mobile.tasks.back')} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText
          variant="title"
          weight={titleWeight}
          numberOfLines={1}
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {title}
        </AppText>
        {subtitle ? (
          <AppText
            variant="caption"
            color="secondary"
            numberOfLines={1}
            dir="ltr"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing ? (
        <View style={{ justifyContent: 'center', alignItems: 'center' }}>{trailing}</View>
      ) : null}
    </View>
  );
}

function FloorSection({
  title,
  children,
  isRTL,
  locale,
  sentenceCaseStamp = false,
}: {
  title: string;
  children: ReactNode;
  isRTL: boolean;
  locale: string;
  sentenceCaseStamp?: boolean;
}) {
  const { colors, theme, colorScheme } = useTheme();
  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        style={{
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm + 2,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <AppText
          variant="caption"
          weight="semibold"
          style={{
            color: colors.brand,
            letterSpacing: locale === 'ar' ? 0 : 0.4,
            fontSize: 11,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {title}
        </AppText>
      </View>
      <View style={{ padding: theme.spacing.md }}>{children}</View>
    </View>
  );
}
