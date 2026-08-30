import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localizedName } from '@maher/i18n';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import type { WorkflowVersion } from '@/api/modules/workflow';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { useToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  commitAddWorkflowStage,
  useApplyWorkflowVersionCache,
} from '../commitWorkflowGraph';
import { useStageLibraryQuery } from '../query';
import { isLockedAnchorStageCode } from '@maher/types';
import {
  clampParallelReferenceIds,
  clampPredecessorIds,
  materialPrepSuccessorIds,
  simulateWorkflowMutation,
  validParallelReferenceCandidateIds,
  validPredecessorCandidateIds,
  validSuccessorCandidateIds,
  withSuccessorIds,
  type PlacementIntent,
} from '@maher/workflow-domain';
import {
  lockedAnchorNodeIds,
  middleProductionNodes,
} from '../workflowTerminal';
import { stageNodeLabel } from '../stageNodeLabel';
import { nameFieldOrder, slugFromEnglishName, type TrilingualNames } from '../trilingualNames';
import { canonicalEdgesForLayout, toDomainGraph } from '../toDomainGraph';
import { WorkflowCompactPickRow, WorkflowFloorBoard } from './WorkflowFloorList';
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
  onDirty?: () => void;
};

type Mode = 'pick' | 'create';
type Placement = 'start' | 'after' | 'parallel';

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function sheetErrorMessage(
  err: unknown,
  t: (key: string) => string,
): string {
  if (isApiError(err)) {
    if (err.code === 'WORKFLOW_VERSION_STALE') {
      return t('mobile.production.workflow.errors.WORKFLOW_VERSION_STALE');
    }
    if (err.code.startsWith('TERMINAL_CHAIN_') || err.code.startsWith('OPENING_CHAIN_')) {
      const key = `production.workflow.errors.${err.code}`;
      const msg = t(key);
      return msg === key ? err.message : msg;
    }
    if (err.code === 'WORKFLOW_CYCLE') return t('mobile.production.workflow.invalidCycle');
    if (err.message && err.message.trim()) return err.message;
    return toastMessageForError(err);
  }
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code: string }).code);
    if (code === 'WORKFLOW_VALIDATION' && err instanceof Error && err.message) {
      return err.message;
    }
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return t('mobile.production.workflow.addStageError');
}

export function AddStageSheet({ open, onClose, workflowId, version, onDirty }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const libraryQuery = useStageLibraryQuery(open);
  const applyCache = useApplyWorkflowVersionCache(workflowId, version.id);
  const savingRef = useRef(false);

  const [mode, setMode] = useState<Mode>('pick');
  const [stageId, setStageId] = useState('');
  const [placement, setPlacement] = useState<Placement>('after');
  const [afterIds, setAfterIds] = useState<string[]>([]);
  const [parallelIds, setParallelIds] = useState<string[]>([]);
  const [afterScope, setAfterScope] = useState<'one' | 'band'>('one');
  const [leadsIntoIds, setLeadsIntoIds] = useState<string[]>([]);
  const [names, setNames] = useState<TrilingualNames>({
    nameEn: '',
    nameAr: '',
    nameHe: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const fieldOrder = nameFieldOrder(locale);
  const nameLabels: Record<keyof TrilingualNames, string> = {
    nameEn: t('mobile.production.workflow.nameEn'),
    nameAr: t('mobile.production.workflow.nameAr'),
    nameHe: t('mobile.production.workflow.nameHe'),
  };

  const usedCodes = useMemo(
    () => new Set(version.nodes.map((n) => n.stageDefinition?.code).filter((c): c is string => Boolean(c))),
    [version.nodes],
  );

  const availableStages = useMemo(
    () =>
      (libraryQuery.data ?? []).filter(
        (s) => s.isActive && !usedCodes.has(s.code) && !isLockedAnchorStageCode(s.code),
      ),
    [libraryQuery.data, usedCodes],
  );

  const sortedNodes = useMemo(
    () => [...version.nodes].sort((a, b) => a.sortOrder - b.sortOrder),
    [version.nodes],
  );

  const editableNodes = useMemo(() => middleProductionNodes(sortedNodes), [sortedNodes]);
  const lockedIds = useMemo(() => lockedAnchorNodeIds(sortedNodes), [sortedNodes]);
  const domain = useMemo(() => toDomainGraph(version), [version]);

  const afterPoolNodes = useMemo(() => {
    const opening = sortedNodes.filter((n) => n.stageDefinition?.code === 'MATERIAL_PREP');
    return [...opening, ...editableNodes];
  }, [sortedNodes, editableNodes]);

  const afterCandidateIds = useMemo(
    () =>
      validPredecessorCandidateIds(domain, '__you__', afterIds, {
        leadsIntoIds,
      }),
    [domain, afterIds, leadsIntoIds],
  );

  const afterPickNodes = useMemo(() => {
    const allow = new Set(afterCandidateIds);
    return afterPoolNodes.filter((n) => allow.has(n.id));
  }, [afterPoolNodes, afterCandidateIds]);

  const parallelCandidateIds = useMemo(
    () => validParallelReferenceCandidateIds(domain, '__you__', parallelIds),
    [domain, parallelIds],
  );

  const parallelPickNodes = useMemo(() => {
    const allow = new Set(parallelCandidateIds);
    return editableNodes.filter((n) => allow.has(n.id));
  }, [parallelCandidateIds, editableNodes]);

  const bandForAfter = useMemo(() => {
    if (afterIds.length !== 1) return null;
    return domain.parallelBands.find((b) => b.nodeIds.includes(afterIds[0]!)) ?? null;
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
        predecessorIds =
          domain.frontierNodeIds.length > 0
            ? [domain.frontierNodeIds[domain.frontierNodeIds.length - 1]!]
            : [];
      }
      base = { kind: 'AFTER', predecessorIds };
    }
    return withSuccessorIds(base, leadsIntoIds);
  }, [placement, afterIds, afterScope, bandForAfter, parallelIds, domain.frontierNodeIds, leadsIntoIds]);

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
    if (placement === 'start') {
      return validSuccessorCandidateIds(domain, '__you__', [], {
        restrictToIds: materialPrepSuccessorIds(domain),
      });
    }
    if (placement === 'parallel') {
      return validSuccessorCandidateIds(domain, '__you__', leadPredIds, {
        excludeIds: parallelIds,
      });
    }
    return validSuccessorCandidateIds(domain, '__you__', leadPredIds);
  }, [domain, leadPredIds, placement, parallelIds]);

  const leadsPickNodes = useMemo(() => {
    const allow = new Set(leadCandidateIds);
    return editableNodes.filter((n) => allow.has(n.id));
  }, [editableNodes, leadCandidateIds]);

  const simulated = useMemo(() => {
    const tempId = '__you__';
    const code =
      mode === 'pick'
        ? (availableStages.find((s) => s.id === stageId)?.code ?? 'YOU')
        : slugFromEnglishName(names.nameEn, 'STAGE');
    return simulateWorkflowMutation(domain, {
      kind: 'ADD',
      nodeId: tempId,
      code,
      placement: placementIntent,
    });
  }, [domain, placementIntent, mode, stageId, availableStages, names.nameEn]);

  const previewEdges = useMemo(() => canonicalEdgesForLayout(simulated), [simulated]);
  const previewRunsAfter = simulated.predecessorsByNode['__you__'] ?? [];
  const previewLeadsInto = (simulated.successorsByNode['__you__'] ?? []).filter((id) => {
    const code = simulated.nodes.find((n) => n.id === id)?.code ?? '';
    return code !== 'PACKAGING' && code !== 'DELIVERY';
  });

  const selectedStage = availableStages.find((s) => s.id === stageId);
  const youLabel =
    mode === 'pick'
      ? selectedStage
        ? localizedName(locale, selectedStage, selectedStage.code)
        : t('mobile.production.workflow.previewYou')
      : names.nameEn.trim() ||
        names.nameAr.trim() ||
        t('mobile.production.workflow.previewYou');

  const canSave =
    mode === 'pick'
      ? Boolean(selectedStage)
      : Boolean(names.nameEn.trim() && names.nameAr.trim());

  const placementReady =
    placement === 'start' ||
    placement === 'after' ||
    (placement === 'parallel' && parallelIds.length > 0);


  useEffect(() => {
    if (!open) return;
    savingRef.current = false;
    setSaving(false);
    setFormError(null);
    setMode('pick');
    setStageId('');
    setNames({ nameEn: '', nameAr: '', nameHe: '' });
    setPlacement(editableNodes.length > 0 ? 'after' : 'start');
    setAfterIds([]);
    setAfterScope('one');
    setParallelIds([]);
    setLeadsIntoIds([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLeadsIntoIds((ids) => {
      const next = ids.filter((id) => leadCandidateIds.includes(id));
      if (next.length === ids.length && next.every((id, i) => id === ids[i])) return ids;
      return next;
    });
  }, [open, leadCandidateIds]);

  useEffect(() => {
    if (!open) return;
    setAfterIds((ids) => {
      const next = clampPredecessorIds(domain, '__you__', ids, { leadsIntoIds });
      if (next.length === ids.length && next.every((id, i) => id === ids[i])) return ids;
      return next;
    });
  }, [open, domain, leadsIntoIds, afterCandidateIds]);

  useEffect(() => {
    if (!open) return;
    setParallelIds((ids) => {
      const next = clampParallelReferenceIds(domain, '__you__', ids);
      if (next.length === ids.length && next.every((id, i) => id === ids[i])) return ids;
      return next;
    });
  }, [open, domain, parallelCandidateIds]);

  function reset() {
    savingRef.current = false;
    setMode('pick');
    setStageId('');
    setPlacement('after');
    setAfterIds([]);
    setAfterScope('one');
    setParallelIds([]);
    setLeadsIntoIds([]);
    setNames({ nameEn: '', nameAr: '', nameHe: '' });
    setSaving(false);
    setFormError(null);
  }

  async function onSave() {
    if (savingRef.current || saving) return;
    if (!canSave) {
      setFormError(
        mode === 'create'
          ? t('mobile.production.workflow.namesRequired')
          : t('mobile.production.workflow.pickStageFirst'),
      );
      scrollRef.current?.scrollToEnd({ animated: true });
      void haptics.error();
      return;
    }
    if (!placementReady) {
      setFormError(t('mobile.production.workflow.placementPickRequired'));
      scrollRef.current?.scrollToEnd({ animated: true });
      void haptics.error();
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    Keyboard.dismiss();

    try {
      const healed = await commitAddWorkflowStage({
        workflowId,
        version,
        stageDefinitionId: selectedStage?.id ?? '',
        nodeKey: selectedStage?.code ?? '',
        code: selectedStage?.code ?? slugFromEnglishName(names.nameEn, 'STAGE'),
        placement: placementIntent,
        createStage:
          mode === 'create'
            ? {
                nameEn: names.nameEn.trim(),
                nameAr: names.nameAr.trim(),
                nameHe: names.nameHe.trim() || undefined,
              }
            : undefined,
      });

      await applyCache(healed);
      onDirty?.();
      Keyboard.dismiss();
      onClose();
      void haptics.confirmLight();
      setTimeout(() => {
        showToast({
          variant: 'success',
          message: t('mobile.production.workflow.stageAdded'),
        });
      }, 220);
    } catch (err) {
      void haptics.error();
      setFormError(sheetErrorMessage(err, t));
      scrollRef.current?.scrollToEnd({ animated: true });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function Segment({
    active,
    label,
    onPress,
  }: {
    active: boolean;
    label: string;
    onPress: () => void;
  }) {
    return (
      <AnimatedPressable
        variant="button"
        onPress={() => {
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

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      onClosed={reset}
      title={t('mobile.production.workflow.addStage')}
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
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: theme.spacing.sm }}>
          <Segment
            active={mode === 'pick'}
            label={t('mobile.production.workflow.chooseExistingStage')}
            onPress={() => setMode('pick')}
          />
          <Segment
            active={mode === 'create'}
            label={t('mobile.production.workflow.createStage')}
            onPress={() => setMode('create')}
          />
        </View>

        {mode === 'pick' ? (
          libraryQuery.isLoading ? (
            <AppText color="muted">{t('mobile.production.loadingMore')}</AppText>
          ) : availableStages.length === 0 ? (
            <AppText color="muted">{t('mobile.production.workflow.emptyStages')}</AppText>
          ) : (
            <WorkflowFloorBoard
              title={t('mobile.production.workflow.stageName')}
              count={availableStages.length}
            >
              {availableStages.map((stage) => (
                <WorkflowCompactPickRow
                  key={stage.id}
                  label={localizedName(locale, stage, stage.code)}
                  active={stageId === stage.id}
                  onPress={() => {
                    void haptics.selection();
                    setStageId(stage.id);
                  }}
                />
              ))}
            </WorkflowFloorBoard>
          )
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            {fieldOrder.map((key) => (
              <TextField
                key={key}
                label={
                  key === 'nameHe'
                    ? `${nameLabels[key]} (${t('mobile.production.workflow.hebrewOptional')})`
                    : nameLabels[key]
                }
                value={names[key]}
                onChangeText={(v) => setNames((n) => ({ ...n, [key]: v }))}
                autoCapitalize={key === 'nameEn' ? 'words' : 'none'}
              />
            ))}
          </View>
        )}
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
                setAfterIds((ids) =>
                  clampPredecessorIds(domain, '__you__', toggleId(ids, id), {
                    leadsIntoIds,
                  }),
                );
                setAfterScope('one');
              }}
              labelFor={(node) => stageNodeLabel(locale, node.stageDefinition)}
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
              setParallelIds((ids) =>
                clampParallelReferenceIds(domain, '__you__', toggleId(ids, id)),
              );
            }}
            labelFor={(node) => stageNodeLabel(locale, node.stageDefinition)}
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
          labelFor={(node) => stageNodeLabel(locale, node.stageDefinition)}
        />
        <PlacementModeHint>
          {t('mobile.production.workflow.leadsIntoPickHint')}
        </PlacementModeHint>

        <PlacementArrowPreview
          nodes={sortedNodes}
          edges={previewEdges}
          youLabel={youLabel}
          runsAfterIds={previewRunsAfter}
          leadsIntoIds={previewLeadsInto}
          parallelSiblingIds={placement === 'parallel' ? parallelIds : []}
          lockedIds={lockedIds}
          startBesidePrep={placement === 'start'}
          targetId="__you__"
        />

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

        {!canSave && mode === 'pick' ? (
          <AppText variant="caption" color="muted">
            {t('mobile.production.workflow.pickStageFirst')}
          </AppText>
        ) : null}

        <PrimaryButton
          label={t('mobile.production.workflow.addStage')}
          loading={saving}
          disabled={saving}
          onPress={() => void onSave()}
          style={{ borderRadius: theme.radius.xl }}
        />
      </ScrollView>
    </BottomSheet>
  );
}
