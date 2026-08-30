import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { FlatList, Image, RefreshControl, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { can, canAny } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { AppScreen } from '@/components/layout/AppScreen';
import { ImageViewer } from '@/components/media/ImageViewer';
import { useNetwork } from '@/components/network/NetworkProvider';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { SurfaceCard } from '@/components/surfaces/SurfaceCard';
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
  DeliveryDateSheet,
  PrioritySheet,
} from './components/PriorityDeliverySheets';
import { ProductionListSkeleton } from './components/ProductionSkeleton';
import { ProductionMaterialsCard } from './components/ProductionMaterialsCard';
import { AdminScheduleStrip } from './components/AdminScheduleStrip';
import { ProductionTaskCard } from './components/ProductionTaskCard';
import { ProductionTaskSheet } from './components/ProductionTaskSheet';
import {
  useAssignableWorkersQuery,
  useAssignTaskMutation,
  useBlockTaskMutation,
  usePauseTaskMutation,
  useProductionOrderQuery,
  useProductionMaterialsQuery,
  useReturnUnusedMaterialMutation,
  useUnblockTaskMutation,
  useUpdateProductionMutation,
  useUpdateTaskNotesMutation,
} from './query';
import { selectProductionDetail, type ProductionTaskRow } from './selectProduction';

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
  const { t, locale, isRTL, formatCurrency } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const router = useRouter();
  const reduce = useReducedMotion();

  const canRead = can(user, 'production-order.read');
  const canAssign = can(user, 'production-order.assign');
  const canUpdate = can(user, 'production-order.update');
  const canUpdateTask = canAny(user, [
    'production-task.update-any',
    'production-task.update-own',
  ]);
  const canUnblock = can(user, 'production-task.update-any');

  const [activeTask, setActiveTask] = useState<ProductionTaskRow | null>(null);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [confirmUnblock, setConfirmUnblock] = useState<{
    taskId: string;
    name: string;
  } | null>(null);
  const [viewCompleted, setViewCompleted] = useState(false);
  const listRef = useRef<FlatList<ProductionTaskRow>>(null);

  const query = useProductionOrderQuery(orderId, canRead);
  const materialsQuery = useProductionMaterialsQuery(orderId, canRead && canUpdate);
  const returnMaterialMutation = useReturnUnusedMaterialMutation(orderId);
  const workersQuery = useAssignableWorkersQuery(canAssign);
  const assignMutation = useAssignTaskMutation(orderId);
  const updateMutation = useUpdateProductionMutation(orderId);
  const unblockMutation = useUnblockTaskMutation(orderId);
  const notesMutation = useUpdateTaskNotesMutation(orderId);
  const pauseMutation = usePauseTaskMutation(orderId);
  const blockMutation = useBlockTaskMutation(orderId);

  const detail = useMemo(
    () => (query.data ? selectProductionDetail(query.data, locale) : null),
    [query.data, locale],
  );

  const taskRows = useMemo(() => {
    if (!detail) return [];
    if (viewCompleted) return detail.tasks.filter((task) => task.isCompleted);
    return detail.tasks;
  }, [detail, viewCompleted]);

  const sheetTask = useMemo(() => {
    if (!activeTask || !detail) return activeTask;
    return detail.tasks.find((t) => t.id === activeTask.id) ?? activeTask;
  }, [activeTask, detail]);

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
  const boardShadow = theme.elevation.card;
  /** Last stage row clears the floating pill — same leftover inset as other admin surfaces. */
  const listBottomPad = insets.bottom + SURFACE_TAB_BAR_CLEARANCE;
  const materialsReady = (materialsQuery.data?.materials?.length ?? 0) > 0;
  const workersReady =
    detail.taskCount > 0 && detail.assignedWorkerCount >= detail.taskCount;

  return (
    <AppScreen backFallback={'/(app)/(admin)/(tabs)/production' as Href}>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <FlatList
        ref={listRef}
        data={taskRows}
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
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.lg, marginBottom: theme.spacing.sm }}>
            {detail.estimatedManufacturingCost != null ? (
              <HeaderEnter reduce={reduce} delay={0}>
                <SurfaceCard>
                  <View style={{ gap: theme.spacing.sm }}>
                    <AppText variant="heading" weight="semibold">
                      {detail.actualManufacturingCost != null
                        ? t('mobile.production.manufacturingCostActualTitle')
                        : t('mobile.production.manufacturingCostEstimated')}
                    </AppText>
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
                </SurfaceCard>
              </HeaderEnter>
            ) : null}

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

                    <View
                      style={{
                        height: StyleSheet.hairlineWidth,
                        backgroundColor: colors.border,
                        alignSelf: 'stretch',
                      }}
                    />

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

            <HeaderEnter reduce={reduce} delay={80}>
              <AdminScheduleStrip productionOrderId={detail.id} />
            </HeaderEnter>

            <HeaderEnter reduce={reduce} delay={120}>
              <View style={{ gap: theme.spacing.md }}>
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

                {canUpdate && (materialsQuery.data?.materials?.length ?? 0) > 0 ? (
                  <ProductionMaterialsCard
                    materials={materialsQuery.data?.materials ?? []}
                    returningItemId={
                      returnMaterialMutation.isPending
                        ? returnMaterialMutation.variables?.inventoryItemId
                        : null
                    }
                    onReturn={(row) => {
                      returnMaterialMutation.mutate(
                        {
                          inventoryItemId: row.inventoryItem.id,
                          quantity: row.returnableQty,
                          idempotencyKey: `prod-return:${orderId}:${row.inventoryItem.id}:${row.returnableQty}`,
                        },
                        {
                          onSuccess: () => {
                            showToast({
                              variant: 'success',
                              message: t('mobile.production.materialReturned'),
                            });
                            void materialsQuery.refetch();
                          },
                          onError: () => {
                            showToast({
                              variant: 'error',
                              message: t('mobile.production.materialsNotReady'),
                            });
                          },
                        },
                      );
                    }}
                  />
                ) : null}

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
              </View>
            </HeaderEnter>

            {detail.openBlockers.length > 0 ? (
              <HeaderEnter reduce={reduce} delay={160}>
                <SurfaceCard>
                  <AppText
                    variant="heading"
                    weight="semibold"
                    style={{ marginBottom: theme.spacing.sm }}
                  >
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
                </SurfaceCard>
              </HeaderEnter>
            ) : null}

            <HeaderEnter reduce={reduce} delay={180}>
              <View style={{ gap: theme.spacing.md }}>
                <View style={{ gap: theme.spacing['2xs'] }}>
                  <AppText variant="caption" color="muted" weight="medium">
                    {t('mobile.production.planKicker')}
                  </AppText>
                  <AppText variant="heading" weight="semibold">
                    {t('mobile.production.planTitle')}
                  </AppText>
                </View>
                <SurfaceCard>
                  <View style={{ gap: theme.spacing.sm }}>
                    <ReadinessRow
                      done={detail.planSetupReady}
                      label={t('mobile.production.readinessSetup')}
                      isRTL={isRTL}
                    />
                    <ReadinessRow
                      done={detail.taskCount > 0}
                      label={t('mobile.production.readinessWorkflow')}
                      isRTL={isRTL}
                    />
                    <ReadinessRow
                      done={materialsReady}
                      label={t('mobile.production.materials')}
                      isRTL={isRTL}
                    />
                    <ReadinessRow
                      done={workersReady}
                      label={t('mobile.production.readinessWorkers', {
                        assigned: detail.assignedWorkerCount,
                        total: detail.taskCount,
                      })}
                      isRTL={isRTL}
                    />
                  </View>
                </SurfaceCard>
                {canAssign ? (
                  <PrimaryButton
                    label={t('mobile.production.assignWorkersAndDates')}
                    onPress={() => {
                      if (viewCompleted) setViewCompleted(false);
                      const next = detail.tasks.find(
                        (task) => task.canAssign && !task.assigneeId,
                      );
                      if (next) {
                        setActiveTask(next);
                        return;
                      }
                      if (taskRows.length > 0) {
                        listRef.current?.scrollToIndex({ index: 0, animated: true });
                      }
                    }}
                  />
                ) : null}
              </View>
            </HeaderEnter>

            <HeaderEnter reduce={reduce} delay={200}>
              <AppText variant="heading" weight="semibold">
                {viewCompleted
                  ? t('mobile.production.completedTasks')
                  : t('mobile.production.stageAssignments')}
              </AppText>
            </HeaderEnter>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={t('mobile.production.emptyTasksTitle')}
            description={t('mobile.production.emptyTasksBody')}
          />
        }
        renderItem={({ item, index }) => (
          <ListItemEnter index={index}>
            <ProductionTaskCard
              task={item}
              onPress={() => setActiveTask(item)}
            />
          </ListItemEnter>
        )}
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
              plannedCompletion: payload.plannedCompletion,
              estimatedMinutes: payload.estimatedMinutes,
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
