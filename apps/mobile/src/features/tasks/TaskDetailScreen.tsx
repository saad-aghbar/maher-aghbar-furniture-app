import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Alert,
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
import { can, canAny } from '@maher/permissions';
import { createRequestId } from '@/api/requestId';
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
import { useLocale } from '@/i18n';
import { SuccessBurst, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useSmartBack } from '@/navigation/useSmartBack';
import { PendingOutboxBanner } from './components/PendingOutboxBanner';
import { TaskActionDock, type TaskDockAction } from './components/TaskActionDock';
import { TaskDetailSkeleton } from './components/TasksListSkeleton';
import { TaskFilePreview } from './components/TaskFilePreview';
import { TaskTimerBoard } from './components/TaskTimerBoard';
import { flushTaskOutbox } from './flushOutbox';
import { enqueueTaskPhoto, listTaskOutbox, type TaskOutboxItem } from './outbox';
import {
  useBlockTaskMutation,
  useCompleteTaskMutation,
  usePauseTaskMutation,
  useResumeTaskMutation,
  useStartTaskMutation,
  useTaskQuery,
} from './query';
import { selectTaskDetail } from './selectTask';
import type { TaskBlockerCategory, TaskDetail } from './api';

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

export function TaskDetailScreen({
  taskId,
  forceState,
  fixture,
}: TaskDetailScreenProps) {
  const { user } = useAuth();
  const { t, formatDateTime, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { width: windowW } = useWindowDimensions();
  const { showOfflineBanner, isConnected } = useNetwork();
  const { showToast } = useToast();
  const router = useRouter();
  const onBack = useSmartBack(TASKS_FALLBACK);
  const { openAccessoryCamera } = useAccessoryCamera();
  const offline = isConnected === false || forceState === 'offline';
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const pad = theme.spacing.lg;
  const mediaW = Math.max(0, windowW - pad * 2);
  const tabClearance = SURFACE_TAB_BAR_CLEARANCE;
  /** Floating dock (~2 rows) sits above the tab bar. */
  const dockBottom = tabClearance;

  const allowed = can(user, 'production-task.read');
  const canUpdate = canAny(user, [
    'production-task.update-own',
    'production-task.update-any',
  ]);
  const canComplete = can(user, 'production-task.complete');

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
  const completeKeyRef = useRef(`complete-${createRequestId()}`);

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
    flushing;

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

  async function onStart() {
    if (offline) {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.tasks.onlineRequired') });
      return;
    }
    try {
      await startMutation.mutateAsync();
      void haptics.confirmMedium();
      showToast({ variant: 'success', message: t('mobile.tasks.startedToast') });
    } catch {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.tasks.actionFailed') });
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
    } catch {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.tasks.actionFailed') });
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
    } catch {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.tasks.actionFailed') });
    }
  }

  async function onFinish() {
    // Never queue completion offline — must be explicit and online.
    if (offline) {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.tasks.finishRequiresOnline') });
      return;
    }
    if (vm?.requiresPhotos && !(vm.photos.length > 0) && outbox.every((i) => i.kind !== 'photo')) {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.tasks.photosRequired') });
      return;
    }
    try {
      // Flush pending photos first so requiresPhotos checks pass server-side.
      await flushTaskOutbox(taskId);
      await completeMutation.mutateAsync({
        idempotencyKey: completeKeyRef.current,
      });
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setFinishedBurst(true);
      showToast({ variant: 'success', message: t('mobile.tasks.finishedToast') });
      setTimeout(() => {
        router.replace('/(app)/(employee)/(tabs)/completed' as Href);
      }, 700);
    } catch {
      void haptics.error();
      showToast({ variant: 'error', message: t('mobile.tasks.actionFailed') });
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
        Alert.alert(t('mobile.tasks.galleryPermission'));
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
    if (!vm) return actions;
    if (canUpdate && vm.canStart) {
      actions.push({
        key: 'start',
        label: t('mobile.tasks.startTask'),
        icon: 'play',
        primary: true,
        onPress: () => void onStart(),
        loading: startMutation.isPending,
        disabled: busy,
      });
    } else if (canUpdate && vm.canStop) {
      actions.push({
        key: 'stop',
        label: t('mobile.tasks.stopTask'),
        icon: 'pause',
        onPress: () => void onStop(),
        loading: pauseMutation.isPending,
        disabled: busy || offline,
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
    if (canUpdate && vm.canUploadPhoto) {
      actions.push({
        key: 'photo',
        label: t('mobile.tasks.uploadPhoto'),
        icon: 'camera-outline',
        onPress: () => setUploadSheetOpen(true),
        disabled: busy,
      });
    }
    if (canUpdate && vm.canReportProblem) {
      actions.push({
        key: 'problem',
        label: t('mobile.tasks.reportProblem'),
        icon: 'warning-outline',
        onPress: () => setProblemSheetOpen(true),
        disabled: busy,
      });
    }
    if (canComplete && vm.canFinish && !finishedBurst) {
      actions.push({
        key: 'finish',
        label: t('mobile.tasks.markFinished'),
        holdLabel: t('mobile.tasks.holdToFinish'),
        icon: 'checkmark-circle-outline',
        holdConfirm: true,
        onPress: () => void onFinish(),
        loading: completeMutation.isPending,
        disabled: busy || offline,
      });
    }
    return actions.slice(0, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers stable enough for dock
  }, [
    busy,
    canComplete,
    canUpdate,
    completeMutation.isPending,
    finishedBurst,
    offline,
    pauseMutation.isPending,
    resumeMutation.isPending,
    startMutation.isPending,
    t,
    vm,
  ]);

  const dockScrollPad = dockActions.length > 0 ? 128 : 0;

  if (forceState === 'loading' || (allowed && query.isLoading && !query.data && !forceState)) {
    return (
      <AppScreen backFallback={TASKS_FALLBACK}>
        <TaskDetailSkeleton />
      </AppScreen>
    );
  }

  if (!allowed && !forceState) {
    return (
      <AppScreen backFallback={TASKS_FALLBACK}>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (forceState === 'error' || (query.isError && !raw && !forceState)) {
    return (
      <AppScreen backFallback={TASKS_FALLBACK}>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ErrorState
          title={t('mobile.tasks.detailErrorTitle')}
          description={t('mobile.tasks.errorBody')}
          retryLabel={t('mobile.tasks.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  if (!vm) {
    return (
      <AppScreen backFallback={TASKS_FALLBACK}>
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
          title={t('mobile.tasks.detailTitle')}
          subtitle={vm.orderNumber}
          trailing={<StatusBadge status={vm.status} />}
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
                if (!offline) void onFlushOutbox();
              }}
              tintColor={colors.brand}
            />
          }
          contentContainerStyle={{
            paddingHorizontal: pad,
            paddingBottom: theme.spacing.xl + tabClearance + dockScrollPad,
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
                  letterSpacing: locale === 'ar' ? 0 : 0.6,
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

          <TaskTimerBoard
            timing={vm.timing}
            formatDateTime={formatDateTime}
            isScheduledToday={vm.isScheduledToday}
          />

          <FloorSection
            title={t('mobile.tasks.instructions')}
            isRTL={isRTL}
            locale={locale}
          >
            <AppText
              variant="body"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {vm.instructions || t('mobile.tasks.noInstructions')}
            </AppText>
          </FloorSection>

          {vm.notes ? (
            <FloorSection title={t('mobile.tasks.notes')} isRTL={isRTL} locale={locale}>
              <AppText variant="body" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {vm.notes}
              </AppText>
            </FloorSection>
          ) : null}

          {vm.waitingOn ? (
            <AppText variant="bodySecondary" color="warning">
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

          <TaskFilePreview
            title={t('mobile.tasks.attachments')}
            files={vm.attachments}
            emptyLabel={t('mobile.tasks.noAttachments')}
            icon="document-attach-outline"
          />

          <TaskFilePreview
            title={t('mobile.tasks.photos')}
            files={vm.photos}
            emptyLabel={t('mobile.noPhotos')}
            icon="camera-outline"
            preferImages
          />

          {offline && canComplete && vm.canFinish ? (
            <AppText variant="caption" color="muted" align="center">
              {t('mobile.tasks.finishRequiresOnline')}
            </AppText>
          ) : null}
        </ScrollView>

        <TaskActionDock actions={dockActions} bottomOffset={dockBottom} />
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
    </AppScreen>
  );
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
}: {
  title: string;
  children: ReactNode;
  isRTL: boolean;
  locale: string;
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
            letterSpacing: locale === 'ar' ? 0 : 0.6,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
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
