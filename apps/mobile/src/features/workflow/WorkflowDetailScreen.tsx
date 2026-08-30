import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { usePreventRemove } from '@react-navigation/native';
import { useNavigation, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { can } from '@maher/permissions';
import { localizedName } from '@maher/i18n';
import {
  detectParallelBandLinks,
  type ParallelBandLink,
  type ParallelBandLinkMode,
} from '@maher/workflow-domain';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import type { WorkflowNode } from '@/api/modules/workflow';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
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
import { useSmartBack } from '@/navigation/useSmartBack';
import { useTheme } from '@/theme';
import { AddStageSheet } from './components/AddStageSheet';
import { EditStageSheet } from './components/EditStageSheet';
import { ParallelBandLinkControl } from './components/ParallelBandLinkControl';
import {
  WorkflowFloorBoard,
  WorkflowFloorRow,
  WorkflowStageRowActions,
} from './components/WorkflowFloorList';
import { WorkflowPageHeader, WorkflowStatusPill } from './components/WorkflowPageHeader';
import {
  commitCanonicalizeDraft,
  commitParallelBandLink,
  commitRemoveWorkflowStage,
  useApplyWorkflowVersionCache,
} from './commitWorkflowGraph';
import { selectProductionFlowFromWorkflowVersion } from './selectProductionFlowFromWorkflowVersion';
import {
  isLockedAnchorNode,
  partitionWorkflowAnchors,
} from './workflowTerminal';
import { buildWorkflowLayoutLevels } from './workflowLayout';
import { canonicalEdgesForLayout, toDomainGraph } from './toDomainGraph';
import { ensureOpeningChain, ensureTerminalChain } from '@/api/modules/workflow';
import {
  useCreateDraftMutation,
  useDiscardWorkflowDraftMutation,
  usePublishWorkflowMutation,
  useWorkflowQuery,
  useWorkflowVersionQuery,
} from './query';

function linkLeavingLevel(
  links: ParallelBandLink[],
  levelIds: Set<string>,
): ParallelBandLink | null {
  let best: ParallelBandLink | null = null;
  let bestScore = 0;
  for (const link of links) {
    const fromHits = link.fromBand.nodeIds.filter((id) => levelIds.has(id)).length;
    if (fromHits < 2) continue;
    // Prefer when the whole feeder band sits on this level
    const complete = fromHits === link.fromBand.nodeIds.length;
    const score = fromHits + (complete ? 10 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = link;
    }
  }
  return best;
}

function linkForLevelGap(
  links: ParallelBandLink[],
  prevIds: Set<string>,
  nextIds: Set<string>,
): ParallelBandLink | null {
  let best: ParallelBandLink | null = null;
  let bestScore = 0;
  for (const link of links) {
    const fromHits = link.fromBand.nodeIds.filter((id) => prevIds.has(id)).length;
    const toHits = link.toBand.nodeIds.filter((id) => nextIds.has(id)).length;
    if (fromHits < 2 || toHits < 2) continue;
    const score = fromHits + toHits;
    if (score > bestScore) {
      bestScore = score;
      best = link;
    }
  }
  return best;
}
type Props = {
  workflowId: string;
  backFallback: Href;
};

export function WorkflowDetailScreen({ workflowId, backFallback }: Props) {
  const { user } = useAuth();
  const { t, locale } = useLocale();
  const { theme, colors } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const navigation = useNavigation();
  const smartBack = useSmartBack(backFallback);
  const canManage = can(user, 'production.workflow.manage');
  const canPublish = can(user, 'production.workflow.publish');

  const [addOpen, setAddOpen] = useState(false);
  const [editNode, setEditNode] = useState<WorkflowNode | null>(null);
  const [deleteNode, setDeleteNode] = useState<WorkflowNode | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [lockInfoNode, setLockInfoNode] = useState<WorkflowNode | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [ensuringDraft, setEnsuringDraft] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [publishedThisSession, setPublishedThisSession] = useState(false);
  const [bandLinkSaving, setBandLinkSaving] = useState(false);

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
  const allNodes = useMemo(
    () => [...(version?.nodes ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [version?.nodes],
  );
  const { opening: openingNodes, middle: middleNodes, terminal: terminalNodes } = useMemo(
    () => partitionWorkflowAnchors(allNodes),
    [allNodes],
  );
  const canonical = useMemo(() => (version ? toDomainGraph(version) : null), [version]);
  const healedEdges = useMemo(
    () => (canonical ? canonicalEdgesForLayout(canonical) : []),
    [canonical],
  );
  const layoutLevels = useMemo(
    () => buildWorkflowLayoutLevels(allNodes, healedEdges),
    [allNodes, healedEdges],
  );
  const bandLinks = useMemo(
    () => (canonical ? detectParallelBandLinks(canonical) : []),
    [canonical],
  );
  const isDraft = Boolean(draftVersionId && version?.id === draftVersionId);

  const applyBandLink = useCallback(
    async (link: ParallelBandLink, mode: ParallelBandLinkMode) => {
      if (!version || !isDraft || bandLinkSaving) return;
      if (link.mode === mode) return;
      setBandLinkSaving(true);
      try {
        const next = await commitParallelBandLink({
          workflowId,
          version,
          fromBandNodeIds: link.fromBand.nodeIds,
          toBandNodeIds: link.toBand.nodeIds,
          mode,
        });
        await applyVersionCache(next);
        markDirty();
        showToast({
          variant: 'success',
          message: t('mobile.production.workflow.bandLinkSaved'),
        });
      } catch (err) {
        showToast({
          variant: 'error',
          message: isApiError(err)
            ? toastMessageForError(err)
            : t('mobile.production.workflow.loadError'),
        });
      } finally {
        setBandLinkSaving(false);
      }
    },
    [
      applyVersionCache,
      bandLinkSaving,
      isDraft,
      markDirty,
      showToast,
      t,
      version,
      workflowId,
    ],
  );
  const ensuredVersionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isDraft || !version || ensuredVersionRef.current === version.id) return;
    const hasOpening = allNodes.some((n) => n.stageDefinition?.code === 'MATERIAL_PREP');
    if (terminalNodes.length >= 3 && hasOpening) {
      ensuredVersionRef.current = version.id;
      return;
    }
    ensuredVersionRef.current = version.id;
    void (async () => {
      try {
        let revision = version.revision;
        if (!hasOpening) {
          const open = await ensureOpeningChain(workflowId, version.id, revision);
          revision = open.revision;
        }
        if (terminalNodes.length < 3) {
          await ensureTerminalChain(workflowId, version.id, revision);
        }
        await versionQuery.refetch();
        await workflowQuery.refetch();
      } catch {
        /* publish will append */
      }
    })();
  }, [allNodes, isDraft, terminalNodes.length, version, versionQuery, workflowId, workflowQuery]);

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

  return (
    <>
      <ScrollableScreen>
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
        ) : (
          <>
            <WorkflowFloorBoard
              title={t('mobile.production.workflow.stagesHeading')}
              count={openingNodes.length + middleNodes.length + terminalNodes.length}
            >
              {layoutLevels.map((level, levelIndex) => {
                const levelIds = new Set(level.lanes.flatMap((l) => l.nodes.map((n) => n.id)));
                const prevLevel = levelIndex > 0 ? layoutLevels[levelIndex - 1] : null;
                const prevIds = new Set(
                  prevLevel?.lanes.flatMap((l) => l.nodes.map((n) => n.id)) ?? [],
                );
                const nextLevel =
                  levelIndex + 1 < layoutLevels.length ? layoutLevels[levelIndex + 1] : null;
                const nextIds = new Set(
                  nextLevel?.lanes.flatMap((l) => l.nodes.map((n) => n.id)) ?? [],
                );
                const gapLink =
                  prevLevel && isDraft && canManage
                    ? linkForLevelGap(bandLinks, prevIds, levelIds)
                    : null;
                const nextGap =
                  nextLevel && isDraft && canManage
                    ? linkForLevelGap(bandLinks, levelIds, nextIds)
                    : null;
                const leaveLinkFor = (
                  fromIds: Set<string>,
                  towardIds: Set<string>,
                ): ParallelBandLink | null => {
                  if (!isDraft || !canManage) return null;
                  const leaving = linkLeavingLevel(bandLinks, fromIds);
                  if (!leaving) return null;
                  const toHits = leaving.toBand.nodeIds.filter((id) => towardIds.has(id)).length;
                  return toHits >= 1 ? leaving : null;
                };
                // After a feeder band when the next level is too messy for a clean gap match
                const leaveLink = !nextGap ? leaveLinkFor(levelIds, nextIds) : null;
                const prevLeave =
                  prevLevel && !gapLink ? leaveLinkFor(prevIds, levelIds) : null;

                return (
                <View key={`lv-${level.level}`} style={{ gap: theme.spacing.sm }}>
                  {levelIndex > 0 && !gapLink && !prevLeave ? (
                    <View style={{ alignItems: 'center' }}>
                      <Ionicons name="arrow-down" size={14} color={colors.brand} />
                    </View>
                  ) : null}
                  {gapLink ? (
                    <ParallelBandLinkControl
                      mode={gapLink.mode}
                      disabled={!isDraft || !canManage}
                      saving={bandLinkSaving}
                      onChange={(mode) => void applyBandLink(gapLink, mode)}
                    />
                  ) : null}
                  {level.lanes.map((lane) => {
                    const rows = lane.nodes.map((node) => {
                      const locked = isLockedAnchorNode(node);
                      return (
                        <ListItemEnter key={node.id} index={0}>
                          <WorkflowFloorRow
                            label={stageNodeLabel(locale, node.stageDefinition)}
                            meta={
                              locked
                                ? t('mobile.production.workflow.openingLocked')
                                : t('mobile.production.workflow.required')
                            }
                            icon={locked ? 'lock-closed' : 'git-network-outline'}
                            active={lockInfoNode?.id === node.id || editNode?.id === node.id}
                            showChevron={!(isDraft && canManage) && !locked}
                            onPress={
                              isDraft && canManage
                                ? () => {
                                    void haptics.selection();
                                    if (locked) setLockInfoNode(node);
                                    else setEditNode(node);
                                  }
                                : undefined
                            }
                            trailing={
                              locked ? (
                                <Ionicons name="lock-closed" size={16} color={colors.textSecondary} />
                              ) : isDraft && canManage ? (
                                <WorkflowStageRowActions
                                  onDelete={() => setDeleteNode(node)}
                                  disabled={deleting || bandLinkSaving}
                                />
                              ) : null
                            }
                          />
                        </ListItemEnter>
                      );
                    });

                    if (lane.kind === 'together') {
                      return (
                        <View
                          key={`lane-${lane.nodes.map((n) => n.id).join('-')}`}
                          style={{
                            gap: theme.spacing.sm,
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: theme.radius.lg,
                            padding: theme.spacing.sm,
                          }}
                        >
                          <AppText
                            variant="caption"
                            color="muted"
                            weight="medium"
                            style={{ textAlign: 'center' }}
                          >
                            {t('mobile.production.workflow.together')}
                          </AppText>
                          {rows}
                        </View>
                      );
                    }
                    // parallel = inside-band siblings (no Together hub); solo = single
                    return (
                      <View key={`lane-${lane.nodes.map((n) => n.id).join('-')}`} style={{ gap: theme.spacing.sm }}>
                        {rows}
                      </View>
                    );
                  })}
                  {leaveLink ? (
                    <ParallelBandLinkControl
                      mode={leaveLink.mode}
                      disabled={!isDraft || !canManage}
                      saving={bandLinkSaving}
                      onChange={(mode) => void applyBandLink(leaveLink, mode)}
                    />
                  ) : null}
                </View>
                );
              })}
            </WorkflowFloorBoard>

            {isDraft && canManage
              ? bandLinks
                  .filter((l) => l.mode === 'mixed')
                  .map((link) => (
                    <ParallelBandLinkControl
                      key={`mixed-${link.fromBand.nodeIds.join('-')}-${link.toBand.nodeIds.join('-')}`}
                      mode={link.mode}
                      saving={bandLinkSaving}
                      onChange={(mode) => void applyBandLink(link, mode)}
                    />
                  ))
              : null}

            {isDraft && canManage ? (
              <PrimaryButton
                label={t('mobile.production.workflow.addStage')}
                onPress={() => setAddOpen(true)}
                leading={<Ionicons name="add" size={18} color={colors.onBrand} />}
                style={{ borderRadius: theme.radius.xl }}
              />
            ) : null}
          </>
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
                <ProductionFlowMap
                  stages={previewStages}
                  preview
                  onStagePress={
                    isDraft && canManage
                      ? (stage) => {
                          const node = version?.nodes.find((n) => n.id === stage.code);
                          if (node) setEditNode(node);
                        }
                      : undefined
                  }
                />
              </ScrollView>
            </View>
          </SurfaceCard>
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
        open={Boolean(deleteNode)}
        onClose={() => {
          if (deleting) return;
          setDeleteNode(null);
        }}
        title={t('mobile.production.workflow.removeStage')}
        message={
          deleteNode
            ? t('mobile.production.workflow.removeStageConfirm', {
                name: stageNodeLabel(locale, deleteNode.stageDefinition),
              })
            : t('mobile.production.workflow.removeStage')
        }
        confirmLabel={t('mobile.production.workflow.removeStage')}
        destructive
        onConfirm={() => {
          if (!version || !deleteNode || deleting) return;
          void (async () => {
            setDeleting(true);
            try {
              const healed = await commitRemoveWorkflowStage({
                workflowId,
                version,
                nodeId: deleteNode.id,
              });
              await applyVersionCache(healed);
              markDirty();
              setDeleteNode(null);
              showToast({
                variant: 'success',
                message: t('mobile.production.workflow.stageRemoved'),
              });
            } catch (err) {
              showToast({
                variant: 'error',
                message: isApiError(err)
                  ? toastMessageForError(err)
                  : t('mobile.production.workflow.loadError'),
              });
            } finally {
              setDeleting(false);
            }
          })();
        }}
      />

      <ConfirmationSheet
        open={Boolean(lockInfoNode)}
        onClose={() => setLockInfoNode(null)}
        title={
          lockInfoNode
            ? stageNodeLabel(locale, lockInfoNode.stageDefinition)
            : t('mobile.production.workflow.openingLocked')
        }
        message={
          lockInfoNode?.stageDefinition?.code === 'MATERIAL_PREP'
            ? t('mobile.production.workflow.openingHint')
            : lockInfoNode?.stageDefinition?.code === 'INSPECTION'
              ? t('lifecycle.terminalInspectionDesc')
              : lockInfoNode?.stageDefinition?.code === 'PACKAGING'
                ? t('lifecycle.terminalPackagingDesc')
                : lockInfoNode?.stageDefinition?.code === 'DELIVERY'
                  ? t('lifecycle.terminalDeliveryDesc')
                  : t('mobile.production.workflow.anchorLockedHint')
        }
        confirmLabel={t('common.close')}
        cancelLabel={t('common.close')}
        onConfirm={() => setLockInfoNode(null)}
      />

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
              const healed = await commitCanonicalizeDraft({ workflowId, version });
              await applyVersionCache(healed);
              let revision = healed.revision;
              const opened = await ensureOpeningChain(workflowId, draftVersionId, revision);
              revision = opened.revision;
              const appended = await ensureTerminalChain(
                workflowId,
                draftVersionId,
                revision,
              );
              publishMutation.mutate(appended.revision, {
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
