import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { usePreventRemove } from '@react-navigation/native';
import { useNavigation, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { can } from '@maher/permissions';
import { localizedName } from '@maher/i18n';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import type { WorkflowNode } from '@/api/modules/workflow';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { stageNodeLabel } from './stageNodeLabel';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { ScrollableScreen } from '@/components/layout/ScrollableScreen';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { useNetwork } from '@/components/network/NetworkProvider';
import { SurfaceCard } from '@/components/surfaces/SurfaceCard';
import { ProductionFlowMap } from '@/features/production-flow/components/ProductionFlowMap';
import { useLocale } from '@/i18n';
import { ListItemEnter, haptics } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useSmartBack } from '@/navigation/useSmartBack';
import { useTheme } from '@/theme';
import { AddStageSheet } from './components/AddStageSheet';
import { EditStageSheet } from './components/EditStageSheet';
import { WorkflowFloorBoard, WorkflowFloorRow } from './components/WorkflowFloorList';
import { WorkflowPageHeader, WorkflowStatusPill } from './components/WorkflowPageHeader';
import { commitHealSingleSink, useApplyWorkflowVersionCache } from './commitWorkflowGraph';
import { selectProductionFlowFromWorkflowVersion } from './selectProductionFlowFromWorkflowVersion';
import {
  useCreateDraftMutation,
  useDiscardWorkflowDraftMutation,
  usePublishWorkflowMutation,
  useWorkflowQuery,
  useWorkflowVersionQuery,
} from './query';

type Props = {
  workflowId: string;
  backFallback: Href;
};

export function WorkflowDetailScreen({ workflowId, backFallback }: Props) {
  const { user } = useAuth();
  const { t, locale } = useLocale();
  const { theme, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const navigation = useNavigation();
  const smartBack = useSmartBack(backFallback);
  const canManage = can(user, 'production.workflow.manage');
  const canPublish = can(user, 'production.workflow.publish');
  /** ScrollView `gap` can drop paddingBottom — spacer uses the requested tab-bar inset. */
  const listBottomClearance = insets.bottom + SURFACE_TAB_BAR_CLEARANCE;

  const [addOpen, setAddOpen] = useState(false);
  const [editNode, setEditNode] = useState<WorkflowNode | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [ensuringDraft, setEnsuringDraft] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [publishedThisSession, setPublishedThisSession] = useState(false);

  const workflowQuery = useWorkflowQuery(workflowId);
  const draftVersionId = useMemo(() => {
    const draft = workflowQuery.data?.versions.find((v) => v.status === 'DRAFT');
    return draft?.id ?? null;
  }, [workflowQuery.data?.versions]);

  const editableVersionId =
    draftVersionId ?? workflowQuery.data?.activeVersion?.id ?? workflowQuery.data?.versions[0]?.id;

  const versionQuery = useWorkflowVersionQuery(
    workflowId,
    editableVersionId,
    Boolean(editableVersionId),
  );
  const createDraftMutation = useCreateDraftMutation(workflowId);
  const publishMutation = usePublishWorkflowMutation(workflowId, draftVersionId ?? '');
  const discardMutation = useDiscardWorkflowDraftMutation(workflowId);
  const applyVersionCache = useApplyWorkflowVersionCache(
    workflowId,
    draftVersionId ?? editableVersionId ?? '',
  );
  const draftKickoffRef = useRef(false);
  const sessionCreatedDraftIdRef = useRef<string | null>(null);
  const pendingLeaveActionRef = useRef<unknown>(null);
  const leaveDispatchedRef = useRef(false);
  const [leaveArmed, setLeaveArmed] = useState(false);

  const markDirty = useCallback(() => setDirty(true), []);

  useEffect(() => {
    if (!canManage || !workflowQuery.data || draftVersionId) {
      draftKickoffRef.current = false;
      return;
    }
    if (ensuringDraft || createDraftMutation.isPending || draftKickoffRef.current) return;
    const source =
      workflowQuery.data.activeVersion?.id ?? workflowQuery.data.versions[0]?.id;
    draftKickoffRef.current = true;
    setEnsuringDraft(true);
    createDraftMutation.mutate(source, {
      onSuccess: (created) => {
        const id = (created as { id?: string })?.id;
        if (id) sessionCreatedDraftIdRef.current = id;
      },
      onSettled: () => setEnsuringDraft(false),
      onError: (err) => {
        draftKickoffRef.current = false;
        showToast({
          variant: 'error',
          message: isApiError(err)
            ? toastMessageForError(err)
            : t('mobile.production.workflow.loadError'),
        });
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, draftVersionId, ensuringDraft, showToast, t, workflowQuery.data]);

  const leaveNow = useCallback(() => {
    setDiscardOpen(false);
    setLeaveArmed(true);
  }, []);

  const performDiscardThenLeave = useCallback(async () => {
    if (!draftVersionId) {
      leaveNow();
      return;
    }
    try {
      await discardMutation.mutateAsync(draftVersionId);
      sessionCreatedDraftIdRef.current = null;
      setDirty(false);
    } catch (err) {
      showToast({
        variant: 'error',
        message: isApiError(err)
          ? toastMessageForError(err)
          : t('mobile.production.workflow.loadError'),
      });
      return;
    }
    leaveNow();
  }, [discardMutation, draftVersionId, leaveNow, showToast, t]);

  const preventLeave = dirty && !publishedThisSession && !leaveArmed;

  usePreventRemove(preventLeave, (event: { data: { action: unknown } }) => {
    pendingLeaveActionRef.current = event.data.action;
    setDiscardOpen(true);
  });

  useEffect(() => {
    if (!leaveArmed || leaveDispatchedRef.current) return;
    leaveDispatchedRef.current = true;
    const action = pendingLeaveActionRef.current;
    pendingLeaveActionRef.current = null;
    if (action && typeof navigation.dispatch === 'function') {
      navigation.dispatch(action as never);
      return;
    }
    smartBack();
  }, [leaveArmed, navigation, smartBack]);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', () => {
      if (publishedThisSession || dirty || leaveArmed) return;
      const draftId = draftVersionId;
      if (!draftId || sessionCreatedDraftIdRef.current !== draftId) return;
      sessionCreatedDraftIdRef.current = null;
      discardMutation.mutate(draftId);
    });
    return unsub;
  }, [dirty, discardMutation, draftVersionId, leaveArmed, navigation, publishedThisSession]);

  const version = versionQuery.data;
  const previewStages = useMemo(
    () => (version ? selectProductionFlowFromWorkflowVersion(version, locale) : []),
    [locale, version],
  );

  if (workflowQuery.isLoading || ensuringDraft || createDraftMutation.isPending) {
    return (
      <ScrollableScreen>
        <WorkflowPageHeader
          fallback={backFallback}
          title={t('mobile.production.workflow.title')}
        />
        <AppText>{t('mobile.production.workflow.preparingEditor')}</AppText>
      </ScrollableScreen>
    );
  }

  if (workflowQuery.isError || !workflowQuery.data) {
    return (
      <ScrollableScreen>
        <WorkflowPageHeader
          fallback={backFallback}
          title={t('mobile.production.workflow.title')}
        />
        <ErrorState
          title={t('mobile.production.workflow.loadError')}
          retryLabel={t('mobile.production.workflow.retry')}
          onRetry={() => void workflowQuery.refetch()}
        />
      </ScrollableScreen>
    );
  }

  const wf = workflowQuery.data;
  const title = localizedName(locale, wf, wf.code);
  const nodes = [...(version?.nodes ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const isDraft = Boolean(draftVersionId && version?.id === draftVersionId);

  return (
    <>
      <ScrollableScreen contentContainerStyle={{ paddingBottom: 0 }}>
        {showOfflineBanner ? <OfflineBanner /> : null}

        <WorkflowPageHeader
          fallback={backFallback}
          title={title}
          subtitle={t('mobile.production.workflow.stagesHint')}
          status={
            <View style={{ gap: theme.spacing.sm }}>
              <WorkflowStatusPill
                active={isDraft}
                label={
                  isDraft
                    ? t('mobile.production.workflow.editingDraft', {
                        version: version?.versionNumber ?? '—',
                      })
                    : t('mobile.production.workflow.viewingPublished')
                }
              />
              {isDraft && dirty ? (
                <AppText variant="caption" color="muted">
                  {t('mobile.production.workflow.unpublishedHint')}
                </AppText>
              ) : null}
            </View>
          }
        />

        {versionQuery.isLoading ? (
          <AppText color="secondary">{t('mobile.production.loadingMore')}</AppText>
        ) : nodes.length === 0 ? (
          <EmptyState
            title={t('mobile.production.workflow.emptyStages')}
            description={t('mobile.production.workflow.emptyStagesHint')}
          />
        ) : (
          <WorkflowFloorBoard
            title={t('mobile.production.workflow.stagesHeading')}
            count={nodes.length}
          >
            {nodes.map((node, index) => {
              const preds = (version?.edges ?? [])
                .filter((e) => e.toNodeId === node.id)
                .map((e) => nodes.find((n) => n.id === e.fromNodeId))
                .filter(Boolean);
              const afterMeta = preds.length
                ? t('mobile.production.workflow.afterStages', {
                    stages: preds
                      .map((p) => stageNodeLabel(locale, p!.stageDefinition))
                      .join(', '),
                  })
                : t('mobile.production.workflow.startStage');
              const reqMeta = node.isRequiredByDefault
                ? t('mobile.production.workflow.required')
                : t('mobile.production.workflow.optional');
              return (
                <ListItemEnter key={node.id} index={index}>
                  <WorkflowFloorRow
                    label={stageNodeLabel(locale, node.stageDefinition)}
                    meta={`${afterMeta} · ${reqMeta}`}
                    badge={String(index + 1)}
                    showChevron={!(isDraft && canManage)}
                    onPress={
                      isDraft && canManage
                        ? () => {
                            void haptics.selection();
                            setEditNode(node);
                          }
                        : undefined
                    }
                    trailing={
                      isDraft && canManage ? (
                        <Ionicons name="create-outline" size={18} color={colors.brand} />
                      ) : null
                    }
                  />
                </ListItemEnter>
              );
            })}
          </WorkflowFloorBoard>
        )}

        {previewStages.length > 0 ? (
          <SurfaceCard>
            <View style={{ gap: theme.spacing.md }}>
              <AppText variant="body" weight="semibold">
                {t('mobile.production.workflow.preview')}
              </AppText>
              <AppText variant="caption" color="muted">
                {t('mobile.production.workflow.chartPreviewHint')}
              </AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <ProductionFlowMap stages={previewStages} preview />
              </ScrollView>
            </View>
          </SurfaceCard>
        ) : null}

        {isDraft && canManage ? (
          <PrimaryButton
            label={t('mobile.production.workflow.addStage')}
            onPress={() => setAddOpen(true)}
            leading={<Ionicons name="add" size={18} color={colors.onBrand} />}
            style={{ borderRadius: theme.radius.xl }}
          />
        ) : null}

        {isDraft && canPublish ? (
          <SecondaryButton
            label={t('mobile.production.workflow.publish')}
            onPress={() => {
              void haptics.selection();
              setPublishOpen(true);
            }}
            style={{ borderRadius: theme.radius.xl }}
          />
        ) : null}

        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ height: listBottomClearance }}
        />
      </ScrollableScreen>

      {isDraft && version ? (
        <AddStageSheet
          open={addOpen}
          onClose={() => setAddOpen(false)}
          workflowId={workflowId}
          version={version}
          onDirty={markDirty}
        />
      ) : null}

      {isDraft && version ? (
        <EditStageSheet
          open={Boolean(editNode)}
          onClose={() => setEditNode(null)}
          workflowId={workflowId}
          version={version}
          node={editNode}
          onDirty={markDirty}
        />
      ) : null}

      <ConfirmationSheet
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title={t('mobile.production.workflow.publishConfirm')}
        message={t('mobile.production.workflow.futureOrdersOnly')}
        confirmLabel={t('mobile.production.workflow.publish')}
        onConfirm={() => {
          if (!version || !draftVersionId) return;
          void (async () => {
            try {
              const healed = await commitHealSingleSink({ workflowId, version });
              await applyVersionCache(healed);
              publishMutation.mutate(healed.revision, {
                onSuccess: () => {
                  setPublishOpen(false);
                  setDirty(false);
                  setPublishedThisSession(true);
                  sessionCreatedDraftIdRef.current = null;
                  showToast({
                    variant: 'success',
                    message: t('mobile.production.workflow.published'),
                  });
                },
                onError: (err) => {
                  showToast({
                    variant: 'error',
                    message: isApiError(err)
                      ? toastMessageForError(err)
                      : t('mobile.production.workflow.loadError'),
                  });
                },
              });
            } catch (err) {
              showToast({
                variant: 'error',
                message: isApiError(err)
                  ? toastMessageForError(err)
                  : t('mobile.production.workflow.loadError'),
              });
            }
          })();
        }}
      />

      <ConfirmationSheet
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title={t('mobile.production.workflow.discardChanges')}
        message={t('mobile.production.workflow.discardConfirm')}
        confirmLabel={t('mobile.production.workflow.discardChanges')}
        destructive
        onConfirm={() => {
          void performDiscardThenLeave();
        }}
      />
    </>
  );
}
