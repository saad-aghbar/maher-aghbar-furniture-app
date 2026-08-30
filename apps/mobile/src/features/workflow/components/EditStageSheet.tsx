import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { type WorkflowNode, type WorkflowVersion } from '@/api/modules/workflow';
import { AppText } from '@/components/AppText';
import { DestructiveButton } from '@/components/buttons/DestructiveButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { useToast } from '@/components/feedback/Toast';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { isLockedAnchorStageCode } from '@maher/types';
import {
  clampParallelReferenceIds,
  clampPredecessorIds,
  materialPrepSuccessorIds,
  productionSuccessorIds,
  simulateWorkflowMutation,
  validParallelReferenceCandidateIds,
  validPredecessorCandidateIds,
  validSuccessorCandidateIds,
  withSuccessorIds,
  type PlacementIntent,
} from '@maher/workflow-domain';
import {
  isLockedAnchorNode,
  lockedAnchorNodeIds,
  middleProductionNodes,
} from '../workflowTerminal';
import { stageNodeLabel } from '../stageNodeLabel';
import {
  commitEditWorkflowStage,
  commitRemoveWorkflowStage,
  useApplyWorkflowVersionCache,
} from '../commitWorkflowGraph';
import { canonicalEdgesForLayout, toDomainGraph } from '../toDomainGraph';
import { PlacementArrowPreview } from './PlacementArrowPreview';
import {
  PlacementModeHint,
  PlacementTogetherPickList,
} from './PlacementTogetherPickList';

type Props = {
  open: boolean;
  onClose: () => void;
  workflowId: string;
  version: WorkflowVersion;
  node: WorkflowNode | null;
  onDirty?: () => void;
};

type Placement = 'start' | 'after' | 'parallel';
type AfterScope = 'one' | 'band';

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function sheetErrorMessage(err: unknown, t: (key: string) => string): string {
  if (isApiError(err)) {
    if (err.code === 'WORKFLOW_VERSION_STALE') {
      return t('mobile.production.workflow.errors.WORKFLOW_VERSION_STALE');
    }
    if (err.code.startsWith('TERMINAL_CHAIN_') || err.code.startsWith('OPENING_CHAIN_')) {
      const key = `production.workflow.errors.${err.code}`;
      const msg = t(key);
      return msg === key ? err.message : msg;
    }
    if (err.message && err.message.trim()) return err.message;
    return toastMessageForError(err);
  }
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code: string }).code);
    if (code === 'WORKFLOW_VALIDATION') {
      return err instanceof Error && err.message
        ? err.message
        : t('mobile.production.workflow.saveConnectionsError');
    }
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return t('mobile.production.workflow.saveConnectionsError');
}

export function EditStageSheet({
  open,
  onClose,
  workflowId,
  version,
  node,
  onDirty,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const applyCache = useApplyWorkflowVersionCache(workflowId, version.id);
  const busyRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  const [placement, setPlacement] = useState<Placement>('after');
  const [afterIds, setAfterIds] = useState<string[]>([]);
  const [afterScope, setAfterScope] = useState<AfterScope>('one');
  const [parallelIds, setParallelIds] = useState<string[]>([]);
  const [leadsIntoIds, setLeadsIntoIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const domain = useMemo(() => toDomainGraph(version), [version]);
  const sortedNodes = useMemo(
    () => [...version.nodes].sort((a, b) => a.sortOrder - b.sortOrder),
    [version.nodes],
  );
  const editableNodes = useMemo(
    () => middleProductionNodes(sortedNodes).filter((n) => n.id !== node?.id),
    [sortedNodes, node?.id],
  );
  const lockedIds = useMemo(() => lockedAnchorNodeIds(sortedNodes), [sortedNodes]);

  const afterPoolNodes = useMemo(() => {
    const opening = sortedNodes.filter((n) => n.stageDefinition?.code === 'MATERIAL_PREP');
    const prod = editableNodes.filter((n) => {
      const code = n.stageDefinition?.code ?? '';
      return code !== 'INSPECTION' && code !== 'PACKAGING' && code !== 'DELIVERY';
    });
    return [...opening, ...prod];
  }, [sortedNodes, editableNodes]);

  const afterCandidateIds = useMemo(() => {
    if (!node) return [];
    return validPredecessorCandidateIds(domain, node.id, afterIds, {
      leadsIntoIds,
    });
  }, [domain, node, afterIds, leadsIntoIds]);

  const afterPickNodes = useMemo(() => {
    const allow = new Set(afterCandidateIds);
    return afterPoolNodes.filter((n) => allow.has(n.id));
  }, [afterPoolNodes, afterCandidateIds]);

  const parallelCandidateIds = useMemo(() => {
    if (!node) return [];
    return validParallelReferenceCandidateIds(domain, node.id, parallelIds);
  }, [domain, node, parallelIds]);

  const parallelPickNodes = useMemo(() => {
    const allow = new Set(parallelCandidateIds);
    return editableNodes.filter((n) => allow.has(n.id));
  }, [parallelCandidateIds, editableNodes]);

  const bandForAfter = useMemo(() => {
    if (afterIds.length !== 1) return null;
    const id = afterIds[0]!;
    return domain.parallelBands.find((b) => b.nodeIds.includes(id)) ?? null;
  }, [afterIds, domain.parallelBands]);

  const placementIntent: PlacementIntent = useMemo(() => {
    let base: PlacementIntent;
    if (placement === 'start') {
      base = { kind: 'START' };
    } else if (placement === 'parallel') {
      base = { kind: 'PARALLEL', referenceNodeIds: parallelIds };
    } else {
      let predecessorIds = [...afterIds];
      if (afterScope === 'band' && bandForAfter) {
        predecessorIds = [...bandForAfter.nodeIds];
      }
      if (predecessorIds.length === 0) {
        const tails = domain.frontierNodeIds.filter((id) => id !== node?.id);
        predecessorIds = tails.length > 0 ? [tails[tails.length - 1]!] : [];
      }
      base = { kind: 'AFTER', predecessorIds };
    }
    return withSuccessorIds(base, leadsIntoIds);
  }, [
    placement,
    afterIds,
    afterScope,
    bandForAfter,
    parallelIds,
    domain.frontierNodeIds,
    node?.id,
    leadsIntoIds,
  ]);

  const leadPredIds = useMemo(() => {
    if (placement === 'start') return [];
    if (placement === 'parallel') {
      const ref = parallelIds[0];
      return ref ? (domain.predecessorsByNode[ref] ?? []) : [];
    }
    if (placementIntent.kind === 'AFTER') return placementIntent.predecessorIds;
    return [];
  }, [placement, parallelIds, domain.predecessorsByNode, placementIntent]);

  const leadCandidateIds = useMemo(() => {
    if (!node) return [];
    if (placement === 'start') {
      return validSuccessorCandidateIds(domain, node.id, [], {
        restrictToIds: materialPrepSuccessorIds(domain),
      });
    }
    if (placement === 'parallel') {
      return validSuccessorCandidateIds(domain, node.id, leadPredIds, {
        excludeIds: parallelIds,
      });
    }
    return validSuccessorCandidateIds(domain, node.id, leadPredIds);
  }, [domain, node, leadPredIds, placement, parallelIds]);

  const leadsPickNodes = useMemo(() => {
    const allow = new Set(leadCandidateIds);
    return editableNodes.filter((n) => allow.has(n.id));
  }, [editableNodes, leadCandidateIds]);

  const simulated = useMemo(() => {
    if (!node) return domain;
    return simulateWorkflowMutation(domain, {
      kind: 'EDIT_PLACEMENT',
      nodeId: node.id,
      placement: placementIntent,
    });
  }, [domain, node, placementIntent]);

  const previewEdges = useMemo(() => canonicalEdgesForLayout(simulated), [simulated]);
  const previewRunsAfter = simulated.predecessorsByNode[node?.id ?? ''] ?? [];
  const previewLeadsInto = node
    ? (simulated.successorsByNode[node.id] ?? []).filter((id) => {
        const code = simulated.nodes.find((n) => n.id === id)?.code ?? '';
        return code !== 'PACKAGING' && code !== 'DELIVERY';
      })
    : [];

  const locked = node ? isLockedAnchorNode(node) : false;

  useEffect(() => {
    if (!open || !node) return;
    busyRef.current = false;
    setSaving(false);
    setRemoving(false);
    setFormError(null);
    const preds = domain.predecessorsByNode[node.id] ?? [];
    if (preds.length === 0) {
      setPlacement('start');
      setAfterIds([]);
      setParallelIds([]);
    } else {
      const band = domain.parallelBands.find((b) =>
        b.nodeIds.some((id) => id !== node.id && (domain.predecessorsByNode[id] ?? []).join() === preds.join()),
      );
      const siblings =
        band?.nodeIds.filter((id) => id !== node.id) ??
        editableNodes
          .filter((n) => (domain.predecessorsByNode[n.id] ?? []).join() === preds.join())
          .map((n) => n.id);
      if (siblings.length > 0) {
        setPlacement('parallel');
        setParallelIds(siblings);
        setAfterIds([]);
      } else {
        setPlacement('after');
        setAfterIds(preds);
        setParallelIds([]);
      }
    }
    setAfterScope('one');
    setLeadsIntoIds(productionSuccessorIds(domain, node.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, node?.id]);

  useEffect(() => {
    if (!open) return;
    setLeadsIntoIds((ids) => {
      const next = ids.filter((id) => leadCandidateIds.includes(id));
      if (next.length === ids.length && next.every((id, i) => id === ids[i])) return ids;
      return next;
    });
  }, [open, leadCandidateIds]);

  useEffect(() => {
    if (!open || !node) return;
    setAfterIds((ids) => {
      const next = clampPredecessorIds(domain, node.id, ids, { leadsIntoIds });
      if (next.length === ids.length && next.every((id, i) => id === ids[i])) return ids;
      return next;
    });
  }, [open, node, domain, leadsIntoIds, afterCandidateIds]);

  useEffect(() => {
    if (!open || !node) return;
    setParallelIds((ids) => {
      const next = clampParallelReferenceIds(domain, node.id, ids);
      if (next.length === ids.length && next.every((id, i) => id === ids[i])) return ids;
      return next;
    });
  }, [open, node, domain, parallelCandidateIds]);

  function Segment({
    active,
    label,
    onPress,
    disabled,
  }: {
    active: boolean;
    label: string;
    onPress: () => void;
    disabled?: boolean;
  }) {
    return (
      <AnimatedPressable
        variant="button"
        disabled={disabled}
        onPress={() => {
          if (disabled) return;
          void haptics.selection();
          onPress();
        }}
        style={{
          flex: 1,
          borderRadius: theme.radius.xl,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.sm,
          alignItems: 'center',
          backgroundColor: active ? colors.brand : colors.surface,
          borderWidth: 1,
          borderColor: active ? colors.brand : colors.border,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <AppText
          variant="caption"
          weight="semibold"
          style={{ color: active ? colors.onBrand : colors.textPrimary, textAlign: 'center' }}
        >
          {label}
        </AppText>
      </AnimatedPressable>
    );
  }

  async function onSave() {
    if (!node || busyRef.current || locked) return;
    if (placement === 'parallel' && parallelIds.length === 0) return;
    busyRef.current = true;
    setSaving(true);
    setFormError(null);
    Keyboard.dismiss();
    try {
      const healed = await commitEditWorkflowStage({
        workflowId,
        version,
        nodeId: node.id,
        placement: placementIntent,
      });
      await applyCache(healed);
      onDirty?.();
      onClose();
      void haptics.confirmLight();
      setTimeout(() => {
        showToast({
          variant: 'success',
          message: t('mobile.production.workflow.stageUpdated'),
        });
      }, 220);
    } catch (err) {
      void haptics.error();
      setFormError(sheetErrorMessage(err, t));
      scrollRef.current?.scrollToEnd({ animated: true });
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  }

  async function onRemove() {
    if (!node || busyRef.current || locked) return;
    if (isLockedAnchorStageCode(node.stageDefinition?.code ?? '')) return;
    busyRef.current = true;
    setRemoving(true);
    setFormError(null);
    try {
      const healed = await commitRemoveWorkflowStage({
        workflowId,
        version,
        nodeId: node.id,
      });
      await applyCache(healed);
      onDirty?.();
      onClose();
      void haptics.confirmLight();
      setTimeout(() => {
        showToast({
          variant: 'success',
          message: t('mobile.production.workflow.stageRemoved'),
        });
      }, 220);
    } catch (err) {
      void haptics.error();
      setFormError(sheetErrorMessage(err, t));
    } finally {
      busyRef.current = false;
      setRemoving(false);
    }
  }

  const stageName = node ? stageNodeLabel(locale, node.stageDefinition) : '';
  const title = t('mobile.production.workflow.placementTitle');

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      fitContent
      maxHeight={Math.round(windowH * 0.9)}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          gap: theme.spacing.lg,
          paddingBottom: insets.bottom + theme.spacing['3xl'],
        }}
        keyboardShouldPersistTaps="handled"
      >
        {locked ? (
          <AppText variant="caption" color="muted">
            {t('mobile.production.workflow.anchorLockedHint')}
          </AppText>
        ) : (
          <>
            {stageName ? (
              <AppText variant="body" weight="semibold" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {stageName}
              </AppText>
            ) : null}

            <View style={{ gap: theme.spacing.sm }}>
              <AppText variant="caption" color="secondary">
                {t('mobile.production.workflow.placementWhere')}
              </AppText>
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: theme.spacing.sm }}>
                <Segment
                  active={placement === 'start'}
                  label={t('mobile.production.workflow.placementStart')}
                  onPress={() => {
                    setPlacement('start');
                    setLeadsIntoIds([]);
                  }}
                />
                <Segment
                  active={placement === 'after'}
                  label={t('mobile.production.workflow.placementAfter')}
                  onPress={() => {
                    setPlacement('after');
                    setLeadsIntoIds([]);
                  }}
                />
                <Segment
                  active={placement === 'parallel'}
                  label={t('mobile.production.workflow.placementParallel')}
                  onPress={() => {
                    setPlacement('parallel');
                    setLeadsIntoIds([]);
                  }}
                />
              </View>
              <PlacementModeHint>
                {placement === 'start'
                  ? t('mobile.production.workflow.placementStartHint')
                  : placement === 'after'
                    ? t('mobile.production.workflow.placementAfterHint')
                    : t('mobile.production.workflow.placementParallelHint')}
              </PlacementModeHint>
            </View>

            {placement === 'after' && afterPickNodes.length > 0 ? (
              <>
                <PlacementTogetherPickList
                  title={t('mobile.production.workflow.placementAfterPick')}
                  count={afterIds.length}
                  nodes={afterPickNodes}
                  edges={canonicalEdgesForLayout(domain)}
                  selectedIds={afterIds}
                  lockedIds={lockedIds}
                  onToggle={(id) => {
                    if (!node) return;
                    setAfterIds((ids) =>
                      clampPredecessorIds(domain, node.id, toggleId(ids, id), {
                        leadsIntoIds,
                      }),
                    );
                    setAfterScope('one');
                  }}
                  labelFor={(n) => stageNodeLabel(locale, n.stageDefinition)}
                />
                {bandForAfter ? (
                  <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: theme.spacing.sm }}>
                    <Segment
                      active={afterScope === 'one'}
                      label={t('mobile.production.workflow.afterThisStageOnly')}
                      onPress={() => setAfterScope('one')}
                    />
                    <Segment
                      active={afterScope === 'band'}
                      label={t('mobile.production.workflow.afterWholeParallelGroup')}
                      onPress={() => setAfterScope('band')}
                    />
                  </View>
                ) : null}
              </>
            ) : null}

            {placement === 'parallel' && parallelPickNodes.length > 0 ? (
              <PlacementTogetherPickList
                title={t('mobile.production.workflow.placementParallelPick')}
                count={parallelIds.length}
                nodes={parallelPickNodes}
                edges={canonicalEdgesForLayout(domain)}
                selectedIds={parallelIds}
                onToggle={(id) => {
                  if (!node) return;
                  setParallelIds((ids) =>
                    clampParallelReferenceIds(domain, node.id, toggleId(ids, id)),
                  );
                }}
                labelFor={(n) => stageNodeLabel(locale, n.stageDefinition)}
              />
            ) : null}

            <PlacementTogetherPickList
              title={t('mobile.production.workflow.leadsIntoThoseStages')}
              count={leadsIntoIds.length}
              nodes={leadsPickNodes}
              edges={canonicalEdgesForLayout(domain)}
              selectedIds={leadsIntoIds}
              lockedIds={lockedIds}
              onToggle={(id) => setLeadsIntoIds((ids) => toggleId(ids, id))}
              labelFor={(n) => stageNodeLabel(locale, n.stageDefinition)}
            />
            <PlacementModeHint>
              {t('mobile.production.workflow.leadsIntoPickHint')}
            </PlacementModeHint>

            <PlacementArrowPreview
              nodes={sortedNodes}
              edges={previewEdges}
              youLabel={stageName || title}
              runsAfterIds={previewRunsAfter}
              leadsIntoIds={previewLeadsInto}
              parallelSiblingIds={placement === 'parallel' ? parallelIds : []}
              lockedIds={lockedIds}
              startBesidePrep={placement === 'start'}
              targetId={node?.id ?? null}
            />
          </>
        )}

        {formError ? (
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.error,
              backgroundColor: colors.surface,
              padding: theme.spacing.md,
            }}
          >
            <AppText variant="caption" style={{ color: colors.error }}>
              {formError}
            </AppText>
          </View>
        ) : null}

        {!locked ? (
          <View style={{ gap: theme.spacing.sm }}>
            <PrimaryButton
              label={t('common.save')}
              onPress={() => void onSave()}
              loading={saving}
              disabled={saving || removing || (placement === 'parallel' && parallelIds.length === 0)}
            />
            <DestructiveButton
              label={t('mobile.production.workflow.removeStage')}
              onPress={() => void onRemove()}
              loading={removing}
              disabled={saving || removing}
            />
          </View>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}
